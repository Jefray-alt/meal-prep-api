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

const makeTags = (count: number): UserTag[] =>
  Array.from({ length: count }, (_, i) => makeTag(`tag-${i}`));

describe('TagsService', () => {
  let service: TagsService;
  let tagRepo: {
    createQueryBuilder: jest.Mock;
    find: jest.Mock;
    upsert: jest.Mock;
  };

  beforeEach(async () => {
    tagRepo = {
      createQueryBuilder: jest.fn(),
      find: jest.fn(),
      upsert: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        TagsService,
        { provide: getRepositoryToken(UserTag), useValue: tagRepo },
      ],
    }).compile();

    service = module.get(TagsService);
    jest.clearAllMocks();
  });

  const makeQb = (rows: UserTag[]) => {
    const qb = {
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(rows),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
    };
    tagRepo.createQueryBuilder.mockReturnValue(qb);
    return qb;
  };

  describe('search', () => {
    it('returns up to 10 tags and hasMore:true when more exist', async () => {
      makeQb(makeTags(11));

      const result = await service.search(USER_ID, undefined, 10, 0);

      expect(result.data).toHaveLength(10);
      expect(result.hasMore).toBe(true);
    });

    it('returns all tags and hasMore:false when fewer than limit exist', async () => {
      makeQb(makeTags(5));

      const result = await service.search(USER_ID, undefined, 10, 0);

      expect(result.data).toHaveLength(5);
      expect(result.hasMore).toBe(false);
    });

    it('respects a custom limit', async () => {
      makeQb(makeTags(6));

      const result = await service.search(USER_ID, undefined, 5, 0);

      expect(result.data).toHaveLength(5);
      expect(result.hasMore).toBe(true);
    });

    it('passes offset to the query builder', async () => {
      const qb = makeQb(makeTags(3));

      await service.search(USER_ID, undefined, 10, 10);

      expect(qb.offset).toHaveBeenCalledWith(10);
    });

    it('uses ILIKE and name ordering when search is provided', async () => {
      const qb = makeQb([makeTag('high-protein'), makeTag('protein-bar')]);

      await service.search(USER_ID, 'protein', 10, 0);

      expect(qb.andWhere).toHaveBeenCalledWith('tag.name ILIKE :search', {
        search: '%protein%',
      });
      expect(qb.orderBy).toHaveBeenCalledWith('tag.name', 'ASC');
    });

    it('returns second page of search results correctly', async () => {
      makeQb([makeTag('protein-bar')]);

      const result = await service.search(USER_ID, 'protein', 5, 5);

      expect(result.data).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });

    it('returns empty data and hasMore:false when no tags match search', async () => {
      makeQb([]);

      const result = await service.search(USER_ID, 'zzznomatch', 10, 0);

      expect(result).toEqual({ data: [], hasMore: false });
    });

    it('uses random ordering when search is an empty string', async () => {
      const qb = makeQb([]);

      await service.search(USER_ID, '', 10, 0);

      expect(qb.andWhere).not.toHaveBeenCalled();
      expect(qb.orderBy).toHaveBeenCalledWith('RANDOM()');
    });

    it('passes limit + 1 to the query builder for hasMore detection', async () => {
      const qb = makeQb([]);

      await service.search(USER_ID, undefined, 10, 0);

      expect(qb.limit).toHaveBeenCalledWith(11);
    });
  });

  describe('upsertForUser', () => {
    it('upserts unique tags and returns them', async () => {
      const names = ['keto', 'bulk'];
      const tags = names.map((name) => makeTag(name));
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
