# Changelog: Core DB & Logic Implementations (Manus/dev1)

**Date:** 2026-02-14
**Author:** Manus AI

This document summarizes the significant database, server-side logic, and core type changes implemented in the `Manus/dev1` branch. These changes address the requirements for singing samples, accents, project statuses, Excel import, admin improvements, and role-centric data modeling.

## 1. Database Changes (Migration)

The following changes were applied via the `scripts/015_feature_updates_and_rls_fix.sql` migration script.

| Table                 | Change                                                                                                  | Purpose                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `actors`              | Added `singing_sample_url` (TEXT)                                                                       | Store URL for actor's singing sample.                                |
| `actors`              | Added `accents` (JSONB)                                                                                 | Store a list of accents the actor can perform.                       |
| `actor_submissions`   | Added `singing_sample_url` (TEXT)                                                                       | Capture singing sample from the intake form.                         |
| `actor_submissions`   | Added `accents` (JSONB)                                                                                 | Capture accents from the intake form.                                |
| `actor_submissions`   | Added `deleted_at` (TIMESTAMPTZ)                                                                        | Enable soft-deletion for bulk delete in the admin panel.             |
| `casting_projects`    | Updated `status` CHECK constraint to include `'voice_testing'`.                                         | Add a new status for projects in the voice testing phase.            |
| `project_roles`       | **RLS Policy Added**: `Allow authenticated users to manage project_roles`                               | **Critical Fix**: Resolves the RLS error preventing role creation.   |
| `project_roles`       | **Data Migration**: `replicas_count` was populated from `replicas_needed` where it was null.            | Consolidate replicas logic into a single source of truth.            |

## 2. Core Logic & Type Changes

### 2.1. Role-Centric Source of Truth

- **Primary Field**: `project_roles.replicas_count` is now the authoritative source for the number of replicas for a role.
- **Deprecated Field**: `project_roles.replicas_needed` is deprecated but will be kept in sync for backward compatibility.
- **Server Actions (`casting-actions.ts`, `script-actions.ts`)**: All functions that create or update roles (`createManualRole`, `applyParsedScript`, `mergeRoles`) now write to `replicas_count` and `replicas_needed` simultaneously.
- **Computed Totals**: New helper functions were added to `casting-actions.ts` to calculate total replicas:
  - `getProjectTotalReplicas(projectId)`: Returns the sum of all role replicas in a project.
  - `getActorReplicasInProject(projectId)`: Returns a map of `actor_id -> total_replicas` for actors in a project.

### 2.2. Admin Panel Improvements

- **Merge Flow**: A complete merge workflow has been implemented for duplicate submissions.
  - **UI**: The admin panel now presents three options for duplicates: **Reject**, **Create New**, or **Merge**.
  - **Merge Dialog**: A new dialog (`MergeFieldSelector`) allows for field-by-field conflict resolution.
  - **Server Action (`submission-actions.ts`)**: The `mergeSubmissionIntoActor` function handles the merge logic, auto-filling empty fields, using user choices for conflicts, and saving a `merge_report`.
- **Bulk Soft Delete**: 
  - **UI**: The "Rejected" tab now includes checkboxes and a "Delete Selected" button.
  - **Server Action (`submission-actions.ts`)**: The `softDeleteSubmissions` function performs a soft delete by setting the `deleted_at` timestamp.
- **Add Actor Drafts**:
  - A utility `lib/utils/actor-drafts.ts` was created to save "Add Actor" form progress to `localStorage`, preventing data loss.

### 2.3. Intake Form & Data Model

- **`lib/types.ts`**: Updated `Actor` and `ActorSubmission` interfaces to include `singing_sample_url` and `accents`.
- **`lib/projects/types.ts`**: Added `'voice_testing'` to the `ProjectStatus` type.
- **Intake Form (`app/intake/page.tsx`)**: The form now has separate upload fields for spoken and singing voice samples and a multi-select for accents.
- **Admin Approval**: The `handleApprove` function in the admin panel now correctly transfers `singing_sample_url` and `accents` to the new actor record.

### 2.4. Excel Import in Scripts Tab

- **File Support**: The Scripts tab now accepts `.xlsx` and `.xls` files.
- **Parser (`lib/parser/excel-parser.ts`)**: A new parser using the `xlsx` library was created to read Excel files.
- **Preview & Mapping Dialog (`excel-preview-dialog.tsx`)**: A new dialog allows users to map columns in their Excel file to `role_name` and `replicas_count`.
- **Pipeline**: The extracted roles are processed through the same `applyParsedRoles` pipeline as script files.

## 3. Risks & Edge Cases

- **Merge Logic**: The current merge logic for array fields (skills, languages, accents) is a simple union. It does not handle cases where a value was intentionally removed from the existing actor. This is a low-risk, accepted behavior for now.
- **Excel Parser**: The parser assumes a simple, flat structure. Complex Excel files with merged cells or multiple sheets may not parse correctly. The column mapping UI mitigates this by giving the user control.

## 4. Follow-up for Codex & v0

- **Codex**: Please review the new server actions (`submission-actions.ts`) and the updated `casting-actions.ts` for correctness and security. The `mergeSubmissionIntoActor` function is particularly complex.
- **v0 (UI)**:
  - The UI for the "Add Actor" form needs to be integrated with the `actor-drafts.ts` utility to save and load drafts.
  - The project page can now display computed replica totals using the new helper functions.
  - Ensure all status displays and filters correctly handle the new `'voice_testing'` status and its Hebrew label.
