# Backend Spec — Issue #3: Persist and revoke refresh tokens

## Goal

Give the server authoritative control over session lifetime by persisting a hashed refresh token per user, enabling instant revocation, automatic rotation on every use, and replay detection that terminates compromised sessions immediately.

## Scope

**In scope:**
- Add `refreshTokenHash` column to the existing `User` entity
- `POST /auth/refresh` — validate, rotate, and re-issue tokens
- `POST /auth/logout` — server-side session termination
- HMAC-SHA256 hashing of all stored refresh tokens
- Replay detection with full session termination
- Storing the hash on login and registration (update to existing handlers)

**Out of scope:**
- Multi-session support
- Password-change revocation
- Admin-initiated revocation
- Session visibility UI
- Access token expiry changes (remains 15 min)
- Refresh token expiry changes (remains 30 days)

## Data Model Changes

| Change | Type | Notes |
|--------|------|-------|
| `User.refreshTokenHash` | `varchar` nullable | HMAC-SHA256 hex digest of the active refresh token; `null` means no active session |

**Migration:** Generate a TypeORM migration that adds a nullable `refreshTokenHash varchar` column to the `users` table. No backfill needed — existing users simply have no active server-side session until their next login.

**Environment variable required:** `REFRESH_TOKEN_HMAC_SECRET` — the secret key used for HMAC-SHA256. Must be set in `.env` and production config.

## API Contract

### `POST /auth/refresh`

**Auth:** Public (token sourced from httpOnly cookie — no Authorization header)

**Request**

No body. The refresh token is read from the `refresh_token` httpOnly cookie.

```json
{}
```

**Response 200**
```json
{
  "accessToken": "eyJ..."
}
```

**Error cases**
| Status | Condition |
|--------|-----------|
| 401    | No `refreshToken` cookie present |
| 401    | JWT signature invalid or token expired |
| 401    | User record not found |
| 401    | HMAC of incoming token does not match `refreshTokenHash` (includes replay of a previously rotated token) — stored hash is deleted and cookie is cleared before responding |

---

### `POST /auth/logout`

**Auth:** Public (token sourced from httpOnly cookie — no Authorization header)

**Request**

No body. The refresh token is read from the `refresh_token` httpOnly cookie.

```json
{}
```

**Response 200**
```json
{
  "message": "Logged out"
}
```

**Error cases**

None — always returns 200 to avoid leaking session state. If no cookie is present or the user is not found, still clear the cookie and return 200.

---

### `POST /auth/login` and `POST /auth/register` (existing — updated)

On every successful login or registration, after issuing the refresh token JWT:
1. Compute `HMAC-SHA256(refreshToken, REFRESH_TOKEN_HMAC_SECRET)`.
2. Persist the hex digest to `user.refreshTokenHash`, replacing any prior value.

No new response shape — these endpoints are unchanged from the client's perspective.

## Business Logic

### `POST /auth/refresh`

1. Read the `refresh_token` value from the httpOnly cookie. If absent, return 401.
2. Verify the JWT signature and expiry. If invalid or expired, clear the cookie and return 401.
3. Extract `userId` from the verified JWT payload.
4. Load the `User` record from the database. If not found, clear the cookie and return 401.
5. Compute `HMAC-SHA256(incomingToken, REFRESH_TOKEN_HMAC_SECRET)` → `incomingHash`.
6. Compare `incomingHash` to `user.refreshTokenHash` using a constant-time comparison.
7. **If they do not match (replay detected):**
   - Set `user.refreshTokenHash = null` (atomic DB update — invalidates the session entirely).
   - Clear the `refresh_token` cookie.
   - Log the event server-side (user ID, timestamp, IP) for anomaly monitoring.
   - Return 401.
8. Generate a new access token (15 min expiry) and a new refresh token (30 day expiry).
9. Compute `HMAC-SHA256(newRefreshToken, REFRESH_TOKEN_HMAC_SECRET)` → `newHash`.
10. **Atomically:** update `user.refreshTokenHash = newHash` in the database.
11. Set the new refresh token as an httpOnly, Secure, SameSite=Strict cookie scoped to `/auth/refresh`.
12. Return `{ accessToken }` with status 200.

### `POST /auth/logout`

