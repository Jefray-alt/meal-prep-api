# Backend Spec — delete-meal-prep: Delete Meal Prep

## Goal
Allow authenticated users to permanently delete one of their meal prep plans, including the join-table rows and any tags that become orphaned as a result.

## Scope
**In scope:**
- New `DELETE /meal-preps/:id` endpoint
- Removal of `meal_prep_tags` join rows for the deleted meal prep
- Deletion of `user_tags` rows that are no longer linked to any meal prep for this user

**Out of scope:**
- Soft-delete / archiving
- Bulk deletion

## Data Model Changes

No new tables or columns. No migration needed.

| Change | Type | Notes |
|--------|------|-------|
| None | — | Existing `meal_preps`, `meal_prep_tags`, and `user_tags` tables are sufficient |

## API Contract

### `DELETE /meal-preps/:id`
**Auth:** JWT required (`JwtAccessGuard` — already applied at controller level)

**Request**
```
No request body
```

**Response 204**
```
No response body
```

**Error cases**
| Status | Condition |
|--------|-----------|
| 401    | Missing or invalid JWT |
| 404    | No meal prep with that `id` exists, or it belongs to a different user |

## Business Logic

1. Look up the meal prep by `id` AND `userId` (from JWT `sub`), eagerly loading `tags`. Throw `NotFoundException` if not found.
2. Collect the ids of all tags currently on the meal prep.
3. Clear the tags relation (`mealPrep.tags = []`) and call `mealPrepRepo.save(mealPrep)` to remove the `meal_prep_tags` join rows.
4. Delete the meal prep row via `mealPrepRepo.remove(mealPrep)`.
5. For each collected tag id, count the number of `meal_prep_tags` rows that still reference it. If the count is 0, delete that `user_tags` row.

## Background Jobs / Events

None.

## Security Considerations

- Ownership enforced in step 1: the `userId` filter guarantees users can only delete their own meal preps.
- No additional rate limiting required beyond what the auth guard provides.

## Tests

### Unit tests

| Scenario | Expected outcome |
|----------|-----------------|
| Meal prep not found | Throws `NotFoundException` |
| Meal prep belongs to different user | Throws `NotFoundException` |
| Meal prep has no tags | Deletes meal prep; no tag deletion attempted |
| All tags also used by other meal preps | Deletes meal prep; no tags deleted |
| Some tags orphaned after deletion | Deletes meal prep; orphaned tags deleted, shared tags kept |
| All tags orphaned after deletion | Deletes meal prep and all tags |

### Integration / e2e tests

| `METHOD /path` | Case | Expected status |
|----------------|------|----------------|
| `DELETE /meal-preps/:id` | Valid owner deletes own meal prep | 204 |
| `DELETE /meal-preps/:id` | Unauthenticated request | 401 |
| `DELETE /meal-preps/:id` | Non-existent id | 404 |
| `DELETE /meal-preps/:id` | id belongs to another user | 404 |
| `DELETE /meal-preps/:id` | Tag shared with another meal prep | 204; shared tag still exists |
| `DELETE /meal-preps/:id` | Tag exclusive to this meal prep | 204; orphaned tag deleted |

## Open Questions
<!-- None -->
