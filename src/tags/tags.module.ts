import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';
import { UserTag } from './user-tag.entity';

@Module({
  controllers: [TagsController],
  exports: [TagsService],
  imports: [AuthModule, TypeOrmModule.forFeature([UserTag])],
  providers: [TagsService],
})
export class TagsModule {}