1. Read the `refresh_token` value from the httpOnly cookie.
2. If present: verify the JWT to extract `userId`, load the user, and set `user.refreshTokenHash = null`. Errors at any step are swallowed — proceed to step 3 regardless.
3. Clear the `refresh_token` cookie.
4. Return `{ message: "Logged out" }` with status 200.

### Login / Registration (existing handlers)

After issuing the refresh token and before responding:
1. Compute `HMAC-SHA256(refreshToken, REFRESH_TOKEN_HMAC_SECRET)`.
2. Set `user.refreshTokenHash = digest` (replaces any previous session).

## Background Jobs / Events

None. All operations are synchronous request-response.

Server-side logging of replay events should write a structured log entry (not fire-and-forget async) so it is not lost if the process restarts. No alerting or queue integration in this issue.

## Security Considerations

- **HMAC-SHA256** uses `REFRESH_TOKEN_HMAC_SECRET` from environment. Never hard-code. Rotate the secret to invalidate all sessions globally.
- **Constant-time comparison** when comparing hashes — use `crypto.timingSafeEqual` to prevent timing-based token extraction.
- **Atomicity** — the DB update of `refreshTokenHash` must complete before the new cookie is set. If the DB write fails, do not set the cookie and return 500.
- **Cookie attributes** — cookie name `refresh_token`, `httpOnly`, `Secure`, `SameSite=Strict`, path scoped to `/auth/refresh`. The token must never appear in a response body.
- **Replay detection** — a mismatched hash means a token was used after rotation. The entire session is terminated (hash set to null), not just the request rejected. This is the most critical security invariant of this feature.
- **No plaintext storage** — `refreshTokenHash` stores only the HMAC digest. A full database dump cannot be used to forge tokens without the HMAC secret.
- **Rate limiting** — `/auth/refresh` must be rate-limited per IP to limit brute-force attempts. Use NestJS `@nestjs/throttler` with a stricter limit than the default (e.g. 10 requests / 15 min per IP).

## Tests

### Unit tests

| Scenario | Expected outcome |
|----------|-----------------|
| `hashRefreshToken(token)` produces consistent HMAC-SHA256 hex digest | Same input always yields same output |
| `hashRefreshToken(token)` with different secret produces different output | Digest differs |
| Constant-time compare returns true for identical digests | No timing attack surface |
| Constant-time compare returns false for different digests | Mismatch detected |
| `AuthService.refresh` — valid token, hash matches | Returns new access + refresh token, updates DB hash |
| `AuthService.refresh` — valid JWT but hash mismatch (replay) | Sets `refreshTokenHash = null`, throws UnauthorizedException |
| `AuthService.refresh` — no cookie | Throws UnauthorizedException |
| `AuthService.refresh` — expired JWT | Throws UnauthorizedException |
| `AuthService.logout` — valid cookie | Sets `refreshTokenHash = null`, returns success |
| `AuthService.logout` — no cookie | Returns success (no error thrown) |
| Login handler stores HMAC of issued refresh token on user | `user.refreshTokenHash` updated after login |
| Registration handler stores HMAC of issued refresh token on user | `user.refreshTokenHash` updated after registration |

### Integration / e2e tests

| `METHOD /path` | Case | Expected status |
|----------------|------|----------------|
| `POST /auth/refresh` | Valid cookie, hash matches | 200 + new `accessToken` + rotated cookie |
| `POST /auth/refresh` | No cookie | 401 |
| `POST /auth/refresh` | Expired JWT in cookie | 401 |
| `POST /auth/refresh` | Token already rotated (replay) | 401, `refreshTokenHash` is null in DB |
| `POST /auth/refresh` | Valid cookie used twice (second call is replay) | Second call returns 401, DB hash cleared |
| `POST /auth/logout` | Valid cookie | 200, `refreshTokenHash` null, cookie cleared |
| `POST /auth/logout` | No cookie | 200 |
| `POST /auth/login` | Successful login | `user.refreshTokenHash` set in DB |
| `POST /auth/register` | Successful registration | `user.refreshTokenHash` set in DB |
| Login from second device | Second login replaces first `refreshTokenHash` | First refresh token returns 401 |

## Open Questions

<!-- None at spec time -->
