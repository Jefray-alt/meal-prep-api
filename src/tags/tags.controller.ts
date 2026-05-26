import { Controller, Get, Req, UseGuards } from '@nestjs/common';

import type { AuthenticatedRequest } from '../types/authenticated-request';

import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { TagsService } from './tags.service';

@Controller('tags')
@UseGuards(JwtAccessGuard)
export class TagsController {
  constructor(private tagsService: TagsService) {}

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.tagsService.findByUser(req.user.sub);
  }
}
