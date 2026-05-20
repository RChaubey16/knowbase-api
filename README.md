# Knowbase API

The backend for Knowbase. A REST API built with NestJS that handles user accounts, organisations, workspaces, documents, full-text search, and AI-powered semantic search (RAG).

> [!WARNING]
> **This project is currently under active development.** Features and APIs may change without notice.

## Tech Stack

| Technology | Role |
|---|---|
| **NestJS v11** | Web framework — modules, controllers, services |
| **Drizzle ORM** | Type-safe database queries |
| **PostgreSQL (Supabase)** | Database + pgvector for AI embeddings |
| **BullMQ + Redis** | Background job queue for document indexing |
| **Passport.js + JWT** | Google OAuth2 authentication |
| **Jina AI** | Text embeddings (768-dim) for semantic search |
| **Google Gemini** | LLM for RAG answer generation |

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- Redis (for the BullMQ job queue)
- A Supabase project with pgvector enabled

### Installation

```bash
pnpm install
```

### Environment Variables

Create a `.env` file:

```env
# Database
DATABASE_URL=              # Supabase pooler URL (port 6543)

# Auth
JWT_SECRET=
JWT_REFRESH_SECRET=
JWT_EXPIRES_IN=
GOOGLE_AUTH_CLIENT_ID=
GOOGLE_AUTH_CLIENT_SECRET=
GOOGLE_AUTH_CALLBACK_URL=  # e.g. http://localhost:3000/auth/google/callback
GOOGLE_AUTH_PROJECT_ID=
FRONT_END_URL=             # e.g. http://localhost:3001

# Supabase (vector search)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# RAG / AI
JINA_AI_API_KEY=
GEMINI_API_KEY=
GEMINI_MODEL=              # default: gemini-2.0-flash

# Queue (Redis)
REDIS_HOST=                # default: localhost
REDIS_PORT=                # default: 6379
```

### Database Migrations

Schema changes are tracked in `drizzle/`. To generate a new migration after editing the schema:

```bash
pnpm drizzle-kit generate
```

> **Note:** Migrations 0000–0004 were applied directly to Supabase, so the `__drizzle_migrations` tracking table does not exist. Apply new migrations with a direct Node script rather than `pnpm drizzle-kit migrate` until the tracking table is bootstrapped.

### Running

```bash
pnpm start:dev   # development with hot-reload (port 3000)
pnpm build
pnpm start:prod
```

## Features

- **Google OAuth + JWT** — `httpOnly` cookie-based auth with 15-minute access tokens and 7-day rotating refresh tokens
- **Multi-tenant** — Organisations → Workspaces → Documents hierarchy with role-based access control
- **Full-text search** — PostgreSQL `tsvector` + `plainto_tsquery` with relevance ranking
- **RAG semantic search** — Jina AI embeddings + pgvector HNSW index + Gemini generation
- **Background indexing** — BullMQ processes document chunking and embedding asynchronously (retries 3× with exponential backoff)
- **Soft deletes** — Documents set `archivedAt`; never hard-deleted via the API

## Available Scripts

```bash
pnpm start:dev       # development server
pnpm build           # production build
pnpm test            # unit tests (Jest)
pnpm test:e2e        # end-to-end tests
pnpm test:cov        # test coverage report
pnpm lint            # ESLint
pnpm drizzle-kit generate  # generate DB migration
```

## API Overview

See [`docs/api.md`](../docs/api.md) for the full endpoint reference and [`docs/postman.md`](../docs/postman.md) for a Postman testing guide.

## License

UNLICENSED
