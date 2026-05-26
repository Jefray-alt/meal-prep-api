import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { MealPrepsModule } from './meal-preps/meal-preps.module';
import { TagsModule } from './tags/tags.module';
import { UsersModule } from './users/users.module';

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        autoLoadEntities: true,
        database: config.getOrThrow('DB_NAME'),
        host: config.getOrThrow('DB_HOST'),
        password: config.getOrThrow('DB_PASSWORD'),
        port: config.get<number>('DB_PORT', 5432),
        // synchronize keeps schema in sync automatically in dev; use migrations in prod
        synchronize: config.get('NODE_ENV') !== 'production',
        type: 'postgres',
        username: config.getOrThrow('DB_USERNAME'),
      }),
    }),
    ThrottlerModule.forRoot([{ limit: 10, ttl: 60_000 }]),
    UsersModule,
    AuthModule,
    TagsModule,
    MealPrepsModule,
  ],
  providers: [AppService],
})
export class AppModule {}
