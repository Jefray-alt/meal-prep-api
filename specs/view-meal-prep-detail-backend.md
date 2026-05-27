# Backend Spec — view-meal-prep-detail: View Meal Prep Detail

## Goal
Return the full detail of a single meal prep owned by the authenticated user so the frontend can render a dedicated detail page.

## Scope
**In scope:** New `GET /meal-preps/:id` endpoint.  
**Out of scope:** Edit, delete, or sharing endpoints (future work).

## Data Model Changes

| Change | Type | Notes |
|--------|------|-------|
| None   | —    | All required fields exist on `meal_preps` and related `meal_prep_tags` / `user_tags` tables |

## API Contract

### `GET /meal-preps/:id`
**Auth:** Required (JWT access token)

**Request**
```
GET /meal-preps/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <access_token>
```

**Response 200**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "High-protein chicken bowls",
  "instructions": "1. Cook chicken...",
  "ingredients": [
    { "name": "Chicken breast", "quantity": "500g" },
    { "name": "Brown rice", "quantity": "200g" }
  ],
  "protein": 42.5,
  "carbs": 55.0,
  "fat": 8.2,
  "tags": [
    { "id": "abc", "name": "high-protein" }
  ],
  "createdAt": "2026-05-20T10:00:00.000Z",
  "updatedAt": "2026-05-27T14:30:00.000Z"
}
```

**Error cases**
| Status | Condition |
|--------|-----------|
| 401    | Missing or invalid JWT |
| 404    | Meal prep not found, or belongs to a different user |

## Business Logic

1. Extract `userId` from the JWT (`req.user.sub`).
2. Query `meal_preps` by `id` with eager-loaded `tags`, filtered by `userId`.
3. If no record found (missing or wrong owner), throw `NotFoundException`.
4. Return the entity mapped to the response shape above.

## Background Jobs / Events
None.

## Security Considerations
- Route is protected by `JwtAccessGuard` (already applied at controller level).
- Ownership is enforced by filtering on `userId` — a user cannot retrieve another user's meal prep even with a valid ID.
- `id` is a UUID; no additional sanitisation required beyond TypeORM parameterised queries.

## Tests

### Unit tests

| Scenario | Expected outcome |
|----------|-----------------|
| Valid id, correct owner | Returns full meal prep detail |
| Valid id, wrong owner | Throws `NotFoundException` |
| Non-existent id | Throws `NotFoundException` |

### Integration / e2e tests

| `METHOD /path` | Case | Expected status |
|----------------|------|----------------|
| `GET /meal-preps/:id` | Authenticated, own meal prep | 200 with full detail |
| `GET /meal-preps/:id` | Authenticated, another user's id | 404 |
| `GET /meal-preps/:id` | No auth token | 401 |
| `GET /meal-preps/:id` | Unknown UUID | 404 |

## Open Questions
<!-- None -->
