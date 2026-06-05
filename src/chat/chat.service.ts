import type { Response } from 'express';

import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import OpenAI from 'openai';
import { Repository } from 'typeorm';

import { ChatMessage } from './chat-message.entity';

const SYSTEM_PROMPT = `You are mise, an expert meal-prep assistant. Your sole focus is helping users plan, prepare, and optimise their weekly meals.

You help with:
- Building weekly meal-prep plans tailored to dietary needs, time constraints, and skill level
- Suggesting recipes that batch well and store safely
- Estimating macros and portion sizes
- Reducing food waste through smart ingredient reuse
- Shopping list generation and pantry management

Guidelines:
- Keep responses practical and concise — users are busy home cooks, not professional chefs
- If a question is outside the scope of meal prep and cooking, politely redirect the conversation back to food
- Never invent nutritional data; acknowledge uncertainty when exact values are unknown
- Avoid dietary prescriptions (e.g. "you should eat less fat") — offer options, not mandates`;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly model: string;
  private readonly openai: OpenAI;

  constructor(
    @InjectRepository(ChatMessage)
    private chatMessageRepo: Repository<ChatMessage>,
    private configService: ConfigService,
  ) {
    this.openai = new OpenAI({
      apiKey: 'ollama',
      baseURL: this.configService.getOrThrow<string>('OLLAMA_BASE_URL'),
    });
    this.model = this.configService.getOrThrow<string>('OLLAMA_MODEL');
  }

  async getHistory(userId: string): Promise<ChatMessage[]> {
    return this.chatMessageRepo.find({
      order: { createdAt: 'ASC' },
      where: { userId },
    });
  }

  async streamToResponse(
    userId: string,
    message: string,
    res: Response,
  ): Promise<void> {
    await this.chatMessageRepo.save(
      this.chatMessageRepo.create({
        content: message.trim(),
        role: 'user',
        userId,
      }),
    );

    const history = await this.getHistory(userId);
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { content: SYSTEM_PROMPT, role: 'system' },
      ...history.map((m) => ({
        content: m.content,
        role: m.role,
      })),
    ];

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let stream: AsyncIterable<OpenAI.Chat.ChatCompletionChunk>;
    try {
      stream = await this.openai.chat.completions.create({
        messages,
        model: this.model,
        stream: true,
      });
    } catch (err) {
      this.logger.error('Ollama connection failed', err);
      throw new BadGatewayException('AI service unavailable');
    }

    let fullReply = '';
    try {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? '';
        if (delta) {
          fullReply += delta;
          res.write(`data: ${JSON.stringify({ delta })}\n\n`);
        }
      }

      await this.chatMessageRepo.save(
        this.chatMessageRepo.create({
          content: fullReply,
          role: 'assistant',
          userId,
        }),
      );

      res.write('data: [DONE]\n\n');
    } catch (err) {
      this.logger.error('SSE stream error', err);
      res.write('data: [ERROR]\n\n');
    } finally {
      res.end();
    }
  }
}
