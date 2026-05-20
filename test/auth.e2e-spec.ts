import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('POST /auth/login (e2e)', () => {
  let app: INestApplication<App>;

  const validUser = {
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane.login.e2e@example.com',
    password: 'supersecret123',
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    await request(app.getHttpServer()).post('/auth/register').send(validUser);
  });

  afterAll(async () => {
    await app.close();
  });

  it('200 + accessToken in body + refresh_token cookie on valid credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: validUser.email, password: validUser.password })
      .expect(200);

    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('user');
    expect(res.body).not.toHaveProperty('refreshToken');
    expect(res.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('refresh_token=')]),
    );
  });

  it('401 on wrong password', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: validUser.email, password: 'wrongpassword123' })
      .expect(401);
  });

  it('401 on unknown email', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'somepassword' })
      .expect(401);
  });

  it('400 when password field is missing', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: validUser.email })
      .expect(400);
  });

  it('400 on invalid email format', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'not-an-email', password: 'somepassword' })
      .expect(400);
  });
});
