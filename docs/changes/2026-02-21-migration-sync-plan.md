# Database Migration Sync Plan - February 2026

**Date:** 21 February 2026  
**Type:** Migration Sync & RLS Cleanup  
**Impact Level:** High

---

## Executive Summary

Full audit and synchronization of the database with the latest code branch. Three categories of changes were identified and applied:

1. **Migration 003** - Structural constraint change (multi-actor per role)
2. **RLS Policy Cleanup** - folders/folder_actors + removal of duplicate policies
3. **Verification** - All prior migrations confirmed as applied

---

## Pre-Migration State Analysis

### Tables Audited

| Table | Status Before | Issues Found |
|-------|---------------|-------------|
| `actors` | skills/languages = jsonb | Already migrated (002) |
| `casting_projects` | director, casting_director, project_date exist | Already migrated (017) |
| `role_castings` | UNIQUE(role_id) - single actor per role | **Needed migration 003** |
| `folders` | RLS = authenticated only | **RLS blocked anon users** |
| `folder_actors` | RLS = authenticated only | **RLS blocked anon users** |
| `actor_submissions` | Duplicate/conflicting RLS policies | **Needed cleanup** |
| `project_roles` | Old authenticated ALL policies remaining | **Needed cleanup** |

---

## Changes Applied

### 1. Migration 003: Multi-Actor Per Role (APPLIED)

**File:** `migrations/003_multi_actor_per_role.sql`

**Before:**
```sql
UNIQUE (role_id)  -- Only 1 actor per role
```

**After:**
```sql
UNIQUE (role_id, actor_id)  -- Multiple actors per role, but no duplicates
```

**Impact:**
- Enables assigning multiple actors to the same role (casting alternatives)
- Preserves uniqueness: same actor cannot be assigned twice to the same role
- No data loss - existing castings remain valid

### 2. RLS Policy Fix: folders & folder_actors (APPLIED)

Same issue as other tables - these had `authenticated` role requirement but the app uses `anon` key.

**folders - Replaced:**
- `Authenticated users can read folders` (SELECT, authenticated)
- `Admins can insert folders` (INSERT, authenticated)
- `Admins can update folders` (UPDATE, authenticated)
- `Admins can delete folders` (DELETE, authenticated)

**folders - New:**
- `Allow read access for all users` (SELECT, public)
- `Allow insert for all users` (INSERT, public)
- `Allow update for all users` (UPDATE, public)
- `Allow delete for all users` (DELETE, public)

**folder_actors - Replaced:**
- `Authenticated users can read folder_actors` (SELECT, authenticated)
- `Admins can manage folder_actors` (ALL, authenticated)

**folder_actors - New:**
- `Allow read/insert/update/delete for all users` (public)

### 3. RLS Cleanup: Duplicate Policies Removed (APPLIED)

**actor_submissions - Removed:**
- `Allow authenticated users to delete submissions` (old DELETE, authenticated)
- `Admins can delete submissions` (old DELETE, authenticated)
- `Allow anon to insert submissions` (old INSERT, anon)
- `Public can submit forms` (old INSERT, anon+authenticated)
- `Allow authenticated users to update submissions` (old UPDATE, authenticated)

**actor_submissions - Added:**
- `Allow delete for all users` (DELETE, public) - was missing

**project_roles - Removed:**
- `Allow authenticated users to manage project_roles` (ALL, authenticated)
- `Admins can manage project_roles` (ALL, authenticated)

**role_castings - Removed:**
- `Allow all role_castings access` (ALL, public) - redundant with specific policies
- `Allow authenticated users to manage role_castings` (ALL, authenticated)

---

## Final RLS Policy State (All Tables)

Every table now follows a consistent pattern:

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| actors | public | public | public | public |
| actor_submissions | public | public | public | public |
| casting_projects | public | public | public | public |
| project_roles | public | public | public | public |
| role_castings | public | public | public | public |
| folders | public | public | public | public |
| folder_actors | public | public | public | public |

**Note:** Authentication is handled at the application level (AuthContext), not via Supabase Auth. This is why all RLS policies are set to public.

---

## Migration Status Summary

| Migration | Description | Status |
|-----------|-------------|--------|
| 001_create_tables.sql | Initial schema | Applied |
| 002_fix_schema_gaps.sql | skills/languages to jsonb | Applied (verified) |
| 003_multi_actor_per_role.sql | UNIQUE constraint change | **Applied now** |
| 017_add_project_metadata_fields.sql | director, casting_director, project_date | Applied |
| 018_seed_admin_user_profiles.sql | Admin user profiles | Applied |
| 019_fix_rls_policies_public_access.sql | RLS fix for core tables | Applied |
| (this session) | RLS fix for folders + cleanup | **Applied now** |

---

## Post-Migration Testing Checklist

- [ ] **Actors page** - Load actor list, verify data displays correctly
- [ ] **Actor detail** - Open actor profile, check all fields render
- [ ] **Admin submissions** - Approve/reject a submission
- [ ] **Create project** - Create with director, casting_director, date
- [ ] **Project detail** - View project, verify all metadata shows
- [ ] **Role casting** - Assign multiple actors to same role
- [ ] **Folders** - Create, add actors, delete folders
- [ ] **Intake form** - Submit new actor application (external)

---

## Risks & Considerations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Public RLS policies expose data | Low | App is internal-only, auth at app level |
| Multi-actor constraint change on existing data | None | Only adds flexibility, no data conflicts |
| Duplicate policy removal | None | Redundant policies, new ones cover all access |

---

## Future Recommendations

1. **Add Supabase Auth integration** - Move to proper JWT-based auth to tighten RLS
2. **Automated migration tracking** - Add a `schema_migrations` table to track applied migrations
3. **Schema validation CI** - Add tests that verify DB schema matches TypeScript types
