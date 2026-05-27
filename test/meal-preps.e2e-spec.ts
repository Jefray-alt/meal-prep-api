import { faker } from '@faker-js/faker';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, In } from 'typeorm';

import { AppModule } from '../src/app.module';
import { MealPrep } from '../src/meal-preps/meal-prep.entity';
import { TagSearchResult } from '../src/tags/tags.service';
import { UserTag } from '../src/tags/user-tag.entity';
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
  let otherAccessToken: string;

  const user = {
    email: faker.internet.email(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    password: faker.internet.password({ length: 12 }),
  };

  const otherUser = {
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

    const otherRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send(otherUser);
    otherAccessToken = (otherRes.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    const dataSource = app.get(DataSource);
    await dataSource
      .getRepository(MealPrep)
      .delete({ userId: In([user.email, otherUser.email]) });
    await dataSource
      .getRepository(User)
      .delete({ email: In([user.email, otherUser.email]) });
    await app.close();
  });

  describe('GET /meal-preps/:id', () => {
    let mealPrepId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/meal-preps')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validPayload)
        .expect(201);
      mealPrepId = (res.body as { id: string }).id;
    });

    it('200 with full detail for authenticated owner', async () => {
      const res = await request(app.getHttpServer())
        .get(`/meal-preps/${mealPrepId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        id: mealPrepId,
        ingredients: validPayload.ingredients,
        instructions: validPayload.instructions,
        title: validPayload.title,
      });
      expect(Array.isArray((res.body as { tags: unknown[] }).tags)).toBe(true);
      expect(res.body).toHaveProperty('createdAt');
      expect(res.body).toHaveProperty('updatedAt');
    });

    it("404 when authenticated user requests another user's meal prep", () => {
      return request(app.getHttpServer())
        .get(`/meal-preps/${mealPrepId}`)
        .set('Authorization', `Bearer ${otherAccessToken}`)
        .expect(404);
    });

    it('401 when no token is provided', () => {
      return request(app.getHttpServer())
        .get(`/meal-preps/${mealPrepId}`)
        .expect(401);
    });

    it('404 for an unknown UUID', () => {
      return request(app.getHttpServer())
        .get('/meal-preps/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('DELETE /meal-preps/:id', () => {
    let mealPrepId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/meal-preps')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validPayload)
        .expect(201);
      mealPrepId = (res.body as { id: string }).id;
    });

    it('204 and meal prep is gone on subsequent GET', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/meal-preps')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validPayload)
        .expect(201);
      const id = (createRes.body as { id: string }).id;

      await request(app.getHttpServer())
        .delete(`/meal-preps/${id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/meal-preps/${id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('401 when no token is provided', () => {
      return request(app.getHttpServer())
        .delete(`/meal-preps/${mealPrepId}`)
        .expect(401);
    });

    it('404 for a non-existent id', () => {
      return request(app.getHttpServer())
        .delete('/meal-preps/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('404 when id belongs to another user', () => {
      return request(app.getHttpServer())
        .delete(`/meal-preps/${mealPrepId}`)
        .set('Authorization', `Bearer ${otherAccessToken}`)
        .expect(404);
    });

    it('204 and orphaned tag is deleted', async () => {
      const exclusiveTag = `exclusive-${faker.string.alphanumeric(8)}`;
      const createRes = await request(app.getHttpServer())
        .post('/meal-preps')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...validPayload, tags: [exclusiveTag] })
        .expect(201);
      const id = (createRes.body as { id: string }).id;

      await request(app.getHttpServer())
        .delete(`/meal-preps/${id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      const dataSource = app.get(DataSource);
      const tag = await dataSource
        .getRepository(UserTag)
        .findOne({ where: { name: exclusiveTag } });
      expect(tag).toBeNull();
    });

    it('204 and shared tag is preserved', async () => {
      const sharedTag = `shared-${faker.string.alphanumeric(8)}`;

      const createRes = await request(app.getHttpServer())
        .post('/meal-preps')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...validPayload, tags: [sharedTag] })
        .expect(201);
      const idToDelete = (createRes.body as { id: string }).id;

      await request(app.getHttpServer())
        .post('/meal-preps')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...validPayload, tags: [sharedTag] })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/meal-preps/${idToDelete}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      const dataSource = app.get(DataSource);
      const tag = await dataSource
        .getRepository(UserTag)
        .findOne({ where: { name: sharedTag } });
      expect(tag).not.toBeNull();
    });
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

      const tagList = tagsRes.body as TagSearchResult;
      const count = tagList.data.filter((t) => t.name === sharedTag).length;
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
