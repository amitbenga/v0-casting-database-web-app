# Multi-Actor Casting — Single מלוהק Enforcement

**Date:** 2026-03-10
**Migration:** 008_multi_actor_per_role.sql

## Current State

After migration 008, `role_castings` has `UNIQUE(role_id, actor_id)` — multiple actors can be assigned to the same role.

The business rule "only one actor per role should have status מלוהק" is enforced **in application code only**, at two points:

1. **`assignActorToRole()`** — when a new actor is assigned, the function checks if another actor already has `status = 'מלוהק'` for that role. If yes, the new actor defaults to `'באודישן'`.
2. **`updateCastingStatus()`** — when changing status to `'מלוהק'`, the function checks for an existing `'מלוהק'` actor on the same role. If found, returns an error.

## Race Condition Risk

Two concurrent requests could both read "no existing מלוהק" and both set their actor to `'מלוהק'`, resulting in two מלוהק actors on the same role.

**Likelihood:** Low. The app has a small user base (2-3 admins), and two users simultaneously casting the same role is unlikely.

**Impact:** If it happens, two actors would show as מלוהק for the same role. Script line assignments (`script_lines.actor_id`) would reflect whichever write completed last.

## Future DB-Level Enforcement (Not Implemented Yet)

A partial unique index could enforce this at the database level:

```sql
CREATE UNIQUE INDEX idx_one_meloohak_per_role
  ON role_castings (role_id)
  WHERE status = 'מלוהק';
```

This would guarantee at most one `'מלוהק'` per role regardless of concurrent requests. The application code guards should remain as well to provide user-friendly error messages.

**Decision:** Not implemented now. The application-level guard is sufficient for current usage. Revisit if the user base grows or if concurrent editing becomes a real scenario.
