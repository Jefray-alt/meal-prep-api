import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import type { AuthenticatedRequest } from '../types/authenticated-request';

import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { CreateMealPrepDto } from './dto/create-meal-prep.dto';
import { ListMealPrepsQueryDto } from './dto/list-meal-preps-query.dto';
import { UpdateMealPrepDto } from './dto/update-meal-prep.dto';
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

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.mealPrepsService.findOne(req.user.sub, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.mealPrepsService.remove(req.user.sub, id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMealPrepDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.mealPrepsService.update(req.user.sub, id, dto);
  }
}
