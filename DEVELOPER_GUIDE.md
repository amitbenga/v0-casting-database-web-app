# Developer Guide: Casting Database Web App

## 1. Introduction & Vision

This document provides a comprehensive guide for developers working on the Casting Database Web App. The primary goal of this application is to create a modern, efficient, and centralized platform for casting directors to manage actors, projects, and the entire casting lifecycle.

**Our Vision:** To evolve this application into a full-fledged, industry-standard Casting Management System. Future development should focus on enhancing collaboration, automating tedious tasks (like script breakdowns and conflict checks), and providing powerful analytics to support casting decisions.

---

## 2. Architecture Overview

The application is built on a modern, robust, and scalable technology stack. Understanding this architecture is crucial for effective development.

| Component           | Technology / Library                                 | Purpose & Key Concepts                                                                                             |
| ------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Framework**       | [Next.js (App Router)](https://nextjs.org/)          | Provides server-side rendering (SSR), static site generation (SSG), and a file-based routing system.               |
| **Language**        | [TypeScript](https://www.typescriptlang.org/)        | Ensures type safety, reduces runtime errors, and improves developer experience with autocompletion.                |
| **Backend & DB**    | [Supabase](https://supabase.io/)                     | An open-source Firebase alternative. We use its PostgreSQL database, Authentication, and Storage services.             |
| **UI Components**   | [shadcn/ui](https://ui.shadcn.com/)                  | A collection of beautifully designed, accessible, and reusable components built on top of Radix UI and Tailwind CSS. |
| **Styling**         | [Tailwind CSS](https://tailwindcss.com/)             | A utility-first CSS framework for rapid UI development.                                                            |
| **Data Fetching**   | [SWR](https://swr.vercel.app/)                       | A React Hooks library for data fetching that provides caching, revalidation, and real-time updates.                |
| **Form Management** | [React Hook Form](https://react-hook-form.com/)      | Manages complex forms with validation (integrated with Zod).                                                       |
| **Package Manager** | [pnpm](https://pnpm.io/)                             | A fast and disk-space-efficient package manager.                                                                   |

### Directory Structure

```
.v0-casting-database-web-app/
├── app/                # Next.js App Router. Each folder is a URL segment.
│   ├── (auth)/         # Route group for auth pages (login, signup).
│   ├── (main)/         # Route group for main protected app layout.
│   └── api/            # API routes.
├── components/         # Shared React components.
│   ├── ui/             # Unstyled components from shadcn/ui.
│   └── projects/       # Components specific to the projects feature.
├── contexts/           # Global React contexts (e.g., AuthContext).
├── lib/                # Core logic, utilities, and actions.
│   ├── actions/        # Server-side actions (database mutations).
│   ├── parser/         # Logic for parsing scripts.
│   ├── supabase/       # Supabase client and helper functions.
│   └── types.ts        # Global TypeScript type definitions.
├── public/             # Static assets (images, fonts).
├── scripts/            # Standalone scripts (e.g., for database seeding).
└── styles/             # Global CSS styles.
```

---

## 3. Development Workflow (The "Do's")

Follow these guidelines to ensure a smooth and consistent development process.

### **DO:** Local Environment Setup
1.  **Clone the repository.**
2.  **Install dependencies:** Run `pnpm install`.
3.  **Set up Environment Variables:** Create a `.env.local` file by copying `.env.example`. Fill in your Supabase Project URL and Anon Key. Refer to the `SUPABASE_SETUP_GUIDE.md` for detailed instructions.
4.  **Run the development server:** Run `pnpm run dev`.

### **DO:** Follow the Branching Strategy
- All new features or bug fixes must be developed on a feature branch created from `main`.
- Use a clear naming convention, e.g., `feat/add-actor-search` or `fix/login-bug`.
- **Never push directly to `main`**. All code must be merged via a Pull Request (PR).

### **DO:** Write Clean, Typed, and Consistent Code
- **Embrace TypeScript:** All new code must be strongly typed. Avoid using `any` unless absolutely necessary.
- **Use the Linter:** Before committing, run `pnpm run lint` to check for style issues.
- **Follow Existing Conventions:** Maintain the coding style found throughout the project.

### **DO:** Use Server Actions for Mutations
- All database writes (create, update, delete) must be handled through **Server Actions** located in the `lib/actions/` directory.
- This practice centralizes data mutation logic and enhances security by keeping it on the server side.

### **DO:** Keep Type Definitions Centralized
- All shared TypeScript interfaces and types must be defined in `lib/types.ts`. This serves as the single source of truth for our data structures.

---

## 4. Rules & Constraints (The "Don'ts")

To maintain code quality, security, and stability, adhere to the following rules.

### **DON'T:** Commit Secrets
- Never commit API keys, database connection strings, or any other sensitive information to the repository.
- Always use environment variables (`.env.local`) for secrets, and ensure `.env.local` is listed in `.gitignore`.

### **DON'T:** Bypass the Pull Request Process
- Do not push directly to the `main` branch. This is enforced to ensure code is reviewed before being merged into the primary codebase.

### **DON'T:** Add Large Dependencies Without Discussion
- The project aims to be lean. Before adding a new major library, open an issue to discuss its benefits and performance implications with the team.

### **DON'T:** Mix UI and Server Logic
- Keep server-side logic (database queries, actions) separate from your UI components.
- Use Server Actions, API routes, or data fetching hooks (`useSWR`) to create a clear boundary between the client and server.

### **DON'T:** Ignore Accessibility (a11y)
- Build components with accessibility in mind. Use semantic HTML and leverage the accessibility features provided by `shadcn/ui` and Radix UI.

---

## 5. AI-Assisted Development

This project is developed with AI coding tools:

- **Claude Code (Sonnet/Opus)** — Handles backend logic, data flow, TypeScript fixes, server actions, and database alignment. Works directly in this repository via the CLI.
- **v0.app** — Used for rapid UI prototyping and component styling. Think of it as a UI/UX co-pilot, not the final authority on architecture.

All core business logic, database interactions, and state management should be implemented and reviewed in this repository. UI changes from v0 should be integrated carefully to avoid overwriting logic.


---

## 6. Key Features & Data Models

Understanding the core features and their underlying data models is essential for extending the application effectively.

### 6.1 Actors Management

The **Actors** feature is the heart of the application. It allows casting directors to maintain a comprehensive database of actors with detailed profiles.

**Key Capabilities:**
- Create, read, update, and delete actor profiles
- Upload profile images and voice samples
- Track skills, languages, singing styles, and dubbing experience
- Filter and search actors by multiple criteria
- Mark actors as favorites
- Organize actors into custom folders
- Export actor data to PDF or Excel

**Data Model (`Actor` interface in `lib/types.ts`):**

| Field                       | Type                   | Description                                                    |
| --------------------------- | ---------------------- | -------------------------------------------------------------- |
| `id`                        | `string`               | Unique identifier (UUID)                                       |
| `full_name`                 | `string`               | Actor's full name                                              |
| `gender`                    | `Gender`               | Gender: `male`, `female`, or `other`                           |
| `birth_year`                | `number`               | Year of birth (used to calculate age)                          |
| `email`                     | `string`               | Contact email                                                  |
| `phone`                     | `string`               | Contact phone number                                           |
| `city`                      | `string`               | City of residence                                              |
| `image_url`                 | `string`               | URL to profile image (stored in Supabase Storage)             |
| `voice_sample_url`          | `string`               | URL to voice sample audio file                                 |
| `is_singer`                 | `boolean`              | Whether the actor can sing                                     |
| `is_course_grad`            | `boolean`              | Whether the actor graduated from a professional acting course  |
| `vat_status`                | `VatStatus`            | Tax status: `ptor`, `murshe`, or `artist_salary`              |
| `skills`                    | `Skill[]`              | Array of skills (e.g., accents, carpentry)                     |
| `languages`                 | `Language[]`           | Languages the actor speaks                                     |
| `dubbing_experience_years`  | `number`               | Years of dubbing experience                                    |
| `singing_styles`            | `SingingStyleWithLevel[]` | Singing styles with proficiency levels                      |
| `notes`                     | `string`               | Internal notes about the actor                                 |
| `is_draft`                  | `boolean`              | Whether the profile is a draft (incomplete)                    |

### 6.2 Projects & Casting

The **Projects** feature manages casting projects from initial setup through final casting decisions.

**Key Capabilities:**
- Create and manage casting projects
- Upload and parse scripts to extract roles automatically
- Manually add or edit roles
- Assign actors to roles with status tracking (audition, casting, cast)
- Detect role conflicts (when the same actor is cast in overlapping scenes)
- Track replica counts per role

**Data Models:**

**Project:**
| Field               | Type            | Description                                  |
| ------------------- | --------------- | -------------------------------------------- |
| `id`                | `string`        | Unique identifier                            |
| `name`              | `string`        | Project name                                 |
| `status`            | `ProjectStatus` | Current status (e.g., `casting`, `recording`) |
| `director`          | `string`        | Director's name                              |
| `casting_director`  | `string`        | Casting director's name                      |
| `notes`             | `string`        | Project notes                                |

**ProjectRole:**
| Field             | Type     | Description                                  |
| ----------------- | -------- | -------------------------------------------- |
| `id`              | `string` | Unique identifier                            |
| `project_id`      | `string` | Foreign key to project                       |
| `role_name`       | `string` | Name of the role/character                   |
| `replicas_count`  | `number` | Number of lines/replicas for this role       |
| `parent_role_id`  | `string` | For nested roles (e.g., "Guard 1" under "Guards") |

**RoleCasting:**
| Field              | Type            | Description                                  |
| ------------------ | --------------- | -------------------------------------------- |
| `id`               | `string`        | Unique identifier                            |
| `role_id`          | `string`        | Foreign key to role                          |
| `actor_id`         | `string`        | Foreign key to actor                         |
| `status`           | `CastingStatus` | Status: `באודישן`, `בליהוק`, or `מלוהק`     |
| `replicas_planned` | `number`        | Planned number of replicas for this actor    |
| `replicas_final`   | `number`        | Final number of replicas recorded            |

### 6.3 Script Parsing

The application includes an intelligent script parser that can extract roles and replica counts from uploaded script files (PDF, DOCX).

**How it works:**
1. User uploads a script file to a project
2. The parser processes the file and extracts character names and dialogue counts
3. Extracted roles are stored with a `source: "script"` flag
4. User can review and apply the parsed roles to the project
5. The system automatically detects potential conflicts (same actor in overlapping roles)

**Important:** The parser is a helpful tool but not perfect. Always review parsed results before applying them to a project.

---

## 7. Database Schema & Supabase

The application uses **Supabase** (PostgreSQL) as its backend database. Understanding the schema is crucial for writing effective queries and server actions.

### Core Tables

| Table Name                  | Purpose                                                  | Key Relationships                          |
| --------------------------- | -------------------------------------------------------- | ------------------------------------------ |
| `actors`                    | Stores actor profiles                                    | Referenced by `favorites`, `role_casting`  |
| `actor_submissions`         | Raw submissions from the external intake form (scprodub) | Admin approves → inserts/updates `actors`  |
| `casting_projects`          | Stores casting projects                                  | Referenced by `project_roles`, `scripts`   |
| `project_roles`             | Stores roles within projects                             | References `casting_projects`, referenced by `role_casting` |
| `role_casting`              | Links actors to roles with casting status                | References `actors`, `project_roles`       |
| `favorites`                 | Tracks user's favorite actors                            | References `actors`, `user_profiles`       |
| `folders`                   | Custom actor folders                                     | Referenced by `folder_actors`              |
| `folder_actors`             | Many-to-many relationship between folders and actors     | References `folders`, `actors`             |
| `casting_project_scripts`   | Stores uploaded script files and parsing status          | References `casting_projects`              |
| `script_extracted_roles`    | Roles extracted from scripts (before applying)           | References `casting_project_scripts`       |
| `script_casting_warnings`   | Detected conflicts between role assignments              | References `project_roles`                 |

### Important Schema Notes

- `actors.skills` and `actors.languages` are **JSONB** columns (not text arrays). Each item is an object: `{ id: string, key: string, label: string }`.
- `actors.vat_status` valid values: `"ptor"` | `"murshe"` | `"artist_salary"` (Hebrew tax status categories).
- `actors.id` is `text` (not UUID).
- The external form (scprodub repo) writes skills/languages as plain Hebrew strings into `actor_submissions`. The admin approval flow in `app/admin/page.tsx` converts them to the `{id, key, label}` format before inserting into `actors`.

### External Intake Form

A separate public-facing repository (`scprodub`) provides the actor intake form at a different URL. It writes directly to `actor_submissions` in the same Supabase project. The `app/admin/page.tsx` page in this repo is used to review and approve these submissions, merging them into the `actors` table.

Data flow: **scprodub form → `actor_submissions` → admin approval → `actors`**

### Row Level Security (RLS)

Supabase uses **Row Level Security** to control data access. All tables have RLS policies that ensure users can only access data they're authorized to see. When writing queries, always use the authenticated Supabase client to ensure policies are enforced.

**Example:**
```typescript
const supabase = createClient() // Uses auth context
const { data, error } = await supabase.from('actors').select('*')
// RLS automatically filters results based on user permissions
```

---

## 8. Performance Best Practices

As the database grows, performance becomes critical. Follow these guidelines to ensure the application remains fast and responsive.

### 8.1 Use Cursor-Based Pagination

For large datasets (like the actors list), use **cursor-based pagination** instead of offset-based pagination. This is significantly faster and more efficient.

**Example (already implemented in `app/page.tsx`):**
```typescript
const getKey = (pageIndex, previousPageData) => {
  if (pageIndex === 0) return ["actors", null]
  if (!previousPageData?.nextCursor) return null
  return ["actors", previousPageData.nextCursor]
}

const { data, size, setSize } = useSWRInfinite(
  getKey,
  ([, cursor]) => fetchActorsPage(cursor),
  { revalidateOnFocus: false }
)
```

### 8.2 Select Only Required Fields

When querying the database, always specify the exact fields you need. Avoid `select('*')` in production code.

**Good:**
```typescript
const { data } = await supabase
  .from('actors')
  .select('id, full_name, image_url, gender')
```

**Bad:**
```typescript
const { data } = await supabase.from('actors').select('*')
```

### 8.3 Use Memoization

For expensive computations (filtering, sorting, transformations), use `useMemo` to avoid recalculating on every render.

```typescript
const filteredActors = useMemo(() => {
  return actors.filter(actor => /* complex filtering logic */)
}, [actors, filterCriteria])
```

### 8.4 Leverage SWR Caching

SWR automatically caches data and revalidates in the background. Configure appropriate cache durations based on how frequently data changes.

```typescript
useSWR(key, fetcher, {
  dedupingInterval: 60000, // Don't refetch within 60 seconds
  revalidateOnFocus: false, // Don't refetch when window regains focus
})
```

---

## 9. Testing & Quality Assurance

### Automated Tests (Vitest)

The project has **77 unit tests** covering the script parser, fuzzy matcher, and pipeline logic.

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test --watch
```

Test files are located in:
- `lib/parser/__tests__/script-parser.test.ts`
- `lib/parser/__tests__/fuzzy-matcher.test.ts`
- `lib/parser/__tests__/pipeline.test.ts`

Configuration: `vitest.config.ts`

### Pre-Merge Checklist

- [ ] Run `pnpm exec tsc --noEmit` - No TypeScript errors
- [ ] Run `pnpm test` - All 77 tests pass
- [ ] Run `pnpm run lint` - No linting errors
- [ ] Run `pnpm run build` - Build completes successfully
- [ ] Test all modified features in the browser
- [ ] Test on both desktop and mobile viewports
- [ ] Check browser console for errors or warnings
- [ ] Verify database operations work correctly (create, read, update, delete)

---

## 10. Deployment

The application is deployed on **Vercel** and automatically deploys when changes are pushed to the `main` branch.

### Deployment Checklist

Before merging to `main`, ensure:
1. All environment variables are set in Vercel dashboard
2. Supabase database migrations are applied
3. Build succeeds locally (`pnpm run build`)
4. No breaking changes to existing features

### Environment Variables (Production)

These must be set in the Vercel dashboard:

| Variable                    | Description                          |
| --------------------------- | ------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`  | Your Supabase project URL            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anonymous key      |

---

## 11. Troubleshooting Common Issues

### Issue: TypeScript errors after pulling latest changes

**Solution:** Run `pnpm install` to ensure all dependencies are up to date, then restart your IDE/TypeScript server.

### Issue: Supabase client returns empty results

**Solution:** Check that Row Level Security policies are correctly configured. You may need to adjust policies in the Supabase dashboard.

### Issue: Build fails on Vercel but works locally

**Solution:** Check the Vercel build logs for specific errors. Common causes include:
- Missing environment variables
- TypeScript errors that were ignored locally
- Dependency version mismatches

---

## 12. Contributing

We welcome contributions! Here's how to get started:

1. **Fork the repository** and create a feature branch
2. **Make your changes** following the guidelines in this document
3. **Test thoroughly** using the pre-merge checklist
4. **Submit a Pull Request** with a clear description of your changes
5. **Respond to feedback** from code reviewers

### Commit Message Convention

Use clear, descriptive commit messages following this format:

```
<type>: <short description>

<optional longer description>
```

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, no logic change)
- `refactor:` - Code refactoring
- `perf:` - Performance improvements
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

**Example:**
```
feat: add actor search by city

Implemented a new filter in the actors page that allows
searching by city. Updated the FilterPanel component and
added city to the FilterState interface.
```

---

## 13. Roadmap & Future Enhancements

Here are some ideas for future development. Feel free to pick up any of these or propose your own!

### Short-term (Next 3 months)
- Implement automated testing (unit + integration)
- Add bulk operations for actors (bulk edit, bulk delete)
- Improve script parser accuracy
- Add actor availability calendar
- Implement role templates for common character types

### Medium-term (3-6 months)
- Multi-user collaboration features (comments, notifications)
- Advanced analytics dashboard (casting statistics, actor utilization)
- Integration with external casting platforms
- Mobile app (React Native)
- Voice sample comparison tool

### Long-term (6+ months)
- AI-powered actor recommendations based on role requirements
- Automated conflict detection using NLP on scripts
- Video audition management
- Contract and payment tracking
- Multi-language support

---

## 14. Getting Help

If you're stuck or have questions:

1. **Check existing documentation** in the `docs/` folder
2. **Review closed issues** on GitHub - your question may have been answered
3. **Open a new issue** with a clear description of your problem
4. **Reach out to the team** via your preferred communication channel

---

## 15. License & Credits

This project is proprietary and confidential. All rights reserved.

**Built with:**
- [Next.js](https://nextjs.org/)
- [Supabase](https://supabase.io/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)

**Documentation maintained by:** Development Team

**Last updated:** February 2026

---

*Happy coding! Build something amazing.* 🚀
