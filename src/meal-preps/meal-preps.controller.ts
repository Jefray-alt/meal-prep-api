import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import type { AuthenticatedRequest } from '../types/authenticated-request';

import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { CreateMealPrepDto } from './dto/create-meal-prep.dto';
import { ListMealPrepsQueryDto } from './dto/list-meal-preps-query.dto';
import { MealPrepsService } from './meal-preps.service';

@Controller('meal-preps')
@UseGuards(JwtAccessGuard)
export class MealPrepsController {
  constructor(private mealPrepsService: MealPrepsService) {}

  @HttpCode(HttpStatus.CREATED)
  @Post()
  create(@Body() dto: CreateMealPrepDto, @Req() req: AuthenticatedRequest) {
    return this.mealPrepsService.create(req.user.sub, dto);
  }

  @Get()
  findAll(
    @Query() query: ListMealPrepsQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.mealPrepsService.findByUser(req.user.sub, query);
  }
}
