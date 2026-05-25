import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { hashToken, safeCompareHex } from './token.utils';

export interface PublicUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  private hmacSecret(): string {
    return this.configService.getOrThrow<string>('REFRESH_TOKEN_HMAC_SECRET');
  }

  private signAccessToken(userId: string, email: string): string {
    return this.jwtService.sign(
      { sub: userId, email },
      {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: '15m',
      },
    );
  }

  private signRefreshToken(userId: string): string {
    return this.jwtService.sign(
      { sub: userId, jti: randomUUID() },
      {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: '30d',
      },
    );
  }

  async register(dto: RegisterDto): Promise<AuthResult> {
    const email = dto.email.toLowerCase().trim();

    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new ConflictException('This email is already in use.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.usersService.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email,
      passwordHash,
    });

    const accessToken = this.signAccessToken(user.id, user.email);
    const refreshToken = this.signRefreshToken(user.id);

    await this.usersService.updateRefreshTokenHash(
      user.id,
      hashToken(refreshToken, this.hmacSecret()),
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
    };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const accessToken = this.signAccessToken(user.id, user.email);
    const refreshToken = this.signRefreshToken(user.id);

    await this.usersService.updateRefreshTokenHash(
      user.id,
      hashToken(refreshToken, this.hmacSecret()),
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
    };
  }

  async refresh(
    token: string | undefined,
  ): Promise<{ accessToken: string; newRefreshToken: string }> {
    if (!token) {
      throw new UnauthorizedException();
    }

    let payload: { sub: string; email: string };
    try {
      payload = this.jwtService.verify(token, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException();
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException();
    }

    const incomingHash = hashToken(token, this.hmacSecret());

    if (!safeCompareHex(incomingHash, user.refreshTokenHash)) {
      await this.usersService.updateRefreshTokenHash(user.id, null);
      this.logger.warn(
        `Replay detected: userId=${user.id} at ${new Date().toISOString()}`,
      );
      throw new UnauthorizedException();
    }

    const accessToken = this.signAccessToken(user.id, user.email);
    const newRefreshToken = this.signRefreshToken(user.id);

    await this.usersService.updateRefreshTokenHash(
      user.id,
      hashToken(newRefreshToken, this.hmacSecret()),
    );

    return { accessToken, newRefreshToken };
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;

    try {
      const payload = this.jwtService.verify<{ sub: string }>(token, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
      const user = await this.usersService.findById(payload.sub);
      if (user) {
        await this.usersService.updateRefreshTokenHash(user.id, null);
      }
    } catch (err) {
      this.logger.warn('Logout cleanup failed', err);
    }
  }
}
