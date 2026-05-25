import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ length: 255, unique: true })
  email: string;

  @Column({ length: 100, name: 'first_name' })
  firstName: string;

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100, name: 'last_name' })
  lastName: string;

  @Column({ length: 255, name: 'password_hash' })
  passwordHash: string;

  @Column({
    default: null,
    name: 'refresh_token_hash',
    nullable: true,
    type: 'varchar',
  })
  refreshTokenHash: null | string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
