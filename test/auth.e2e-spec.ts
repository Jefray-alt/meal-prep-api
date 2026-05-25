import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

function extractRefreshCookie(
  headers: Record<string, string | string[]>,
): string | undefined {
  const setCookie = headers['set-cookie'];
  if (!setCookie) return undefined;
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  const entry = cookies.find((c) => c.startsWith('refresh_token='));
  if (!entry) return undefined;
  return entry.split(';')[0].replace('refresh_token=', '');
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  const loginUser = {
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane.e2e.refresh@example.com',
    password: 'supersecret123',
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    await request(app.getHttpServer()).post('/auth/register').send(loginUser);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/login (existing)', () => {
    it('200 + accessToken in body + refresh_token cookie on valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: loginUser.email, password: loginUser.password })
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
        .send({ email: loginUser.email, password: 'wrongpassword123' })
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
        .send({ email: loginUser.email })
        .expect(400);
    });

    it('400 on invalid email format', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'not-an-email', password: 'somepassword' })
        .expect(400);
    });
  });

  describe('POST /auth/refresh', () => {
    it('200 + new accessToken + rotated refresh_token cookie on valid cookie', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: loginUser.email, password: loginUser.password });

      const token = extractRefreshCookie(loginRes.headers);
      expect(token).toBeDefined();

      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', `refresh_token=${token}`)
        .expect(200);

      expect(refreshRes.body).toHaveProperty('accessToken');
      expect(refreshRes.headers['set-cookie']).toEqual(
        expect.arrayContaining([expect.stringContaining('refresh_token=')]),
      );
    });

    it('401 when no cookie is present', () => {
      return request(app.getHttpServer()).post('/auth/refresh').expect(401);
    });

    it('401 on expired or invalid JWT in cookie', () => {
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', 'refresh_token=not.a.valid.jwt')
        .expect(401);
    });

    it('401 on replay — second use of a token already rotated', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: loginUser.email, password: loginUser.password });

      const originalToken = extractRefreshCookie(loginRes.headers);
      expect(originalToken).toBeDefined();

      // First use — succeeds and rotates the token
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', `refresh_token=${originalToken}`)
        .expect(200);

      // Second use of the original token — replay detected, 401
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', `refresh_token=${originalToken}`)
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('200 and clears the cookie when a valid token is present', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: loginUser.email, password: loginUser.password });

      const token = extractRefreshCookie(loginRes.headers);
      expect(token).toBeDefined();

      const logoutRes = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', `refresh_token=${token}`)
        .expect(200);

      expect(logoutRes.body).toEqual({ message: 'Logged out' });
      expect(logoutRes.headers['set-cookie']).toEqual(
        expect.arrayContaining([expect.stringContaining('refresh_token=;')]),
      );
    });

    it('200 even when no cookie is present', () => {
      return request(app.getHttpServer()).post('/auth/logout').expect(200);
    });
  });

  describe('POST /auth/register (existing, hash side-effect)', () => {
    it('sets refresh_token cookie on successful registration', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          firstName: 'New',
          lastName: 'User',
          email: `new.user.${Date.now()}@example.com`,
          password: 'supersecret123',
        })
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.headers['set-cookie']).toEqual(
        expect.arrayContaining([expect.stringContaining('refresh_token=')]),
      );
    });
  });
});
