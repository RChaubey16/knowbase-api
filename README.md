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
- **Member management** — Invite, list, remove, and change roles for org and workspace members; last-owner protection enforced server-side
- **Document ingestion** — Text, URL (Cheerio scraper), and PDF (pdf-parse) document types
- **Full-text search** — PostgreSQL `tsvector` + `plainto_tsquery` with relevance ranking
- **RAG semantic search** — Jina AI embeddings + pgvector HNSW index + Gemini generation
- **Background indexing** — BullMQ processes document chunking and embedding asynchronously; re-index endpoint for failed documents
- **Soft deletes** — Documents set `archivedAt`; never hard-deleted via the API

## API Reference

### Auth

```
GET  /auth/google                   Google OAuth redirect
GET  /auth/google/callback          OAuth callback — sets access + refresh token cookies
POST /auth/refresh                  Rotate both tokens
GET  /auth/me                       Current user info
POST /auth/logout                   Clears tokens
```

### Organisations

```
POST   /organisations                       Create org (max 3 owned per user)
GET    /organisations                       List orgs for current user
GET    /organisations/:slug                 Get org by slug
GET    /organisations/:slug/me              Current user's membership details
GET    /organisations/:slug/members         List all members            [any member]
POST   /organisations/members               Invite members by email     [owner/admin, X-Organisation header]
PATCH  /organisations/members/:memberId     Change a member's role      [owner]
DELETE /organisations/members/:memberId     Remove a member             [owner/admin]
PATCH  /organisations/:id                   Rename org                  [owner]
DELETE /organisations/:id                   Delete org                  [owner]
```

### Workspaces

All workspace routes require the `X-Organisation` header (org slug or ID).

```
GET    /workspaces                            List workspaces in org
POST   /workspaces                            Create workspace
GET    /workspaces/:slug                      Get workspace by slug
GET    /workspaces/:slug/me                   Current user's membership details
GET    /workspaces/:workspace/members         List all members            [any member]
POST   /workspaces/members                    Invite members by email     [owner]
DELETE /workspaces/members/:memberId          Remove a member             [owner]
PATCH  /workspaces/:id                        Rename workspace            [owner]
DELETE /workspaces/:id                        Delete workspace            [owner]
```

### Documents

All document routes require `X-Organisation` header.

```
GET    /workspaces/:workspace/documents                         List documents (with snippet, isIndexed)
POST   /workspaces/:workspace/documents                         Create text or URL document
POST   /workspaces/:workspace/documents/upload                  Upload PDF (multipart/form-data)
GET    /workspaces/:workspace/documents/search?q=&mode=         Full-text or RAG search
GET    /workspaces/:workspace/documents/:documentId             Get document
PUT    /workspaces/:workspace/documents/:documentId             Update document
DELETE /workspaces/:workspace/documents/:documentId             Soft delete (204)
POST   /workspaces/:workspace/documents/:documentId/reindex     Re-queue for embedding (202)
```

### RAG

```
POST /rag/query   { workspaceId, query, topK? } → { answer }   [X-Organisation header]
```

## Available Scripts

```bash
pnpm start:dev       # development server
pnpm build           # production build
pnpm test            # unit tests (Jest) — 78 tests across 13 suites
pnpm test:e2e        # end-to-end tests
pnpm test:cov        # test coverage report
pnpm lint            # ESLint
pnpm drizzle-kit generate  # generate DB migration
```

## License

UNLICENSED
