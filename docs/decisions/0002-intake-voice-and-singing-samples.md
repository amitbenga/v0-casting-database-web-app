# ADR 0002: Intake Voice and Singing Samples

**Date**: 2026-02-14

**Status**: Proposed

## Context

The current actor model includes a `voice_sample_url` for a spoken voice recording. However, for a casting system specializing in voice acting and dubbing, it is critical to differentiate between a standard voice sample and a singing sample. This allows casting directors to filter and assess talent based on both speaking and singing abilities.

## Decision

We will introduce a new, separate field for singing samples across the actor data model.

1.  **New Database Fields**:
    -   A new column `singing_sample_url` of type `TEXT` with a default value of `''` will be added to the `actors` table.
    -   A new nullable column `singing_sample_url` of type `TEXT` will be added to the `actor_submissions` table.

2.  **Intake Form Update**:
    -   The public intake form will be updated to include two distinct file upload fields:
        -   "קובץ קול (דיבור)" which maps to `voice_sample_url`.
        -   "קובץ קול (שירה)" which maps to `singing_sample_url`.

3.  **Storage Paths**:
    -   To ensure file paths are deterministic and avoid collisions, uploaded files will be stored in Supabase Storage using a structured path:
        -   Spoken voice: `public/voice-samples/{actor_id | submission_id}/{timestamp}_{filename}`
        -   Singing voice: `public/singing-samples/{actor_id | submission_id}/{timestamp}_{filename}`
    -   The server-side logic handling the upload will be responsible for generating these safe and unique paths.

4.  **Merge Behavior**:
    -   During the admin review and merge process, if a submission with a `singing_sample_url` is merged into an existing actor profile:
        -   If the existing actor's `singing_sample_url` is empty, the value from the submission will be copied over.
        -   If the existing actor already has a `singing_sample_url`, the admin will be presented with a choice to either keep the existing one or overwrite it with the new one.

## Consequences

### Positive

-   **Enhanced Filtering**: Enables precise searching for actors who are singers and provides direct access to their singing samples.
-   **Improved Casting Decisions**: Casting directors can make more informed decisions by evaluating both voice types separately.
-   **Structured Data**: The data model becomes more explicit and aligned with the business requirements of a professional casting agency.

### Negative

-   **UI Changes**: Requires modifications to the intake form and the actor profile page to accommodate the new field.
-   **Increased Storage**: Storing an additional audio file per actor will increase the overall storage consumption in Supabase Storage.
