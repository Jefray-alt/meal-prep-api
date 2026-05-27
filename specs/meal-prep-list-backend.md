# Backend Spec — meal-prep-list: List User Meal Preps

## Goal

Expose an authenticated `GET /meal-preps` endpoint so the frontend can retrieve all meal preps belonging to the current user.

## Scope

**In scope:**
- `GET /meal-preps` returning a cursor-paginated page of the authenticated user's meal preps (id, title, tags, macros)

**Out of scope:**
- Filtering, sorting (future work)
- Meal prep detail (`GET /meal-preps/:id`)

## Data Model Changes

No schema changes — all required fields already exist on `meal_preps` and the `meal_prep_tags` join table.

| Change | Type | Notes |
|--------|------|-------|
| None   | —    | —     |

## API Contract

### `GET /meal-preps`
**Auth:** Required (JWT access token)

**Query parameters**
| Param | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `limit` | integer | No | `20` | Max items per page; clamped to 1–100 |
| `cursor` | string (UUID) | No | — | ID of the last item from the previous page; omit for first page |

**Request**
```
GET /meal-preps?limit=20
GET /meal-preps?limit=20&cursor=uuid-of-last-item
```

**Response 200**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "High-protein prep",
      "tags": [
        { "id": "uuid", "name": "High-protein" }
      ],
      "protein": 142.50,
      "carbs": null,
      "fat": 38.00
    }
  ],
  "nextCursor": "uuid-of-last-item-in-page"
}
```

`nextCursor` is `null` when there are no further items.

Macro fields (`protein`, `carbs`, `fat`) are returned as raw decimals (up to 6 digits, 2 decimal places) — formatting is the frontend's responsibility.

**Error cases**
| Status | Condition |
|--------|-----------|
| 400    | `limit` is not a positive integer or exceeds 100 |
| 400    | `cursor` is not a valid UUID |
| 401    | Missing or invalid JWT |

## Business Logic

1. Extract `userId` from the verified JWT (`req.user.sub`).
2. Validate query params: clamp `limit` to [1, 100] (default 20); if `cursor` is present, verify it is a valid UUID.
3. If `cursor` is provided, look up its `createdAt` timestamp. Return 400 if the record doesn't exist or belongs to a different user.
4. Query `meal_preps` where `userId = req.user.sub` and (if cursor present) `createdAt < cursor_record.createdAt`, eager-loading `tags`, ordered `createdAt DESC`, limited to `limit` rows.
5. If the returned page has exactly `limit` items, set `nextCursor` to the `id` of the last item; otherwise set `nextCursor` to `null`.
6. Return `{ data, nextCursor }`.

## Background Jobs / Events

None.

## Security Considerations

- `JwtAccessGuard` is already applied at controller class level — no per-route change needed.
- Only the requesting user's records are returned (filter on `userId`); no cross-user leakage possible.

## Tests

### Unit tests

| Scenario | Expected outcome |
|----------|-----------------|
| User has meal preps, no cursor | Returns first page with `nextCursor` set |
| User has meal preps, valid cursor | Returns next page relative to cursor |
| Last page (fewer items than limit) | Returns items with `nextCursor: null` |
| User has no meal preps | Returns `{ data: [], nextCursor: null }` |
| `limit` out of range | Clamped / 400 error |
| `cursor` is invalid UUID | 400 error |
| `cursor` belongs to another user | 400 error |

### Integration / e2e tests

| `METHOD /path` | Case | Expected status |
|----------------|------|----------------|
| `GET /meal-preps` | Valid JWT, no cursor | 200 + first page |
| `GET /meal-preps?cursor=<id>` | Valid cursor | 200 + next page |
| `GET /meal-preps?cursor=<id>` | Cursor from another user's record | 400 |
| `GET /meal-preps?limit=0` | Invalid limit | 400 |
| `GET /meal-preps` | No JWT | 401 |

## Open Questions

None.
