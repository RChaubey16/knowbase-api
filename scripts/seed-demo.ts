import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";

const {
  users,
  organisations,
  organisationMembers,
  workspaces,
  workspaceMembers,
  documents,
  documentContents,
  documentChunks,
  documentChunkEmbeddings,
} = schema;

const DEMO_EMAIL = "demo@knowbase.app";
const JINA_MODEL = "jina-embeddings-v2-base-en";

const SEED_DOCUMENTS = {
  "Product Docs": [
    {
      title: "Product Roadmap Q3 2025",
      content: `# Product Roadmap Q3 2025

## Overview
This document outlines our product priorities for Q3 2025. Our focus is on three core themes: performance, collaboration, and enterprise readiness.

## Priority 1: Performance
- Reduce search latency from 800ms to under 200ms
- Implement edge caching for document retrieval
- Lazy-load document previews to improve initial page load

## Priority 2: Collaboration
- Real-time co-editing for text documents
- @mention support in document comments
- Workspace activity feed with change history

## Priority 3: Enterprise Readiness
- SSO support (SAML 2.0, OKTA, Azure AD)
- Audit logs with 90-day retention
- Role-based access control at the document level
- Data residency options (EU, US, APAC)

## Milestones
| Date | Milestone |
|------|-----------|
| July 15 | Performance baseline established |
| Aug 1  | Edge caching live in production |
| Aug 20 | Real-time editing beta |
| Sep 10 | SSO in private beta |
| Sep 30 | Q3 wrap-up and retrospective |

## Success Metrics
- P95 search latency < 200ms
- 30% increase in daily active editors
- 5 enterprise pilot customers onboarded`,
    },
    {
      title: "API Reference: Authentication",
      content: `# API Reference: Authentication

## Overview
All API requests must be authenticated using JWT tokens passed as \`httpOnly\` cookies.

## Endpoints

### POST /auth/google
Initiates Google OAuth 2.0 flow. Redirects the user to Google's consent screen.

**No request body required.**

---

### GET /auth/google/callback
Handles the OAuth callback from Google. On success, sets two cookies:
- \`kb_accessToken\` — JWT, 15-minute expiry
- \`kb_refreshToken\` — JWT, 7-day expiry

**Redirect:** Returns 302 to the configured \`FRONT_END_URL\`.

---

### POST /auth/refresh
Rotates the access and refresh token pair. The current \`kb_refreshToken\` cookie must be present.

**Response:**
\`\`\`json
{ "success": true }
\`\`\`

New cookies are set on the response.

---

### GET /auth/me
Returns the currently authenticated user.

**Response:**
\`\`\`json
{
  "userId": "uuid",
  "email": "user@example.com"
}
\`\`\`

**Errors:** 401 if no valid session.

---

### POST /auth/logout
Invalidates the refresh token and clears both cookies.

**Response:**
\`\`\`json
{ "success": true }
\`\`\`

## Error Codes
| Code | Meaning |
|------|---------|
| 401  | Missing or expired access token |
| 403  | Valid token but insufficient permissions |`,
    },
    {
      title: "User Research Summary: Search UX",
      content: `# User Research Summary: Search UX

## Study Overview
**Date:** May 2025
**Participants:** 14 (8 power users, 6 new users)
**Method:** Moderated usability testing + post-session survey

## Key Findings

### Finding 1: Users expect instant results
All participants expected search results to appear as they typed. The current 800ms debounce felt "laggy" to 11 of 14 participants.

**Recommendation:** Reduce debounce to 200ms and add skeleton loaders.

### Finding 2: RAG mode discovery is low
Only 2 of 14 participants noticed the RAG toggle without prompting. Once shown, 12 of 14 said they would use it regularly.

**Recommendation:** Surface the AI search mode more prominently — consider a dedicated search bar rather than a toggle.

### Finding 3: Result ranking needs improvement
Users frequently described the top result as "not what I expected." Manual relevance scoring was low (avg 2.9/5).

**Recommendation:** Move to BM25 + semantic hybrid ranking. Explore explicit feedback (thumbs up/down) to fine-tune.

## Next Steps
- Engineering spike on hybrid search (2 weeks)
- Redesign search bar with prominent AI mode (1 sprint)
- A/B test reduced debounce`,
    },
    {
      title: "Pricing & Packaging",
      content: `# Pricing & Packaging

## Tiers

### Free
- 1 organisation
- 3 workspaces
- 100 documents
- Full-text search
- 1 GB storage

### Pro — $29/month per user
- Unlimited organisations
- Unlimited workspaces
- Unlimited documents
- AI-powered semantic search (RAG)
- 50 GB storage
- Priority support

### Enterprise — Custom pricing
- Everything in Pro
- SSO (SAML 2.0)
- Audit logs
- SLA: 99.9% uptime
- Dedicated onboarding
- Custom data residency

## FAQ

**Can I switch plans?**
Yes, upgrades are prorated immediately. Downgrades take effect at the next billing cycle.

**What happens when I hit document limits?**
We'll notify you at 80% and 100% of your limit. Documents are read-only above the limit until you upgrade.

**Is there a discount for annual billing?**
Yes — 20% off for annual commitment on Pro and Enterprise.`,
    },
  ],
  Engineering: [
    {
      title: "Engineering Onboarding Guide",
      content: `# Engineering Onboarding Guide

Welcome to the engineering team! This guide gets you from zero to productive in your first week.

## Day 1: Setup

### Prerequisites
- macOS 13+ or Ubuntu 22.04+
- Node.js 20+
- pnpm 9+
- Docker (for local Redis)
- A Supabase project (ask your team lead)

### Clone and install
\`\`\`bash
git clone git@github.com:your-org/knowbase.git
cd knowbase
pnpm install
\`\`\`

### Environment variables
Copy \`.env.example\` to \`.env\` in both \`knowbase-api/\` and \`knowbase-app/\` and fill in the values.

### Start services
\`\`\`bash
# Terminal 1 — API
cd knowbase-api
pnpm start:dev

# Terminal 2 — App
cd knowbase-app
pnpm dev
\`\`\`

## Day 2: Architecture Overview

### API (NestJS)
- **Auth:** Google OAuth → JWT cookies (access 15m, refresh 7d)
- **DB:** Drizzle ORM on Supabase (PostgreSQL)
- **Search:** Full-text via \`tsvector\` + pgvector for semantic search
- **Queue:** BullMQ + Redis for async document ingestion

### Frontend (Next.js)
- App Router, server components by default
- \`serverFetch\` for server-side API calls, \`clientFetch\` for client components
- SWR for client-side data fetching

## Code Conventions
- All DB access via Drizzle — no raw SQL except full-text search
- DTOs validated by \`class-validator\`; \`ValidationPipe\` strips unknown fields
- Soft delete for documents (\`archivedAt\` timestamp)
- Guards are controller-level, never global`,
    },
    {
      title: "Incident Response Playbook",
      content: `# Incident Response Playbook

## Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|---------|
| SEV-1 | Total outage | 15 min | API down, auth broken, data loss |
| SEV-2 | Major degradation | 1 hour | Search unavailable, slow uploads |
| SEV-3 | Minor issue | Next business day | UI glitch, non-critical feature broken |

## On-Call Rotation
- Primary on-call is listed in PagerDuty
- Escalation path: On-call → Tech Lead → CTO

## SEV-1 Response Steps

1. **Acknowledge** the PagerDuty alert within 15 minutes
2. **Create** a war room in Slack: \`#incident-YYYY-MM-DD\`
3. **Post** initial status to \`#status-updates\`
4. **Diagnose:** Check Grafana dashboards → Supabase logs → Railway logs
5. **Mitigate:** Rollback deploy if recent, toggle feature flag, scale up
6. **Resolve:** Confirm metrics return to baseline
7. **Postmortem:** Write and share within 48 hours

## Common Issues & Fixes

### Auth loop (users stuck on login)
1. Check \`POST /auth/refresh\` error rate in Grafana
2. If bcrypt is timing out: scale API instances
3. If Google OAuth is down: add a status banner

### Search returning no results
1. Check if \`tsvector\` update trigger is enabled on \`documents\`
2. Run: \`SELECT count(*) FROM documents WHERE search_vector IS NULL\`
3. If trigger dropped: re-run migration \`0003\`

### Queue backlog growing
1. Check Redis memory usage
2. If OOM: flush stale jobs older than 7 days
3. Scale BullMQ worker replicas`,
    },
    {
      title: "Architecture Decision Record: Database Choice",
      content: `# ADR-001: Use Supabase (PostgreSQL) as Primary Database

**Date:** January 2025
**Status:** Accepted

## Context
We need a database that supports:
1. Relational data (users, orgs, workspaces, documents)
2. Full-text search
3. Vector embeddings for semantic search
4. Managed hosting with minimal ops overhead

## Decision
We will use **Supabase** (managed PostgreSQL) as our primary database.

## Rationale

### Full-text search is native
PostgreSQL's \`tsvector\` gives us full-text search without a separate search cluster. This eliminates Elasticsearch/Algolia costs at our current scale.

### pgvector for embeddings
The \`pgvector\` extension lets us store and query 768-dimensional embeddings with HNSW indexing. This removes the need for a separate vector database (Pinecone, Weaviate).

### Supabase advantages
- Managed PostgreSQL with automatic backups
- Built-in connection pooling (PgBouncer)
- Row-level security for multi-tenancy
- JS/Python SDKs
- Edge Functions if needed

## Tradeoffs

### Accepted
- Supabase is a third-party dependency; vendor lock-in risk is low because it's standard PostgreSQL underneath
- Free tier has generous limits; paid tier is cost-effective below 100k MAU

### Rejected Alternatives
| Option | Reason rejected |
|--------|----------------|
| PlanetScale (MySQL) | No native vector support |
| MongoDB | Weak relational joins; vector search less mature |
| Self-hosted PostgreSQL | Operational overhead not justified at current stage |

## Consequences
- All migrations managed via Drizzle Kit
- Vector search via Supabase RPC (\`match_document_chunks\`)
- Potential migration complexity if we outgrow Supabase at scale`,
    },
  ],
};

