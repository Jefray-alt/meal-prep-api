import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed'),
}));

import * as bcrypt from 'bcrypt';

const dto: RegisterDto = {
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'Jane@Example.com',
  password: 'supersecret123',
};

const savedUser = {
  id: 'uuid-1',
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  passwordHash: 'hashed',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: { findByEmail: jest.fn(), create: jest.fn() },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('token') },
        },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue('secret') },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);

    jest.clearAllMocks();
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
  });

  describe('register', () => {
    it('creates a user, hashes the password, and returns tokens with public user', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(savedUser);

      const result = await service.register(dto);

      expect(usersService.findByEmail).toHaveBeenCalledWith('jane@example.com');
      expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, 12);
      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'jane@example.com',
          passwordHash: 'hashed',
        }),
      );
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        accessToken: 'token',
        refreshToken: 'token',
        user: {
          id: 'uuid-1',
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@example.com',
        },
      });
    });

    it('normalises the email to lowercase before lookup and storage', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(savedUser);

      await service.register(dto);

      expect(usersService.findByEmail).toHaveBeenCalledWith('jane@example.com');
      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'jane@example.com' }),
      );
    });

    it('signs the access token with correct payload and options', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(savedUser);
      configService.getOrThrow.mockImplementation((key: string) =>
        key === 'JWT_ACCESS_SECRET' ? 'access-secret' : 'refresh-secret',
      );

      await service.register(dto);

      expect(jwtService.sign).toHaveBeenNthCalledWith(
        1,
        { sub: 'uuid-1', email: 'jane@example.com' },
        { secret: 'access-secret', expiresIn: '15m' },
      );
      expect(jwtService.sign).toHaveBeenNthCalledWith(
        2,
        { sub: 'uuid-1' },
        { secret: 'refresh-secret', expiresIn: '30d' },
      );
    });

    it('throws ConflictException when the email is already registered', async () => {
      usersService.findByEmail.mockResolvedValue(savedUser);

      await expect(service.register(dto)).rejects.toThrow(
        new ConflictException('This email is already in use.'),
      );
      expect(usersService.create).not.toHaveBeenCalled();
    });
  });
});
