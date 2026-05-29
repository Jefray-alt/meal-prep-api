# Backend Spec — edit-meal-prep: Edit Meal Prep

## Goal
Allow an authenticated user to update any field of a meal prep they own via a single PATCH endpoint.

## Scope
**In scope:** `PATCH /meal-preps/:id` endpoint, `UpdateMealPrepDto`, `update()` service method.
**Out of scope:** Bulk updates, partial ingredient patching, audit history.

## Data Model Changes

| Change | Type | Notes |
|--------|------|-------|
| None | — | `updated_at` column already exists on `meal_preps` and is managed by TypeORM `@UpdateDateColumn` |

## API Contract

### `PATCH /meal-preps/:id`
**Auth:** Required (JWT access token)

**Request**
```json
{
  "title": "Updated title",
  "instructions": "New instructions…",
  "ingredients": [{ "name": "Chicken", "quantity": "500g" }],
  "tags": ["high-protein", "batch"],
  "protein": 42,
  "carbs": 10,
  "fat": 5
}
```
All fields are optional. Only provided fields are updated.

**Response 200**
```json
{
  "id": "uuid",
  "title": "Updated title",
  "instructions": "New instructions…",
  "ingredients": [{ "name": "Chicken", "quantity": "500g" }],
  "tags": [{ "id": "uuid", "name": "high-protein" }, { "id": "uuid", "name": "batch" }],
  "protein": 42,
  "carbs": 10,
  "fat": 5,
  "userId": "uuid",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-05-29T00:00:00.000Z"
}
```

**Error cases**
| Status | Condition |
|--------|-----------|
| 400 | Validation failure (e.g. title exceeds 100 chars, ingredients array empty if provided, ingredient missing name/quantity) |
| 401 | Missing or invalid JWT |
| 404 | Meal prep not found or does not belong to the authenticated user |

## Business Logic

1. Look up the meal prep by `id` with `where: { id, userId }` — throw `NotFoundException` if not found (this also prevents accessing another user's records).
2. If `dto.tags` is provided, call `tagsService.upsertForUser(userId, dto.tags)` to resolve/create tag entities — same logic as create.
3. Merge provided fields onto the existing entity: spread `dto` scalars, replace `tags` relation only when provided.
4. Call `mealPrepRepo.save(mealPrep)` and return the saved entity.

## Background Jobs / Events
None.

## Security Considerations
- Ownership enforced at the database query level (`where: { id, userId }`) — same pattern as `findOne` and `remove`.
- All input validated via `class-validator` on `UpdateMealPrepDto` (extend `PartialType(CreateMealPrepDto)`).

## Tests

### Unit tests

| Scenario | Expected outcome |
|----------|-----------------|
| Valid partial update (title only) | Returns updated entity with new title; other fields unchanged |
| Valid full update | Returns entity with all new values; tags upserted |
| `tags` provided | `tagsService.upsertForUser` called; relation replaced |
| `tags` not provided | `tagsService.upsertForUser` NOT called; tags unchanged |
| Meal prep not found (wrong id) | Throws `NotFoundException` |
| Meal prep belongs to another user | Throws `NotFoundException` |

### Integration / e2e tests

| `METHOD /path` | Case | Expected status |
|----------------|------|----------------|
| `PATCH /meal-preps/:id` | Valid update, authenticated owner | 200 with updated body |
| `PATCH /meal-preps/:id` | Unauthenticated | 401 |
| `PATCH /meal-preps/:id` | Non-existent id | 404 |
| `PATCH /meal-preps/:id` | Id belongs to another user | 404 |
| `PATCH /meal-preps/:id` | Title exceeds 100 chars | 400 |

## Open Questions
<!--
- None
-->
