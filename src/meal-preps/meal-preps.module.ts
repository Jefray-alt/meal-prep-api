import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { TagsModule } from '../tags/tags.module';
import { MealPrep } from './meal-prep.entity';
import { MealPrepsController } from './meal-preps.controller';
import { MealPrepsService } from './meal-preps.service';

@Module({
  controllers: [MealPrepsController],
  imports: [AuthModule, TagsModule, TypeOrmModule.forFeature([MealPrep])],
  providers: [MealPrepsService],
})
export class MealPrepsModule {}
