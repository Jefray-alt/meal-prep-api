import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { TagsService } from '../tags/tags.service';
import { UserTag } from '../tags/user-tag.entity';
import { CreateMealPrepDto } from './dto/create-meal-prep.dto';
import { ListMealPrepsQueryDto } from './dto/list-meal-preps-query.dto';
import { MealPrep } from './meal-prep.entity';
import { MealPrepsService } from './meal-preps.service';

const USER_ID = 'user-uuid-1';

const makeTag = (name: string, createdAt?: Date): UserTag =>
  ({
    createdAt: createdAt ?? new Date('2024-01-01T00:00:00Z'),
    id: `tag-${name}`,
    name,
    userId: USER_ID,
  }) as UserTag;

const baseDto: CreateMealPrepDto = {
  carbs: 50,
  fat: 10,
  ingredients: [{ name: 'chicken', quantity: '200g' }],
  instructions: 'Cook the chicken.',
  protein: 40,
  tags: ['bulk', 'high-protein'],
  title: 'Sunday Batch',
};

const makeMealPrep = (overrides: Partial<MealPrep> = {}): MealPrep => ({
  carbs: null,
  createdAt: new Date('2024-01-15T12:00:00Z'),
  fat: null,
  id: 'mp-uuid-1',
  ingredients: [{ name: 'chicken', quantity: '200g' }],
  instructions: 'Cook it.',
  protein: null,
  tags: [],
  title: 'Sunday Batch',
  updatedAt: new Date('2024-01-15T12:00:00Z'),
  userId: USER_ID,
  ...overrides,
});

