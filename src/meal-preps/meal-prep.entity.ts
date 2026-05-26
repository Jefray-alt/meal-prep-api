import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { UserTag } from '../tags/user-tag.entity';

export interface Ingredient {
  name: string;
  quantity: string;
}

@Entity('meal_preps')
export class MealPrep {
  @Column({ nullable: true, precision: 6, scale: 2, type: 'decimal' })
  carbs: null | number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ nullable: true, precision: 6, scale: 2, type: 'decimal' })
  fat: null | number;

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'jsonb' })
  ingredients: Ingredient[];

  @Column({ type: 'text' })
  instructions: string;

  @Column({ nullable: true, precision: 6, scale: 2, type: 'decimal' })
  protein: null | number;

  @JoinTable({
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
    joinColumn: { name: 'meal_prep_id', referencedColumnName: 'id' },
    name: 'meal_prep_tags',
  })
  @ManyToMany(() => UserTag, (tag) => tag.mealPreps)
  tags: UserTag[];

  @Column({ length: 100 })
  title: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'user_id' })
  userId: string;
}
