# Backend Spec — create-meal-prep: Save Meal Prep & Reusable User Tags

## Goal

Persist meal preps to the database owned by the authenticated user, with per-user tags that are reusable across multiple meal preps.

## Scope

**In scope:**
- `UserTag` and `MealPrep` entities with TypeORM migrations
- Many-to-many `meal_prep_tags` join table
- JWT access-token guard (new, shared)
- `GET /tags` — fetch current user's tags
- `POST /meal-preps` — create a meal prep and upsert its tags

**Out of scope:**
- Listing, updating, or deleting meal preps
- Deleting or renaming tags
- Sharing meal preps or tags across users

## Data Model Changes

| Change | Type | Notes |
|--------|------|-------|
| `user_tags` table | New entity | `id` (uuid PK), `user_id` (FK → users), `name` (varchar 100), `created_at`. Unique constraint on `(user_id, name)` |
| `meal_preps` table | New entity | `id` (uuid PK), `user_id` (FK → users), `title` (varchar 100), `instructions` (text), `carbs` / `fat` / `protein` (decimal 6,2 nullable), `ingredients` (jsonb), `created_at`, `updated_at` |
| `meal_prep_tags` table | New join table | `meal_prep_id` (FK → meal_preps), `tag_id` (FK → user_tags). Composite PK |
| Migration | New | Creates all three tables in one migration |

**`ingredients` JSONB shape:**
```json
[{ "name": "string", "quantity": "string" }]
```

## API Contract

### `GET /tags`
**Auth:** JWT access token required

**Response 200**
```json
[
  { "id": "uuid", "name": "string" }
]
```

**Error cases**
| Status | Condition |
|--------|-----------|
| 401 | Missing or invalid access token |

---

### `POST /meal-preps`
**Auth:** JWT access token required

**Request**
```json
{
  "title": "string (1–100 chars, required)",
  "instructions": "string (1–1000 chars, required)",
  "carbs": 0,
  "fat": 0,
  "protein": 0,
  "ingredients": [{ "name": "string", "quantity": "string" }],
  "tags": ["string"]
}
```

**Response 201**
```json
{
  "id": "uuid",
  "title": "string",
  "instructions": "string",
  "carbs": 0,
  "fat": 0,
  "protein": 0,
  "ingredients": [{ "name": "string", "quantity": "string" }],
  "tags": [{ "id": "uuid", "name": "string" }],
  "createdAt": "ISO 8601"
}
```

**Error cases**
| Status | Condition |
|--------|-----------|
| 400 | Validation failure (missing title, instructions, empty ingredients/tags arrays) |
| 401 | Missing or invalid access token |

## Business Logic

### `GET /tags`
1. Extract `userId` from the JWT payload (`sub` claim).
2. Query `user_tags` where `user_id = userId`, ordered by `name` ascending.
3. Return array of `{ id, name }`.

### `POST /meal-preps`
1. Extract `userId` from the JWT payload (`sub` claim). Never accept `userId` from the request body.
2. Validate the DTO (class-validator): `title` required ≤ 100 chars, `instructions` required ≤ 1000 chars, `ingredients` non-empty array, `tags` non-empty array of non-blank strings.
3. For each tag name in `tags`: upsert into `user_tags` using `INSERT … ON CONFLICT (user_id, name) DO NOTHING`, then fetch the resulting rows. This guarantees idempotency and reuse.
4. Create a new `MealPrep` row with `userId`, all scalar fields, and `ingredients` as JSONB.
5. Insert rows into `meal_prep_tags` linking the new meal prep to the resolved tag ids.
6. Return the created meal prep with its resolved `tags` array.

## Background Jobs / Events

None.

## Security Considerations

- Both endpoints are protected by the JWT access-token guard; unauthenticated requests receive `401`.
- `userId` is always derived from the verified token — it is never read from the request body or query params.
- The `(user_id, name)` unique constraint on `user_tags` prevents a user from accumulating duplicate tags regardless of race conditions.
- `ingredients` JSONB is stored as-is; no HTML is rendered server-side, so XSS via this field is not a concern at the API layer.
- Tag and ingredient arrays should be capped at a reasonable length (≤ 30 items each) via DTO validation to prevent payload abuse.

## Tests

### Unit tests

| Scenario | Expected outcome |
|----------|-----------------|
| `MealPrepsService.create` — new tags | Tags upserted, meal prep created, tags linked, response includes resolved tag objects |
| `MealPrepsService.create` — existing tag reused | No duplicate row in `user_tags`; existing tag id returned |
| `MealPrepsService.create` — userId from token only | `userId` in created row matches token `sub`, ignores any body field |
| `TagsService.findByUser` | Returns only tags belonging to the requesting user |

### Integration / e2e tests

| `METHOD /path` | Case | Expected status |
|----------------|------|----------------|
| `POST /meal-preps` | Valid payload, valid token | 201 with created meal prep |
| `POST /meal-preps` | Missing title | 400 |
| `POST /meal-preps` | Empty ingredients array | 400 |
| `POST /meal-preps` | No auth token | 401 |
| `POST /meal-preps` | Same tag submitted twice in one request | 201, tag stored once |
| `GET /tags` | Authenticated user with existing tags | 200, array of user's tags |
| `GET /tags` | No auth token | 401 |

## Open Questions

<!-- None -->