describe('MealPrepsService', () => {
  let service: MealPrepsService;
  let mealPrepRepo: {
    create: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
  };
  let tagsService: jest.Mocked<TagsService>;

  beforeEach(async () => {
    mealPrepRepo = {
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };
    tagsService = {
      findByUser: jest.fn(),
      upsertForUser: jest.fn(),
    } as unknown as jest.Mocked<TagsService>;

    const module = await Test.createTestingModule({
      providers: [
        MealPrepsService,
        { provide: getRepositoryToken(MealPrep), useValue: mealPrepRepo },
        { provide: TagsService, useValue: tagsService },
      ],
    }).compile();

    service = module.get(MealPrepsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('upserts tags then saves a new meal prep with the resolved tags', async () => {
      const tags = baseDto.tags.map((name) => makeTag(name));
      const savedMealPrep = {
        ...baseDto,
        id: 'mp-uuid-1',
        tags,
        userId: USER_ID,
      } as unknown as MealPrep;

      tagsService.upsertForUser.mockResolvedValue(tags);
      mealPrepRepo.create.mockReturnValue(savedMealPrep);
      mealPrepRepo.save.mockResolvedValue(savedMealPrep);

      const result = await service.create(USER_ID, baseDto);

      expect(tagsService.upsertForUser).toHaveBeenCalledWith(
        USER_ID,
        baseDto.tags,
      );
      expect(mealPrepRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tags,
          title: 'Sunday Batch',
          userId: USER_ID,
        }),
      );
      expect(mealPrepRepo.save).toHaveBeenCalledWith(savedMealPrep);
      expect(result).toEqual(savedMealPrep);
    });

    it('sets userId from the token argument, not from the DTO', async () => {
      const tags = [makeTag('bulk')];
      tagsService.upsertForUser.mockResolvedValue(tags);
      mealPrepRepo.create.mockReturnValue({});
      mealPrepRepo.save.mockResolvedValue({});

      await service.create(USER_ID, baseDto);

      expect(mealPrepRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: USER_ID }),
      );
    });

    it('defaults optional macros to null when omitted', async () => {
      const dto: CreateMealPrepDto = {
        ingredients: [{ name: 'rice', quantity: '100g' }],
        instructions: 'Cook rice.',
        tags: ['bulk'],
        title: 'Plain Rice',
      };
      tagsService.upsertForUser.mockResolvedValue([makeTag('bulk')]);
      mealPrepRepo.create.mockReturnValue({});
      mealPrepRepo.save.mockResolvedValue({});

      await service.create(USER_ID, dto);

      expect(mealPrepRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ carbs: null, fat: null, protein: null }),
      );
    });

    it('includes ingredients as-is in the created entity', async () => {
      tagsService.upsertForUser.mockResolvedValue([makeTag('bulk')]);
      mealPrepRepo.create.mockReturnValue({});
      mealPrepRepo.save.mockResolvedValue({});

      await service.create(USER_ID, baseDto);

      expect(mealPrepRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ ingredients: baseDto.ingredients }),
      );
    });
  });

  describe('findOne', () => {
    it('returns full meal prep when id and userId match', async () => {
      const mp = makeMealPrep({ tags: [makeTag('high-protein')] });
      mealPrepRepo.findOne.mockResolvedValue(mp);

      const result = await service.findOne(USER_ID, 'mp-uuid-1');

      expect(mealPrepRepo.findOne).toHaveBeenCalledWith({
        relations: { tags: true },
        where: { id: 'mp-uuid-1', userId: USER_ID },
      });
      expect(result).toEqual(mp);
    });

    it('throws NotFoundException when id belongs to a different user', async () => {
      mealPrepRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('other-user', 'mp-uuid-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when id does not exist', async () => {
      mealPrepRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findOne(USER_ID, 'non-existent-uuid'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByUser', () => {
    const query = (
      overrides: Partial<ListMealPrepsQueryDto> = {},
    ): ListMealPrepsQueryDto => ({ limit: 20, ...overrides });

    it('returns first page with nextCursor when a full page is returned', async () => {
      const preps = Array.from({ length: 20 }, (_, i) =>
        makeMealPrep({ id: `mp-${i.toString()}` }),
      );
      mealPrepRepo.find.mockResolvedValue(preps);

      const result = await service.findByUser(USER_ID, query());

      expect(result.data).toHaveLength(20);
      expect(result.nextCursor).toBe('mp-19');
    });

    it('returns nextCursor: null when fewer items than limit are returned', async () => {
      mealPrepRepo.find.mockResolvedValue([
        makeMealPrep(),
        makeMealPrep({ id: 'mp-2' }),
      ]);

      const result = await service.findByUser(USER_ID, query());

      expect(result.nextCursor).toBeNull();
    });

    it('returns empty data and nextCursor: null when user has no meal preps', async () => {
      mealPrepRepo.find.mockResolvedValue([]);

      const result = await service.findByUser(USER_ID, query());

      expect(result).toEqual({ data: [], nextCursor: null });
    });

    it('looks up cursor record and filters by its createdAt', async () => {
      const cursorDate = new Date('2024-01-10T00:00:00Z');
      mealPrepRepo.findOne.mockResolvedValue({ createdAt: cursorDate });
      mealPrepRepo.find.mockResolvedValue([makeMealPrep()]);

      await service.findByUser(USER_ID, query({ cursor: 'cursor-uuid' }));

      expect(mealPrepRepo.findOne).toHaveBeenCalledWith({
        select: { createdAt: true },
        where: { id: 'cursor-uuid', userId: USER_ID },
      });
      expect(mealPrepRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 }),
      );
    });

    it('throws BadRequestException when cursor does not exist or belongs to another user', async () => {
      mealPrepRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findByUser(USER_ID, query({ cursor: 'bad-cursor-uuid' })),
      ).rejects.toThrow(BadRequestException);
    });

    it('defaults limit to 20 when not provided', async () => {
      mealPrepRepo.find.mockResolvedValue([]);

      await service.findByUser(USER_ID, {});

      expect(mealPrepRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 }),
      );
    });

    it('uses the provided limit', async () => {
      mealPrepRepo.find.mockResolvedValue([]);

      await service.findByUser(USER_ID, query({ limit: 5 }));

      expect(mealPrepRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });

    it('sets firstTag to the earliest-createdAt tag and tagCount to total when multiple tags', async () => {
      const older = makeTag('high-protein', new Date('2024-01-01T00:00:00Z'));
      const newer = makeTag('bulk', new Date('2024-06-01T00:00:00Z'));
      mealPrepRepo.find.mockResolvedValue([
        makeMealPrep({ tags: [newer, older] }),
      ]);

      const result = await service.findByUser(USER_ID, query());

      expect(result.data[0].firstTag).toEqual({
        id: older.id,
        name: older.name,
      });
      expect(result.data[0].tagCount).toBe(2);
    });

    it('sets firstTag and tagCount to 1 when meal prep has exactly one tag', async () => {
      const tag = makeTag('bulk');
      mealPrepRepo.find.mockResolvedValue([makeMealPrep({ tags: [tag] })]);

      const result = await service.findByUser(USER_ID, query());

      expect(result.data[0].firstTag).toEqual({ id: tag.id, name: tag.name });
      expect(result.data[0].tagCount).toBe(1);
    });

    it('sets firstTag to null and tagCount to 0 when meal prep has no tags', async () => {
      mealPrepRepo.find.mockResolvedValue([makeMealPrep({ tags: [] })]);

      const result = await service.findByUser(USER_ID, query());

      expect(result.data[0].firstTag).toBeNull();
      expect(result.data[0].tagCount).toBe(0);
    });

    it('omits instructions, createdAt, updatedAt, userId, and ingredients from list items', async () => {
      mealPrepRepo.find.mockResolvedValue([makeMealPrep()]);

      const result = await service.findByUser(USER_ID, query());
      const item = result.data[0] as unknown as Record<string, unknown>;

      expect(item).not.toHaveProperty('instructions');
      expect(item).not.toHaveProperty('createdAt');
      expect(item).not.toHaveProperty('updatedAt');
      expect(item).not.toHaveProperty('userId');
      expect(item).not.toHaveProperty('ingredients');
    });
  });
});
