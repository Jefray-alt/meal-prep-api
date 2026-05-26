import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { TagsService } from '../tags/tags.service';
import { UserTag } from '../tags/user-tag.entity';
import { CreateMealPrepDto } from './dto/create-meal-prep.dto';
import { MealPrep } from './meal-prep.entity';
import { MealPrepsService } from './meal-preps.service';

const USER_ID = 'user-uuid-1';

const makeTag = (name: string): UserTag =>
  ({ id: `tag-${name}`, name, userId: USER_ID }) as UserTag;

const baseDto: CreateMealPrepDto = {
  carbs: 50,
  fat: 10,
  ingredients: [{ name: 'chicken', quantity: '200g' }],
  instructions: 'Cook the chicken.',
  protein: 40,
  tags: ['bulk', 'high-protein'],
  title: 'Sunday Batch',
};

describe('MealPrepsService', () => {
  let service: MealPrepsService;
  let mealPrepRepo: { create: jest.Mock; save: jest.Mock };
  let tagsService: jest.Mocked<TagsService>;

  beforeEach(async () => {
    mealPrepRepo = { create: jest.fn(), save: jest.fn() };
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
      const tags = baseDto.tags.map(makeTag);
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
});
