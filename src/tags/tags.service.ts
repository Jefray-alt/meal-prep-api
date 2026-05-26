import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { UserTag } from './user-tag.entity';

@Injectable()
export class TagsService {
  constructor(
    @InjectRepository(UserTag)
    private tagRepo: Repository<UserTag>,
  ) {}

  findByUser(userId: string): Promise<UserTag[]> {
    return this.tagRepo.find({ order: { name: 'ASC' }, where: { userId } });
  }

  async upsertForUser(userId: string, names: string[]): Promise<UserTag[]> {
    const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];

    await this.tagRepo.upsert(
      unique.map((name) => ({ name, userId })),
      { conflictPaths: ['userId', 'name'], skipUpdateIfNoValuesChanged: true },
    );

    return this.tagRepo.find({
      order: { name: 'ASC' },
      where: { name: In(unique), userId },
    });
  }
}
