import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In } from 'typeorm';

import { TagsService } from './tags.service';
import { UserTag } from './user-tag.entity';

const USER_ID = 'user-uuid-1';

const makeTag = (name: string, id = `tag-${name}`): UserTag => ({
  createdAt: new Date(),
  id,
  mealPreps: [],
  name,
  userId: USER_ID,
});

describe('TagsService', () => {
  let service: TagsService;
  let tagRepo: {
    find: jest.Mock;
    upsert: jest.Mock;
  };

  beforeEach(async () => {
    tagRepo = { find: jest.fn(), upsert: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        TagsService,
        { provide: getRepositoryToken(UserTag), useValue: tagRepo },
      ],
    }).compile();

    service = module.get(TagsService);
    jest.clearAllMocks();
  });

  describe('findByUser', () => {
    it('returns tags for the given user ordered by name', async () => {
      const tags = [makeTag('bulk'), makeTag('keto')];
      tagRepo.find.mockResolvedValue(tags);

      const result = await service.findByUser(USER_ID);

      expect(tagRepo.find).toHaveBeenCalledWith({
        order: { name: 'ASC' },
        where: { userId: USER_ID },
      });
      expect(result).toEqual(tags);
    });

    it('returns an empty array when the user has no tags', async () => {
      tagRepo.find.mockResolvedValue([]);

      const result = await service.findByUser(USER_ID);

      expect(result).toEqual([]);
    });
  });

  describe('upsertForUser', () => {
    it('upserts unique tags and returns them', async () => {
      const names = ['keto', 'bulk'];
      const tags = names.map(makeTag);
      tagRepo.upsert.mockResolvedValue(undefined);
      tagRepo.find.mockResolvedValue(tags);

      const result = await service.upsertForUser(USER_ID, names);

      expect(tagRepo.upsert).toHaveBeenCalledWith(
        [
          { name: 'keto', userId: USER_ID },
          { name: 'bulk', userId: USER_ID },
        ],
        {
          conflictPaths: ['userId', 'name'],
          skipUpdateIfNoValuesChanged: true,
        },
      );
      expect(tagRepo.find).toHaveBeenCalledWith({
        order: { name: 'ASC' },
        where: { name: In(names), userId: USER_ID },
      });
      expect(result).toEqual(tags);
    });

    it('deduplicates names before upserting', async () => {
      tagRepo.upsert.mockResolvedValue(undefined);
      tagRepo.find.mockResolvedValue([makeTag('keto')]);

      await service.upsertForUser(USER_ID, ['keto', 'keto', 'keto']);

      expect(tagRepo.upsert).toHaveBeenCalledWith(
        [{ name: 'keto', userId: USER_ID }],
        expect.any(Object),
      );
    });

    it('trims whitespace from tag names', async () => {
      tagRepo.upsert.mockResolvedValue(undefined);
      tagRepo.find.mockResolvedValue([makeTag('bulk')]);

      await service.upsertForUser(USER_ID, ['  bulk  ']);

      expect(tagRepo.upsert).toHaveBeenCalledWith(
        [{ name: 'bulk', userId: USER_ID }],
        expect.any(Object),
      );
    });

    it('filters out blank strings after trimming', async () => {
      tagRepo.upsert.mockResolvedValue(undefined);
      tagRepo.find.mockResolvedValue([]);

      await service.upsertForUser(USER_ID, ['   ', '']);

      expect(tagRepo.upsert).toHaveBeenCalledWith([], expect.any(Object));
    });
  });
});
