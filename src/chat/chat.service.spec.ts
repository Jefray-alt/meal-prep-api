import type { Response } from 'express';

import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ChatMessage } from './chat-message.entity';
import { ChatService } from './chat.service';

const mockRepo = () => ({
  create: jest.fn((dto: Partial<ChatMessage>) => dto),
  find: jest.fn(),
  save: jest.fn(),
});

const mockConfig = () => ({
  getOrThrow: jest.fn((key: string) => {
    if (key === 'OLLAMA_BASE_URL') return 'http://localhost:11434/v1';
    if (key === 'OLLAMA_MODEL') return 'llama3.2';
    throw new Error(`Unknown key: ${key}`);
  }),
});

const mockRes = (): jest.Mocked<
  Pick<Response, 'end' | 'setHeader' | 'write'>
> => ({
  end: jest.fn(),
  setHeader: jest.fn(),
  write: jest.fn(),
});

describe('ChatService', () => {
  let service: ChatService;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: getRepositoryToken(ChatMessage), useFactory: mockRepo },
        { provide: ConfigService, useFactory: mockConfig },
      ],
    }).compile();

    service = module.get(ChatService);
    repo = module.get(getRepositoryToken(ChatMessage));
  });

  describe('getHistory', () => {
    it('returns messages ordered by createdAt ASC', async () => {
      const messages: Partial<ChatMessage>[] = [
        { content: 'hello', id: '1', role: 'user' },
        { content: 'hi there', id: '2', role: 'assistant' },
      ];
      repo.find.mockResolvedValue(messages);

      const result = await service.getHistory('user-1');

      expect(repo.find).toHaveBeenCalledWith({
        order: { createdAt: 'ASC' },
        where: { userId: 'user-1' },
      });
      expect(result).toBe(messages);
    });

    it('returns empty array when user has no messages', async () => {
      repo.find.mockResolvedValue([]);
      const result = await service.getHistory('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('streamToResponse', () => {
    it('persists user message, sets SSE headers, and streams reply', async () => {
      repo.find.mockResolvedValue([]);
      repo.save.mockResolvedValue({});

      const asyncChunks = function* () {
        yield { choices: [{ delta: { content: 'Great' } }] };
        yield { choices: [{ delta: { content: ' idea!' } }] };
      };

      jest
        .spyOn(service['openai'].chat.completions, 'create')
        .mockResolvedValue(asyncChunks() as never);

      const res = mockRes();
      await service.streamToResponse(
        'user-1',
        'What to prep?',
        res as unknown as Response,
      );

      expect(repo.save).toHaveBeenCalledTimes(2);
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/event-stream',
      );
      expect(res.write).toHaveBeenCalledWith('data: {"delta":"Great"}\n\n');
      expect(res.write).toHaveBeenCalledWith('data: {"delta":" idea!"}\n\n');
      expect(res.write).toHaveBeenCalledWith('data: [DONE]\n\n');
      expect(res.end).toHaveBeenCalled();
    });

    it('throws BadGatewayException when Ollama is unreachable', async () => {
      repo.find.mockResolvedValue([]);
      repo.save.mockResolvedValue({});

      jest
        .spyOn(service['openai'].chat.completions, 'create')
        .mockRejectedValue(new Error('ECONNREFUSED'));

      const res = mockRes();
      await expect(
        service.streamToResponse(
          'user-1',
          'What to prep?',
          res as unknown as Response,
        ),
      ).rejects.toThrow(BadGatewayException);
    });
  });
});
