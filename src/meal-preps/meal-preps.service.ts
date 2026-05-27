import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';

import { TagsService } from '../tags/tags.service';
import { CreateMealPrepDto } from './dto/create-meal-prep.dto';
import { ListMealPrepsQueryDto } from './dto/list-meal-preps-query.dto';
import { MealPrep } from './meal-prep.entity';

@Injectable()
export class MealPrepsService {
  constructor(
    @InjectRepository(MealPrep)
    private mealPrepRepo: Repository<MealPrep>,
    private tagsService: TagsService,
  ) {}

  async create(userId: string, dto: CreateMealPrepDto): Promise<MealPrep> {
    const tags = await this.tagsService.upsertForUser(userId, dto.tags);

    const mealPrep = this.mealPrepRepo.create({
      carbs: dto.carbs ?? null,
      fat: dto.fat ?? null,
      ingredients: dto.ingredients,
      instructions: dto.instructions,
      protein: dto.protein ?? null,
      tags,
      title: dto.title,
      userId,
    });

    return this.mealPrepRepo.save(mealPrep);
  }

  async findByUser(
    userId: string,
    query: ListMealPrepsQueryDto,
  ): Promise<{ data: MealPrep[]; nextCursor: null | string }> {
    const limit = query.limit ?? 20;

    let cursorCreatedAt: Date | undefined;
    if (query.cursor) {
      const cursorRecord = await this.mealPrepRepo.findOne({
        select: { createdAt: true },
        where: { id: query.cursor, userId },
      });
      if (!cursorRecord) throw new BadRequestException('Invalid cursor');
      cursorCreatedAt = cursorRecord.createdAt;
    }

    const data = await this.mealPrepRepo.find({
      order: { createdAt: 'DESC' },
      relations: { tags: true },
      take: limit,
      where: {
        ...(cursorCreatedAt ? { createdAt: LessThan(cursorCreatedAt) } : {}),
        userId,
      },
    });

    const nextCursor = data.length === limit ? data[data.length - 1].id : null;

    return { data, nextCursor };
  }

  async findOne(userId: string, id: string): Promise<MealPrep> {
    const mealPrep = await this.mealPrepRepo.findOne({
      relations: { tags: true },
      where: { id, userId },
    });
    if (!mealPrep) throw new NotFoundException();
    return mealPrep;
  }
}
