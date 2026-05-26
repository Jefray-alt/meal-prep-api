import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import type { MealPrep } from '../meal-preps/meal-prep.entity';

@Entity('user_tags')
@Unique(['userId', 'name'])
export class UserTag {
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToMany('MealPrep', (mealPrep: MealPrep) => mealPrep.tags)
  mealPreps: MealPrep[];

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'user_id' })
  userId: string;
}
