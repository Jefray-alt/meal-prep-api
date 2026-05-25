import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { UsersService } from '../users/users.service';
import { hashToken } from './token.utils';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed'),
  compare: jest.fn(),
}));

import * as bcrypt from 'bcrypt';

const HMAC_SECRET = 'hmac-secret';
const ACCESS_SECRET = 'access-secret';
const REFRESH_SECRET = 'refresh-secret';

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
  refreshTokenHash: null as string | null,
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
          useValue: {
            findByEmail: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            updateRefreshTokenHash: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('token'),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockImplementation((key: string) => {
              if (key === 'REFRESH_TOKEN_HMAC_SECRET') return HMAC_SECRET;
              if (key === 'JWT_ACCESS_SECRET') return ACCESS_SECRET;
              return REFRESH_SECRET;
            }),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);

    jest.clearAllMocks();
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
    jwtService.sign.mockReturnValue('token');
    configService.getOrThrow.mockImplementation((key: string) => {
      if (key === 'REFRESH_TOKEN_HMAC_SECRET') return HMAC_SECRET;
      if (key === 'JWT_ACCESS_SECRET') return ACCESS_SECRET;
      return REFRESH_SECRET;
    });
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

      await service.register(dto);

      expect(jwtService.sign).toHaveBeenNthCalledWith(
        1,
        { sub: 'uuid-1', email: 'jane@example.com' },
        { secret: ACCESS_SECRET, expiresIn: '15m' },
      );
      expect(jwtService.sign).toHaveBeenNthCalledWith(
        2,
        { sub: 'uuid-1' },
        { secret: REFRESH_SECRET, expiresIn: '30d' },
      );
    });

    it('stores the HMAC of the issued refresh token on the user', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(savedUser);

      await service.register(dto);

      expect(usersService.updateRefreshTokenHash).toHaveBeenCalledWith(
        'uuid-1',
        hashToken('token', HMAC_SECRET),
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

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'Jane@Example.com',
      password: 'supersecret123',
    };

    it('returns accessToken, refreshToken, and user on valid credentials', async () => {
      usersService.findByEmail.mockResolvedValue(savedUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(loginDto);

      expect(usersService.findByEmail).toHaveBeenCalledWith('jane@example.com');
      expect(bcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        savedUser.passwordHash,
      );
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

    it('normalises the email to lowercase before lookup', async () => {
      usersService.findByEmail.mockResolvedValue(savedUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.login(loginDto);

      expect(usersService.findByEmail).toHaveBeenCalledWith('jane@example.com');
    });

    it('stores the HMAC of the issued refresh token on the user', async () => {
      usersService.findByEmail.mockResolvedValue(savedUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.login(loginDto);

      expect(usersService.updateRefreshTokenHash).toHaveBeenCalledWith(
        'uuid-1',
        hashToken('token', HMAC_SECRET),
      );
    });

    it('throws UnauthorizedException when email is not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Invalid email or password.'),
      );
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when password does not match', async () => {
      usersService.findByEmail.mockResolvedValue(savedUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Invalid email or password.'),
      );
    });
  });

  describe('refresh', () => {
    const validToken = 'valid.refresh.token';

    it('returns new accessToken and newRefreshToken when token is valid and hash matches', async () => {
      const storedHash = hashToken(validToken, HMAC_SECRET);
      const userWithHash = { ...savedUser, refreshTokenHash: storedHash };
      jwtService.verify.mockReturnValue({
        sub: 'uuid-1',
        email: 'jane@example.com',
      });
      usersService.findById.mockResolvedValue(userWithHash);
      jwtService.sign
        .mockReturnValueOnce('new.access.token')
        .mockReturnValueOnce('new.refresh.token');

      const result = await service.refresh(validToken);

      expect(result).toEqual({
        accessToken: 'new.access.token',
        newRefreshToken: 'new.refresh.token',
      });
      expect(usersService.updateRefreshTokenHash).toHaveBeenCalledWith(
        'uuid-1',
        hashToken('new.refresh.token', HMAC_SECRET),
      );
    });

    it('throws UnauthorizedException when token is undefined', async () => {
      await expect(service.refresh(undefined)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(jwtService.verify).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when JWT is invalid or expired', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.refresh(validToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when user is not found', async () => {
      jwtService.verify.mockReturnValue({ sub: 'uuid-1' });
      usersService.findById.mockResolvedValue(null);

      await expect(service.refresh(validToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('clears refreshTokenHash and throws UnauthorizedException on replay (hash mismatch)', async () => {
      const userWithHash = {
        ...savedUser,
        refreshTokenHash: hashToken('different.token', HMAC_SECRET),
      };
      jwtService.verify.mockReturnValue({
        sub: 'uuid-1',
        email: 'jane@example.com',
      });
      usersService.findById.mockResolvedValue(userWithHash);

      await expect(service.refresh(validToken)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(usersService.updateRefreshTokenHash).toHaveBeenCalledWith(
        'uuid-1',
        null,
      );
    });
  });

  describe('logout', () => {
    it('clears refreshTokenHash when a valid token is present', async () => {
      jwtService.verify.mockReturnValue({ sub: 'uuid-1' });
      usersService.findById.mockResolvedValue(savedUser);

      await service.logout('valid.token');

      expect(usersService.updateRefreshTokenHash).toHaveBeenCalledWith(
        'uuid-1',
        null,
      );
    });

    it('returns without error when token is undefined', async () => {
      await expect(service.logout(undefined)).resolves.toBeUndefined();
      expect(jwtService.verify).not.toHaveBeenCalled();
    });

    it('swallows errors and still resolves when JWT verification fails', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt malformed');
      });

      await expect(service.logout('bad.token')).resolves.toBeUndefined();
      expect(usersService.updateRefreshTokenHash).not.toHaveBeenCalled();
    });
  });
});
