# ADR 0001: Role-Centric Source of Truth

**Date**: 2026-02-14

**Status**: Proposed

## Context

The casting system is fundamentally role-centric. The core workflow involves selecting roles and assigning actors to them. The previous data model, which used `project_actors`, was ambiguous and did not clearly separate the concept of a "role" from the "actor assigned to the role". This led to confusion and made it difficult to manage complex casting scenarios, such as roles with multiple variants or roles that are not yet cast.

To address this, new tables (`project_roles`, `role_castings`) were introduced. However, the system still contains legacy fields and logic that create an inconsistent state, particularly regarding the number of replicas for a role.

## Decision

We will formally establish and enforce a strict role-centric data model. The source of truth for casting information will be as follows:

1.  **Role Definition**: The `project_roles` table is the single source of truth for all roles within a project. Each row represents a unique, castable role.

2.  **Casting Assignment**: The `role_castings` table is the single source of truth for assigning an actor to a role. It creates a one-to-one link between a `project_roles` record and an `actors` record for a given project.

3.  **Replicas Count**: The `project_roles.replicas_count` field will be the **single source of truth** for the number of replicas (lines) a role has. 
    - The existing `replicas_needed` field is **deprecated**.
    - The `role_castings.replicas_planned` and `role_castings.replicas_final` fields are also **deprecated** as they represent a duplication of data better stored on the role itself.

## Consequences

### Positive

-   **Clarity**: The data model becomes unambiguous and easier to understand for developers (including AI agents like Codex) and for building UI components.
-   **Consistency**: Eliminates the risk of data conflicts where different tables might hold different replica counts for the same role.
-   **Simplified Logic**: Server actions and client-side code for calculating totals and managing assignments will be simpler and less error-prone.

### Negative

-   **Migration Required**: A database migration is needed to consolidate replica counts into the `project_roles.replicas_count` field and mark other fields as deprecated.
-   **Code Refactoring**: All server actions and UI components that currently reference `replicas_needed`, `replicas_planned`, or `replicas_final` must be updated to use `replicas_count` from the `project_roles` table.

### Deprecations

The following fields will be marked as deprecated and are scheduled for removal in a future version. They will not be dropped from the database immediately to avoid breaking the current UI, but all new logic must not use them.

-   `project_roles.replicas_needed`
-   `role_castings.replicas_planned`
-   `role_castings.replicas_final`

All logic will be updated to read from and write to `project_roles.replicas_count` exclusively.