// Mirrors ChunkingService.chunk() exactly
function chunk(text: string, maxChars = 1500, overlapChars = 150): string[] {
  if (overlapChars >= maxChars) throw new Error("overlapChars must be smaller than maxChars");
  const clean = text.replace(/\s+/g, " ").trim();
  const sentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if ((current + " " + sentence).length <= maxChars) {
      current = current ? `${current} ${sentence}` : sentence;
    } else {
      chunks.push(current);
      const overlap = current.slice(Math.max(0, current.length - overlapChars));
      current = `${overlap} ${sentence}`.trim();
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

// Mirrors EmbeddingService.createEmbeddings() exactly
async function createEmbeddings(texts: string[], apiKey: string): Promise<number[][]> {
  const response = await fetch("https://api.jina.ai/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input: texts, model: JINA_MODEL }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Jina embedding API error ${response.status}: ${body}`);
  }
  const data = (await response.json()) as { data: { embedding: number[]; index: number }[] };
  return data.data.map((item) => item.embedding);
}

type Db = ReturnType<typeof drizzle>;

async function indexDocument(db: Db, documentId: string, content: string, jinaKey: string) {
  const chunks = chunk(content);

  // Insert chunks — mirrors IngestionProcessor exactly
  const chunkRecords = await db
    .insert(documentChunks)
    .values(
      chunks.map((c, index) => ({
        documentId,
        chunkIndex: index,
        content: c,
        tokenCount: c.split(/\s+/).length,
      })),
    )
    .returning();

  const orderedRecords = [...chunkRecords].sort((a, b) => a.chunkIndex - b.chunkIndex);

  const embeddings = await createEmbeddings(chunks, jinaKey);

  await db.insert(documentChunkEmbeddings).values(
    orderedRecords.map((chunkRecord, index) => ({
      chunkId: chunkRecord.id,
      embedding: embeddings[index],
      model: JINA_MODEL,
    })),
  );
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set. Run with: node --env-file=.env ...");
    process.exit(1);
  }

  const jinaKey = process.env.JINA_AI_API_KEY;
  if (!jinaKey) {
    console.warn("JINA_AI_API_KEY not set — documents will be seeded but NOT indexed for RAG search.");
  }

  const client = postgres(databaseUrl, { ssl: "require" });
  const db = drizzle(client, { schema });

  // Idempotency check
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, DEMO_EMAIL));

  if (existingUser) {
    console.log("Demo user already exists.");
    console.log(`DEMO_USER_ID=${existingUser.id}`);

    if (jinaKey) {
      // Find all demo documents that have no chunks yet and index them
      const allDocs = await db
        .select({ id: documents.id, title: documents.title })
        .from(documents)
        .innerJoin(workspaces, eq(documents.workspaceId, workspaces.id))
        .innerJoin(organisations, eq(workspaces.organisationId, organisations.id))
        .where(eq(organisations.createdBy, existingUser.id));

      const unindexed: typeof allDocs = [];
      for (const doc of allDocs) {
        const [chunk] = await db
          .select({ id: documentChunks.id })
          .from(documentChunks)
          .where(eq(documentChunks.documentId, doc.id))
          .limit(1);
        if (!chunk) unindexed.push(doc);
      }

      if (unindexed.length === 0) {
        console.log("All documents are already indexed.");
      } else {
        console.log(`Indexing ${unindexed.length} unindexed document(s)...`);
        for (const doc of unindexed) {
          const [contents] = await db
            .select({ rawContent: documentContents.rawContent })
            .from(documentContents)
            .where(eq(documentContents.documentId, doc.id));
          if (!contents) continue;
          process.stdout.write(`  Indexing "${doc.title}"...`);
          await indexDocument(db, doc.id, contents.rawContent, jinaKey);
          process.stdout.write(" done\n");
        }
        console.log("Indexing complete.");
      }
    } else {
      console.log("JINA_AI_API_KEY not set — skipping index check.");
    }

    await client.end();
    return;
  }

  console.log("Seeding demo data...");

  // 1. Create demo user
  const [demoUser] = await db
    .insert(users)
    .values({ email: DEMO_EMAIL, provider: "demo" })
    .returning();

  console.log(`Created demo user: ${demoUser.id}`);

  // 2. Create organisation
  const [org] = await db
    .insert(organisations)
    .values({ name: "Acme Corp", slug: "acme-corp", createdBy: demoUser.id })
    .returning();

  // 3. Create org membership
  const [orgMember] = await db
    .insert(organisationMembers)
    .values({ organisationId: org.id, userId: demoUser.id, role: "owner" })
    .returning();

  // 4. Create workspaces, members, documents, and index each document
  for (const [workspaceName, docs] of Object.entries(SEED_DOCUMENTS)) {
    const slug =
      workspaceName.toLowerCase().replace(/\s+/g, "-") +
      "-" +
      Math.random().toString(36).slice(2, 10);

    const [workspace] = await db
      .insert(workspaces)
      .values({ organisationId: org.id, name: workspaceName, slug })
      .returning();

    await db.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      organisationMemberId: orgMember.id,
      role: "owner",
    });

    for (const doc of docs) {
      const [insertedDoc] = await db
        .insert(documents)
        .values({
          workspaceId: workspace.id,
          createdByMemberId: orgMember.id,
          title: doc.title,
          type: "text",
          status: "ready",
        })
        .returning();

      await db.insert(documentContents).values({
        documentId: insertedDoc.id,
        rawContent: doc.content,
      });

      if (jinaKey) {
        process.stdout.write(`  Indexing "${doc.title}"...`);
        await indexDocument(db, insertedDoc.id, doc.content, jinaKey);
        process.stdout.write(" done\n");
      }
    }

    console.log(`Created workspace "${workspaceName}" with ${docs.length} documents`);
  }

  console.log("\nSeeding complete!");
  if (jinaKey) {
    console.log("All documents indexed for RAG search.");
  }
  console.log(`\nAdd this to your .env file:`);
  console.log(`DEMO_USER_ID=${demoUser.id}`);

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
