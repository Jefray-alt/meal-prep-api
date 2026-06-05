import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ChatMessage } from './chat-message.entity';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  controllers: [ChatController],
  imports: [TypeOrmModule.forFeature([ChatMessage])],
  providers: [ChatService],
})
export class ChatModule {}
