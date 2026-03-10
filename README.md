# Casting Database Web App

A modern, full-featured casting management system built with Next.js, TypeScript, and Supabase.

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/amit-2370s-projects/v0-casting-database-web-app)
[![Built with Next.js](https://img.shields.io/badge/Built%20with-Next.js-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Powered by Supabase](https://img.shields.io/badge/Powered%20by-Supabase-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.io/)

---

## 🎯 Overview

This application provides casting directors with a comprehensive platform to manage actors, projects, and the entire casting lifecycle. From maintaining detailed actor profiles to parsing scripts and tracking role assignments, this system streamlines the casting process from start to finish.

**Key Features:**
- **Actor Database:** Comprehensive profiles with skills, languages, voice samples, and more
- **Public Intake Form:** Actors submit profiles via a separate public form (scprodub repo) → admin reviews and approves
- **Project Management:** Organize casting projects with roles, assignments, and status tracking
- **Script Parsing:** Automatically extract roles and dialogue counts from uploaded scripts (77 unit tests)
- **Casting Workspace:** Unified script table with fixed-column layout, inline Hebrew translation editing, per-actor recording progress, and rec-status tracking
- **Script Upload Centralized:** Script upload is available only via the "תסריטים" tab; the workspace and roles tabs are read-only consumers
- **Conflict Detection:** Identify scheduling conflicts when the same actor is cast in multiple roles
- **Advanced Search & Filtering:** Find the perfect actor using multiple criteria
- **Collaboration Tools:** Favorites, folders, and notes for team coordination

**Architecture Note:** This app shares a Supabase database with a separate public intake form repo (scprodub). Actor submissions flow from the form → `actor_submissions` table → admin approval page → `actors` table.

---

## Recent Changes

### Workspace & Script Flow (March 2026)

**Script upload centralized**
- Upload is now only possible from the "תסריטים" tab. The workspace empty-state guides users there instead of offering a redundant upload button.

**Role → Script line linking (`backfillScriptLinesRoleIds`)**
- After every `saveScriptLines` call, a new internal helper automatically matches `script_lines.role_id` to `project_roles` by normalized `role_name`. This fixes the "0% progress" issue that appeared when all lines lacked a `role_id`.

**`project_summary` view fixed**
- `total_lines` and `recorded_lines` are now counted directly from `script_lines` (subquery), independent of the `project_scripts` join that was always empty.

**Actor name in workspace**
- After assigning an actor in Casting Workspace, `syncActorsToScriptLines` runs automatically so the workspace table immediately shows the actor's name.

**Translation post-processing**
- `parseTranslationResponse` strips a leading `CHARACTER:` prefix from AI responses, so the translation column never shows the character name.

**Actor recording progress panel**
- Collapsible panel (closed by default) above the workspace table. Click to expand; select a pill to see a single actor's progress bar and line count.

**Fixed-height table rows**
- Removed `measureElement` from the virtualizer. All rows are `44px` tall with `overflow: hidden`. The `TranslationCell` is `h-8` and truncates with a tooltip on hover.

**No-audio indicator**
- Actor cards with no `voice_sample_url` show a Play icon with a red diagonal slash instead of nothing or a faint grey button.

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and **pnpm** installed
- A **Supabase** account and project
- Basic knowledge of **Next.js** and **TypeScript**

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/amitbenga/v0-casting-database-web-app.git
   cd v0-casting-database-web-app
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` and add your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

4. **Set up the database:**
   Follow the instructions in `SUPABASE_SETUP_GUIDE.md` to create the necessary tables and configure Row Level Security.

5. **Run the development server:**
   ```bash
   pnpm run dev
   ```

6. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

---

## 📚 Documentation

Comprehensive documentation is available to help you understand and contribute to the project:

| Document                       | Description                                                      |
| ------------------------------ | ---------------------------------------------------------------- |
| **[DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)** | Complete guide for developers: architecture, best practices, rules |
| **[SUPABASE_SETUP_GUIDE.md](./SUPABASE_SETUP_GUIDE.md)** | Step-by-step Supabase database setup instructions |
| **[AUTH_SETUP_GUIDE.md](./AUTH_SETUP_GUIDE.md)** | Authentication configuration and user management |
| **[WORKFLOW.md](./WORKFLOW.md)** | Development workflow and collaboration guidelines |
| **[SECURITY_AUDIT_REPORT.md](./SECURITY_AUDIT_REPORT.md)** | Security considerations and audit findings |

---

## 🛠️ Tech Stack

| Category            | Technology                                              |
| ------------------- | ------------------------------------------------------- |
| **Framework**       | [Next.js 16](https://nextjs.org/) (App Router)          |
| **Language**        | [TypeScript](https://www.typescriptlang.org/)           |
| **Database**        | [Supabase](https://supabase.io/) (PostgreSQL)           |
| **Authentication**  | Supabase Auth                                           |
| **UI Components**   | [shadcn/ui](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/) |
| **Styling**         | [Tailwind CSS](https://tailwindcss.com/)                |
| **Data Fetching**   | [SWR](https://swr.vercel.app/)                          |
| **Forms**           | [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) |
| **Package Manager** | [pnpm](https://pnpm.io/)                                |
| **Deployment**      | [Vercel](https://vercel.com/)                           |

---

## 📁 Project Structure

```
v0-casting-database-web-app/
├── app/                    # Next.js App Router (pages and layouts)
│   ├── actors/             # Actor profile pages
│   ├── admin/              # Admin dashboard
│   ├── folders/            # Actor folder management
│   ├── intake/             # Actor intake form
│   ├── login/              # Authentication pages
│   └── projects/           # Project and casting management
├── components/             # Reusable React components
│   ├── ui/                 # Base UI components (shadcn/ui)
│   └── projects/           # Project-specific components
├── contexts/               # React contexts (Auth, etc.)
├── lib/                    # Core application logic
│   ├── actions/            # Server actions (database mutations)
│   ├── parser/             # Script parsing logic
│   ├── supabase/           # Supabase client configuration
│   └── types.ts            # TypeScript type definitions
├── public/                 # Static assets
├── scripts/                # Utility scripts
└── docs/                   # Additional documentation
```

---

## 🧪 Development

### Available Scripts

| Command               | Description                                    |
| --------------------- | ---------------------------------------------- |
| `pnpm run dev`        | Start development server                       |
| `pnpm run build`      | Build for production                           |
| `pnpm run start`      | Start production server                        |
| `pnpm run lint`       | Run ESLint                                     |
| `pnpm test`           | Run unit tests (Vitest, 77 tests)              |

### Code Quality

Before committing, ensure your code passes these checks:

```bash
# Type checking
pnpm exec tsc --noEmit

# Unit tests
pnpm test

# Linting
pnpm run lint

# Build test
pnpm run build
```

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Read the **[DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)** thoroughly
2. Create a feature branch from `main`
3. Make your changes following our coding standards
4. Test your changes thoroughly
5. Submit a Pull Request with a clear description

**Important Rules:**
- Never push directly to `main`
- All code must be strongly typed (TypeScript)
- Follow the existing code style and conventions
- Write clear commit messages

---

## 🔒 Security

Security is a top priority. Please review the **[SECURITY_AUDIT_REPORT.md](./SECURITY_AUDIT_REPORT.md)** for important security considerations.

**Key Points:**
- Never commit secrets or API keys
- Always use environment variables for sensitive data
- Leverage Supabase Row Level Security for data access control
- Keep dependencies up to date

---

## 📝 License

This project is proprietary and confidential. All rights reserved.

---

## 🙏 Acknowledgments

- Built with [v0.app](https://v0.app) for rapid UI prototyping
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)

---

## 📞 Support

For questions, issues, or feature requests:
- Open an issue on GitHub
- Contact the development team

---

**Made with ❤️ by the Casting Database Team**
