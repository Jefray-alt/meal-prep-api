# Backend Spec — tag-combobox-search: Paginated Tag Search Endpoint

## Goal
Modify `GET /tags` to support pagination and server-side search so the UI can load tags incrementally without fetching the full list.

## Scope

**In scope:**
- Add `search` (optional string), `limit` (optional integer, default 10), and `offset` (optional integer, default 0) query params to `GET /tags`
- When no `search` is provided, return `limit` randomly selected tags starting at `offset`
- When `search` is provided, return tags whose name contains the search string (case-insensitive), paginated by `limit` + `offset`
- Return a `hasMore` boolean so the UI knows whether another page exists

**Out of scope:**
- Creating, updating, or deleting tags
- Cursor-based pagination
- Fuzzy/phonetic matching

## Data Model Changes

| Change | Type | Notes |
|--------|------|-------|
| None   | —    | Existing tags table is unchanged |

## API Contract

### `GET /tags`
**Auth:** required

**Request**

Query params:

| Param    | Type    | Required | Default | Constraints |
|----------|---------|----------|---------|-------------|
| `search` | string  | No       | —       | Partial, case-insensitive match on tag name |
| `limit`  | integer | No       | 10      | 1–50 inclusive |
| `offset` | integer | No       | 0       | ≥ 0 |

**Response 200**
```json
{
  "data": [
    { "id": "uuid", "name": "high-protein" },
    { "id": "uuid", "name": "low-carb" }
  ],
  "hasMore": true
}
```

**Error cases**
| Status | Condition |
|--------|-----------|
| 400    | `limit` is outside 1–50, `offset` is negative, or either is not a valid integer |
| 401    | Unauthenticated request |

## Business Logic

1. Validate `limit` — must be an integer 1–50; default to 10 if absent.
2. Validate `offset` — must be a non-negative integer; default to 0 if absent.
3. If `search` is provided and non-empty, query tags where `name ILIKE '%<search>%'` ordered by name, applying `LIMIT limit + 1 OFFSET offset`.
4. If `search` is absent or empty, fetch tags ordered randomly, applying `LIMIT limit + 1 OFFSET offset`.
5. If the query returns `limit + 1` rows, set `hasMore: true` and return only the first `limit` rows; otherwise set `hasMore: false`.

## Background Jobs / Events

None.

## Security Considerations

- Sanitise `search` via parameterised queries — never interpolate directly into SQL.
- The `limit` cap of 50 prevents large data dumps per request.
- Endpoint remains behind the existing auth guard.

## Tests

### Unit tests

| Scenario | Expected outcome |
|----------|-----------------|
| No params | Returns up to 10 tags, `hasMore` reflects total count |
| `limit=5` | Returns up to 5 tags |
| `offset=10` | Returns tags starting from position 10 |
| `search=protein` | Returns tags containing "protein", up to 10 |
| `search=protein&limit=5&offset=5` | Returns second page of "protein" matches |
| No matching tags for search | Returns `{ data: [], hasMore: false }` |
| `limit=0` | 400 Bad Request |
| `limit=51` | 400 Bad Request |
| `offset=-1` | 400 Bad Request |

### Integration / e2e tests

| `METHOD /path` | Case | Expected status |
|----------------|------|----------------|
| `GET /tags` | No params, tags exist | 200 with ≤10 items |
| `GET /tags?offset=0&limit=10` | First page | 200, `hasMore` true if >10 tags exist |
| `GET /tags?search=x` | Matching tags exist | 200 with matching items |
| `GET /tags?search=zzznomatch` | No matches | 200 with `{ data: [], hasMore: false }` |
| `GET /tags?limit=51` | Over cap | 400 |
| `GET /tags` | Unauthenticated | 401 |

## Open Questions
