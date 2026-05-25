# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run start:dev       # watch mode
npm run build           # compile to dist/

# Testing
npm run test            # unit tests (jest, rootDir: src, *.spec.ts)
npm run test:e2e        # e2e tests (test/*.e2e-spec.ts)
npm run test:cov        # coverage report

# Run a single test file
npx jest src/auth/auth.service.spec.ts

# Linting / formatting
npm run lint            # eslint --fix
npm run format          # prettier --write
```

Husky runs `eslint --fix` on staged `.ts` files via lint-staged on every commit.

## Environment

Copy `.env.example` to `.env`. Required variables:

| Variable | Purpose |
|---|---|
| `DB_HOST/PORT/USERNAME/PASSWORD/NAME` | PostgreSQL connection |
| `JWT_ACCESS_SECRET` | Signs 15-min access tokens |
| `JWT_REFRESH_SECRET` | Signs 30-day refresh tokens |
| `REFRESH_TOKEN_HMAC_SECRET` | HMAC-SHA256 key used to hash refresh tokens before DB storage |
| `NODE_ENV` | `production` disables TypeORM `synchronize` |

Database name in the example is `mise`.

## Architecture

This is a **NestJS 11 / TypeScript** REST API backed by **PostgreSQL via TypeORM**.

### Module layout

```
src/
  app.module.ts        # root — wires ConfigModule, TypeORM, ThrottlerModule, UsersModule, AuthModule
  main.ts              # bootstrap: cookieParser, global ValidationPipe (whitelist + forbidNonWhitelisted)
  auth/                # authentication feature module
  users/               # user persistence module
  migrations/          # TypeORM migration files
  types/               # shared TypeScript types (TypedRequest)
```

### Auth flow

- **Access token** (JWT, 15 min) — returned in response body; payload `{ sub, email }`.
- **Refresh token** (JWT, 30 day) — set as an `HttpOnly; Secure; SameSite=Strict` cookie scoped to `Path=/auth/refresh`. Only the HMAC-SHA256 hash of the token is persisted in `users.refresh_token_hash`.
- **Refresh rotation** — every `/auth/refresh` call issues a new refresh token and invalidates the old hash. A hash mismatch (replay) wipes the stored hash and logs a warning.
- **Logout** — verifies the cookie token, then nulls the stored hash.
- Token hashing/comparison lives in `auth/token.utils.ts` (`hashToken`, `safeCompareHex` uses `crypto.timingSafeEqual`).

### Database

- `synchronize: true` in non-production (schema auto-syncs from entities).
- Migrations live in `src/migrations/` for production schema changes.
- `autoLoadEntities: true` — entities registered via `TypeOrmModule.forFeature()` are picked up automatically.

### Throttling

`ThrottlerModule` is configured globally at 10 req / 60 s per IP. The `/auth/refresh` endpoint overrides this to 10 req / 15 min.

### Specs

`specs/` contains backend issue specs (markdown) that describe the API contracts, data model changes, and security requirements for each feature. Consult these when implementing or reviewing a feature.
