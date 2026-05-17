# Backend Spec — Issue #1: Add user registration flow

## Goal

Enable new visitors to create a mise account so that meal-prep plans and AI chat history can be associated with a persistent identity.

## Scope

**In scope:**
- `POST /auth/register` endpoint
- `User` entity and migration
- Password hashing
- JWT access token (15 min expiry) returned in response body
- Refresh token (30-day expiry) set as an HTTP-only cookie
- `@nestjs/throttler` rate-limiting on the registration endpoint
- `AuthModule`, `UsersModule` (or equivalent NestJS modules)

**Out of scope:**
- Login endpoint (`/auth/login`)
- Token refresh endpoint (`/auth/refresh`)
- Email verification
- Social / OAuth sign-up
- Account management / profile editing

## Data Model Changes

| Change | Type | Notes |
|--------|------|-------|
| `users` table | New table | Stores registered accounts |
| `users.id` | `uuid`, PK, default `gen_random_uuid()` | — |
| `users.first_name` | `varchar(100)`, NOT NULL | — |
| `users.last_name` | `varchar(100)`, NOT NULL | — |
| `users.email` | `varchar(255)`, NOT NULL, UNIQUE | Lowercased before storage |
| `users.password_hash` | `varchar(255)`, NOT NULL | bcrypt hash, never logged |
| `users.created_at` | `timestamptz`, default `now()` | — |
| `users.updated_at` | `timestamptz`, default `now()` | Updated by trigger or TypeORM hook |

## API Contract

### `POST /auth/register`

**Auth:** Public (no token required)

**Rate limit:** 10 requests / minute per IP (via `@nestjs/throttler`)

**Request**
```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@example.com",
  "password": "supersecret123"
}
```

**Response 201**

Sets `Set-Cookie: refresh_token=<token>; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh; Max-Age=2592000`

```json
{
  "accessToken": "<jwt>",
  "user": {
    "id": "uuid",
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane@example.com"
  }
}
```

**Error cases**

| Status | Condition |
|--------|-----------|
| 400 | Any required field missing or fails validation (empty, invalid email format, password < 8 chars) |
| 409 | Email already registered — body: `{ "message": "This email is already in use." }` |
| 429 | Rate limit exceeded |

> The 409 message must not reveal whether the account was created via a third-party provider or any other detail beyond "this email is already in use."

## Business Logic

1. **Validate input** — class-validator via NestJS `ValidationPipe`: all fields required, `email` must be a valid email, `password` min length 8.
2. **Normalise email** — lowercase and trim the email before any DB lookup.
3. **Check for duplicate** — query `users` by normalised email. If found, throw `ConflictException` with the message above.
4. **Hash password** — `bcrypt.hash(password, 12)`. Never log or persist the plain-text value.
5. **Persist user** — insert a new row into `users` with the hashed password.
6. **Issue access token** — sign a JWT with payload `{ sub: user.id, email: user.email }`, expiry `15m`, using `JwtModule` / `JwtService`.
7. **Issue refresh token** — sign a separate JWT with payload `{ sub: user.id }`, expiry `30d`. Set it on the response as an HTTP-only cookie: `refresh_token`, `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/auth/refresh`, `Max-Age=2592000`.
8. **Return 201** — response body contains `accessToken` and the public user object (no `password_hash`).

## Background Jobs / Events

None for v1. A future iteration may emit a `user.registered` event for email verification.

## Security Considerations

- Passwords are hashed with bcrypt (cost factor 12) and never stored or logged in plain text.
- The refresh token cookie is `HttpOnly` and `Secure` — inaccessible to JavaScript.
- `SameSite=Strict` on the refresh cookie mitigates CSRF.
- Rate-limited to 10 req/min per IP via `@nestjs/throttler` to prevent brute-force account creation.
- The 409 duplicate-email error reveals no information beyond the fact that the email is in use.
- `ValidationPipe` with `whitelist: true, forbidNonWhitelisted: true` strips unknown properties.
- Email is normalised (lowercased) before lookup to prevent duplicate-registration bypasses.

## Open Questions

- None — all decisions confirmed with product.
