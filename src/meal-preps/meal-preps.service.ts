import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TagsService } from '../tags/tags.service';
import { CreateMealPrepDto } from './dto/create-meal-prep.dto';
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
}
