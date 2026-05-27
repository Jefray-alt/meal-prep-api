import { faker } from '@faker-js/faker';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, In } from 'typeorm';

import { AppModule } from '../src/app.module';
import { User } from '../src/users/user.entity';

describe('Tags (e2e)', () => {
  let app: INestApplication<App>;
  let accessToken: string;

  const user = {
    email: faker.internet.email(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    password: faker.internet.password({ length: 12 }),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ forbidNonWhitelisted: true, whitelist: true }),
    );
    await app.init();

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(user);
    accessToken = (res.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    const dataSource = app.get(DataSource);
    await dataSource.getRepository(User).delete({ email: In([user.email]) });
    await app.close();
  });

  describe('GET /tags', () => {
    it('200 with empty array when user has no tags', async () => {
      const res = await request(app.getHttpServer())
        .get('/tags')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toEqual({ data: [], hasMore: false });
    });

    it('401 when no token is provided', () => {
      return request(app.getHttpServer()).get('/tags').expect(401);
    });

    it('401 on an invalid token', () => {
      return request(app.getHttpServer())
        .get('/tags')
        .set('Authorization', 'Bearer not.a.valid.token')
        .expect(401);
    });
  });
});
