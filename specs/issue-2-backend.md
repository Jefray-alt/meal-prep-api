# Backend Spec — Issue #2: Add login page with guest-only route guard

## Goal

Allow registered mise users to authenticate with email and password, restoring their access token and refresh token session identically to the registration flow.

## Scope

**In scope:**
- `POST /auth/login` endpoint
- `LoginDto` validation
- Credential verification against the existing `User` entity
- Access token + refresh token issuance (same shape as registration)
- Rate limiting via `ThrottlerGuard`

**Out of scope:**
- Forgot password / password reset
- OAuth / social login
- Account lockout after N failed attempts
- Token refresh endpoint (pre-existing concern)

## Data Model Changes

No schema changes. Login reads the existing `users` table via `UsersService`.

| Change | Type | Notes |
|--------|------|-------|
| None   | —    | —     |

## API Contract

### `POST /auth/login`
**Auth:** Public

**Request**
```json
{
  "email": "jane@example.com",
  "password": "plaintextpassword"
}
```

**Response 200**
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

Sets `Set-Cookie: refresh_token=<jwt>; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh; Max-Age=2592000`

**Error cases**
| Status | Condition |
|--------|-----------|
| 400    | Request body fails DTO validation (missing fields, invalid email format) |
| 401    | Email not found or password does not match — always the same vague message: "Invalid email or password." |
| 429    | Rate limit exceeded |

## Business Logic

1. Normalise `email`: lowercase + trim (mirrors registration).
2. Look up the user by email via `UsersService.findByEmail`. If not found, throw `UnauthorizedException` with message `"Invalid email or password."`.
3. Compare the supplied password against the stored `passwordHash` using `bcrypt.compare`. If mismatch, throw `UnauthorizedException` with the same message.
4. Sign a short-lived access token (`sub: user.id`, `email: user.email`) using `JWT_ACCESS_SECRET` (15 m expiry).
5. Sign a long-lived refresh token (`sub: user.id`) using `JWT_REFRESH_SECRET` (30 d expiry).
6. Set `refresh_token` as an httpOnly, Secure, `SameSite: Strict` cookie scoped to `/auth/refresh` with a 30-day `Max-Age` — identical cookie policy to registration.
7. Return `{ accessToken, user: { id, firstName, lastName, email } }`.

## Background Jobs / Events

None.

## Security Considerations

- The 401 message is intentionally vague — never reveal whether the email exists or only the password was wrong.
- Passwords must never appear in logs or error responses.
- `ThrottlerGuard` applied at the handler level, same as `/auth/register`.
- `bcrypt.compare` timing is inherently constant-time; no additional mitigation needed.
- Refresh token cookie policy: `HttpOnly`, `Secure`, `SameSite: Strict`, path-scoped to `/auth/refresh`.

## Tests

### Unit tests

| Scenario | Expected outcome |
|----------|-----------------|
| Valid email + correct password | Returns `{ accessToken, refreshToken, user }` |
| Email not found | Throws `UnauthorizedException("Invalid email or password.")` |
| Email found, wrong password | Throws `UnauthorizedException("Invalid email or password.")` |
| Email is stored in mixed case, login attempt uses different case | Normalised before lookup — succeeds |

### Integration / e2e tests

| `METHOD /path` | Case | Expected status |
|----------------|------|----------------|
| `POST /auth/login` | Valid credentials | 200 + body has `accessToken` + cookie set |
| `POST /auth/login` | Wrong password | 401 |
| `POST /auth/login` | Unknown email | 401 |
| `POST /auth/login` | Missing `password` field | 400 |
| `POST /auth/login` | Invalid email format | 400 |

## Open Questions

- [ ] None — all decisions resolved.
