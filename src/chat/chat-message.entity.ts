import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type MessageRole = 'assistant' | 'user';

@Entity('chat_messages')
export class ChatMessage {
  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  role: MessageRole;

  @Column({ name: 'user_id' })
  userId: string;
}
