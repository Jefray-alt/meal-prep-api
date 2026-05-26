import { faker } from '@faker-js/faker';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, In } from 'typeorm';

import { AppModule } from '../src/app.module';
import { User } from '../src/users/user.entity';

const validPayload = {
  carbs: 50,
  fat: 10,
  ingredients: [{ name: 'chicken breast', quantity: '200g' }],
  instructions: 'Season and bake at 180°C for 25 minutes.',
  protein: 40,
  tags: ['bulk', 'high-protein'],
  title: 'Sunday Protein Batch',
};

describe('MealPreps (e2e)', () => {
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

  describe('POST /meal-preps', () => {
    it('201 with created meal prep on valid payload', async () => {
      const res = await request(app.getHttpServer())
        .post('/meal-preps')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validPayload)
        .expect(201);

      expect(res.body).toMatchObject({
        ingredients: validPayload.ingredients,
        instructions: validPayload.instructions,
        title: validPayload.title,
      });
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('createdAt');
      expect(Array.isArray((res.body as { tags: unknown[] }).tags)).toBe(true);
    });

    it('201 and tags stored once when same tag submitted twice in one request', async () => {
      const payload = { ...validPayload, tags: ['dedupe', 'dedupe'] };

      const res = await request(app.getHttpServer())
        .post('/meal-preps')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(payload)
        .expect(201);

      const tags = (res.body as { tags: { name: string }[] }).tags;
      const dedupeCount = tags.filter((t) => t.name === 'dedupe').length;
      expect(dedupeCount).toBe(1);
    });

    it('201 and reuses existing tag — GET /tags shows it once', async () => {
      const sharedTag = `shared-${faker.string.alphanumeric(6)}`;

      await request(app.getHttpServer())
        .post('/meal-preps')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...validPayload, tags: [sharedTag] });

      await request(app.getHttpServer())
        .post('/meal-preps')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...validPayload, tags: [sharedTag] });

      const tagsRes = await request(app.getHttpServer())
        .get('/tags')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const tagList = tagsRes.body as { name: string }[];
      const count = tagList.filter((t) => t.name === sharedTag).length;
      expect(count).toBe(1);
    });

    it('400 when title is missing', () => {
      return request(app.getHttpServer())
        .post('/meal-preps')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          carbs: validPayload.carbs,
          fat: validPayload.fat,
          ingredients: validPayload.ingredients,
          instructions: validPayload.instructions,
          protein: validPayload.protein,
          tags: validPayload.tags,
        })
        .expect(400);
    });

    it('400 when instructions is missing', () => {
      return request(app.getHttpServer())
        .post('/meal-preps')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          carbs: validPayload.carbs,
          fat: validPayload.fat,
          ingredients: validPayload.ingredients,
          protein: validPayload.protein,
          tags: validPayload.tags,
          title: validPayload.title,
        })
        .expect(400);
    });

    it('400 when ingredients array is empty', () => {
      return request(app.getHttpServer())
        .post('/meal-preps')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...validPayload, ingredients: [] })
        .expect(400);
    });

    it('400 when tags array is empty', () => {
      return request(app.getHttpServer())
        .post('/meal-preps')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...validPayload, tags: [] })
        .expect(400);
    });

    it('401 when no token is provided', () => {
      return request(app.getHttpServer())
        .post('/meal-preps')
        .send(validPayload)
        .expect(401);
    });
  });
});
