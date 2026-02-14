# ADR 0003: Accents Data Model

**Date**: 2026-02-14

**Status**: Proposed

## Context

Voice actors are often required to perform with specific accents. The current data model lacks a structured way to store and filter actors based on their accent capabilities. A free-text field is not suitable as it leads to inconsistent data and makes reliable filtering impossible.

## Decision

We will add a dedicated field to store a list of accents for each actor from a predefined, closed list.

1.  **New Database Fields**:
    -   A new column `accents` of type `JSONB` with a default value of `'[]'::jsonb` will be added to the `actors` table.
    -   A new column `accents` of type `JSONB` with a default value of `'[]'::jsonb` will be added to the `actor_submissions` table. Using `JSONB` ensures consistency with the `actors` table.

2.  **Predefined Accent List**:
    -   The system will use a closed list of supported accents. The initial list will be:
        -   `french`
        -   `italian`
        -   `spanish`
        -   `german`
    -   These values will be stored in English in the database. The UI will be responsible for providing Hebrew labels (e.g., "צרפתי", "איטלקי").

3.  **Intake and Merge Logic**:
    -   The intake form will present the list of accents as a multi-select checklist.
    -   When an admin approves or merges a submission, the `accents` array from the submission will be merged with the existing actor's `accents` array. The merge logic will combine and deduplicate the lists to ensure the final actor profile has a complete and unique set of accents.

4.  **Filtering**:
    -   The `JSONB` data type allows for efficient querying. The backend will support filtering actors where the `accents` array contains one or more specified values (e.g., `accents @> '["french"]'`).

## Consequences

### Positive

-   **Structured & Reliable Data**: Storing accents in a `JSONB` array from a closed list ensures data integrity.
-   **Powerful Filtering**: Enables casting directors to quickly find actors with specific accent skills.
-   **Scalability**: The `JSONB` format is flexible and allows for easy addition of new accents to the predefined list in the future without schema changes.

### Negative

-   **Limited Scope**: The initial implementation uses a closed list. If an actor has an accent not on the list, there is no provision for a free-text "other" field. This is a deliberate choice to enforce structure, but may need to be revisited if it proves too restrictive.
