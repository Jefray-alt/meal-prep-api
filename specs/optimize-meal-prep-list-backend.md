# Backend Spec — optimize-meal-prep-list: Slim GET /meal-preps Response

## Goal

Return only the fields the list page needs, reducing payload size by omitting instructions, timestamps, and the full tags array.

## Scope

**In scope:**
- Modify the `GET /meal-preps` response shape via a new `MealPrepListItemDto`
- No database schema or migration changes

**Out of scope:**
- `GET /meal-preps/:id` — continues to return the full entity
- `POST /meal-preps` — unchanged

## Data Model Changes

| Change | Type | Notes |
|--------|------|-------|
| None   | —    | No schema changes; only the serialised response shape changes |

## API Contract

### `GET /meal-preps`
**Auth:** JWT required

**Request**

```
Query params (unchanged):
  limit?  number   default 20
  cursor? string   UUID of the last item from the previous page
```

**Response 200**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Chicken & rice",
      "carbs": 45.00,
      "fat": 12.00,
      "protein": 38.00,
      "firstTag": { "id": "uuid", "name": "high-protein" },
      "tagCount": 3
    }
  ],
  "nextCursor": "uuid-of-last-item-or-null"
}
```

Fields removed vs. current response: `instructions`, `ingredients`, `createdAt`, `updatedAt`, `userId`, full `tags` array.

`firstTag` is `null` when the meal prep has no tags. `tagCount` is the total number of tags (including the first one).

**Error cases**
| Status | Condition |
|--------|-----------|
| 400    | `cursor` references an ID not owned by the requesting user |
| 401    | Missing or invalid JWT |

## Business Logic

1. Run the existing cursor-paginated `mealPrepRepo.find()` with `relations: { tags: true }` (no change to the query).
2. For each `MealPrep` in the result set, sort its `tags` array by `tag.createdAt ASC` in application code.
3. Map each entity to `MealPrepListItemDto`:
   - `firstTag` = sorted `tags[0]` (pick only `id` and `name`) or `null` if the array is empty
   - `tagCount` = `tags.length`
   - Include `id`, `title`, `carbs`, `fat`, `protein`
   - Omit `instructions`, `ingredients`, `createdAt`, `updatedAt`, `userId`
4. Return `{ data: MealPrepListItemDto[], nextCursor }`.

## Background Jobs / Events

None.

## Security Considerations

- No new fields exposed; the change only removes data from the response.
- The existing `userId` ownership check on the cursor lookup is unchanged.

## Tests

### Unit tests

| Scenario | Expected outcome |
|----------|-----------------|
| Meal prep has multiple tags | `firstTag` is the tag with the earliest `createdAt`; `tagCount` equals total tag count |
| Meal prep has exactly one tag | `firstTag` is that tag; `tagCount` is 1 |
| Meal prep has no tags | `firstTag` is `null`; `tagCount` is 0 |
| Response does not include removed fields | `instructions`, `createdAt`, `updatedAt` are absent from each item |

### Integration / e2e tests

| `METHOD /path` | Case | Expected status |
|----------------|------|----------------|
| `GET /meal-preps` | Authenticated user with meal preps | 200, items match slim shape |
| `GET /meal-preps` | Invalid cursor | 400 |
| `GET /meal-preps` | No JWT | 401 |

## Open Questions

None.
