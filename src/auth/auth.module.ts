import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAccessGuard } from './guards/jwt-access.guard';

@Module({
  controllers: [AuthController],
  exports: [JwtAccessGuard, JwtModule],
  imports: [UsersModule, JwtModule.register({})],
  providers: [AuthService, JwtAccessGuard],
})
export class AuthModule {}
