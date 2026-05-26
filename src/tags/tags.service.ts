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

  async search(
    userId: string,
    search: string | undefined,
    limit: number,
    offset: number,
  ): Promise<{ data: UserTag[]; hasMore: boolean }> {
    const qb = this.tagRepo
      .createQueryBuilder('tag')
      .where('tag.userId = :userId', { userId })
      .limit(limit + 1)
      .offset(offset);

    if (search?.trim()) {
      qb.andWhere('tag.name ILIKE :search', { search: `%${search}%` }).orderBy(
        'tag.name',
        'ASC',
      );
    } else {
      qb.orderBy('RANDOM()');
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    return { data: rows.slice(0, limit), hasMore };
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
