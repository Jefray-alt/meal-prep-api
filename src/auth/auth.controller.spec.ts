import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const dto: RegisterDto = {
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  password: 'supersecret123',
};

const serviceResult = {
  accessToken: 'access.token',
  refreshToken: 'refresh.token',
  user: {
    id: 'uuid-1',
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
  },
};

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const resMock = { cookie: jest.fn() } as unknown as Response;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }])],
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: { register: jest.fn(), login: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(AuthController);
    authService = module.get(AuthService);
    jest.clearAllMocks();
  });

  describe('POST /auth/register', () => {
    it('returns accessToken and user on success', async () => {
      authService.register.mockResolvedValue(serviceResult);

      const result = await controller.register(dto, resMock);

      expect(result).toEqual({
        accessToken: 'access.token',
        user: serviceResult.user,
      });
    });

    it('sets the refresh token as an HttpOnly cookie', async () => {
      authService.register.mockResolvedValue(serviceResult);

      await controller.register(dto, resMock);

      expect(resMock.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh.token',
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          path: '/auth/refresh',
        }),
      );
    });

    it('does not expose the refreshToken in the response body', async () => {
      authService.register.mockResolvedValue(serviceResult);

      await expect(
        controller.register(dto, resMock),
      ).resolves.not.toHaveProperty('refreshToken');
    });

    it('propagates ConflictException from AuthService', async () => {
      authService.register.mockRejectedValue(
        new ConflictException('This email is already in use.'),
      );

      await expect(controller.register(dto, resMock)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('POST /auth/login', () => {
    const loginDto: LoginDto = {
      email: 'jane@example.com',
      password: 'supersecret123',
    };

    it('returns accessToken and user on success', async () => {
      authService.login.mockResolvedValue(serviceResult);

      const result = await controller.login(loginDto, resMock);

      expect(result).toEqual({
        accessToken: 'access.token',
        user: serviceResult.user,
      });
    });

    it('sets the refresh token as an HttpOnly cookie', async () => {
      authService.login.mockResolvedValue(serviceResult);

      await controller.login(loginDto, resMock);

      expect(resMock.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh.token',
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          path: '/auth/refresh',
        }),
      );
    });

    it('does not expose the refreshToken in the response body', async () => {
      authService.login.mockResolvedValue(serviceResult);

      await expect(
        controller.login(loginDto, resMock),
      ).resolves.not.toHaveProperty('refreshToken');
    });

    it('propagates UnauthorizedException from AuthService', async () => {
      authService.login.mockRejectedValue(
        new UnauthorizedException('Invalid email or password.'),
      );

      await expect(controller.login(loginDto, resMock)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
