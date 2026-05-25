import type { Response } from 'express';

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

import type { TypedRequest } from '../types/typed-request';

import {
  REFRESH_COOKIE_OPTIONS,
  REFRESH_TOKEN_MAX_AGE_MS,
} from './auth.constants';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @HttpCode(HttpStatus.OK)
  @Post('login')
  @UseGuards(ThrottlerGuard)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } =
      await this.authService.login(dto);

    res.cookie('refresh_token', refreshToken, {
      ...REFRESH_COOKIE_OPTIONS,
      maxAge: REFRESH_TOKEN_MAX_AGE_MS,
    });

    return { accessToken, user };
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(
    @Req() req: TypedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies.refresh_token;
    await this.authService.logout(token);

    res.clearCookie('refresh_token', REFRESH_COOKIE_OPTIONS);

    return { message: 'Logged out' };
  }

  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @UseGuards(ThrottlerGuard)
  async refresh(
    @Req() req: TypedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies.refresh_token;
    const { accessToken, newRefreshToken } =
      await this.authService.refresh(token);

    res.cookie('refresh_token', newRefreshToken, {
      ...REFRESH_COOKIE_OPTIONS,
      maxAge: REFRESH_TOKEN_MAX_AGE_MS,
    });

    return { accessToken };
  }

  @HttpCode(HttpStatus.CREATED)
  @Post('register')
  @UseGuards(ThrottlerGuard)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } =
      await this.authService.register(dto);

    res.cookie('refresh_token', refreshToken, {
      ...REFRESH_COOKIE_OPTIONS,
      maxAge: REFRESH_TOKEN_MAX_AGE_MS,
    });

    return { accessToken, user };
  }
}
