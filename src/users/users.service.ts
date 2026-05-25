import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  create(data: {
    email: string;
    firstName: string;
    lastName: string;
    passwordHash: string;
  }): Promise<User> {
    return this.repo.save(this.repo.create(data));
  }

  findByEmail(email: string): Promise<null | User> {
    return this.repo.findOne({ where: { email } });
  }

  findById(id: string): Promise<null | User> {
    return this.repo.findOne({ where: { id } });
  }

  async updateRefreshTokenHash(id: string, hash: null | string): Promise<void> {
    await this.repo.update(id, { refreshTokenHash: hash });
  }
}
