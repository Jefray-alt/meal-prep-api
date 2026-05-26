import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';

import type { AuthenticatedRequest } from '../types/authenticated-request';

import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { FindTagsQueryDto } from './dto/find-tags-query.dto';
import { TagsService } from './tags.service';

@Controller('tags')
@UseGuards(JwtAccessGuard)
export class TagsController {
  constructor(private tagsService: TagsService) {}

  @Get()
  search(@Req() req: AuthenticatedRequest, @Query() query: FindTagsQueryDto) {
    return this.tagsService.search(
      req.user.sub,
      query.search,
      query.limit,
      query.offset,
    );
  }
}
