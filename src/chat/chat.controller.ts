import type { Response } from 'express';

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';

import type { AuthenticatedRequest } from '../types/authenticated-request';

import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('chat')
@UseGuards(JwtAccessGuard)
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Get('history')
  getHistory(@Req() req: AuthenticatedRequest) {
    return this.chatService.getHistory(req.user.sub);
  }

  @HttpCode(HttpStatus.OK)
  @Post('message')
  async sendMessage(
    @Body() dto: SendMessageDto,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ): Promise<void> {
    await this.chatService.streamToResponse(req.user.sub, dto.message, res);
  }
}
