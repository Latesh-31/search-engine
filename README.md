# Search Platform API

Production-ready Fastify service written in TypeScript that exposes baseline health endpoints and is prepared to integrate with OpenSearch and PostgreSQL. The project includes opinionated tooling for development, testing, linting, and containerized local infrastructure.

## Features

- ⚡️ [Fastify](https://fastify.dev/) + TypeScript application scaffold
- ✅ Typed environment management powered by [`zod`](https://github.com/colinhacks/zod) and `dotenv`
- 🧪 Unit testing via Jest with `ts-jest`
- 🧹 Code quality tooling: ESLint, Prettier, TypeScript strict mode
- 🗃️ Prisma ORM-powered Postgres schema with repositories and services for users, reviews, activities, boosts, and category tiers
- 🐘 PostgreSQL and 🧭 OpenSearch local stack with Docker Compose
- 🔐 OpenSearch client with credential file support, TLS validation, and cluster health checks
- 📄 Managed index templates for reviews and user activity documents with automatic bootstrap
- ♻️ Health endpoint that aggregates datastore connectivity checks

## Getting Started

### Prerequisites

- Node.js 20+
- npm 9+
- Docker & Docker Compose (for running the full stack locally)

### Installation

```bash
npm install
```

Copy the example environment file and adjust as needed:

```bash
cp .env.example .env
```

### Useful Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the development server with automatic reloads via `tsx watch`. |
| `npm run opensearch:bootstrap` | Apply OpenSearch templates and ensure indices without starting the server. |
| `npm run build` | Compile TypeScript to JavaScript (`dist/`). |
| `npm start` | Run the compiled application. |
| `npm run typecheck` | Perform a type check without emitting files. |
| `npm test` | Execute the Jest test suite. |
| `npm run lint` | Run ESLint across `src/` and `tests/`. |
| `npm run format` | Verify Prettier formatting. |
| `npm run ci` | Run linting, type checks, and tests (useful for CI pipelines). |

## Running Locally

### Development Server Only

```bash
npm run dev
```

The API listens on `http://localhost:3000` by default. Visit `http://localhost:3000/health` to inspect the aggregated health payload.

### Full Stack with Docker Compose

Spin up the API together with OpenSearch and PostgreSQL:

```bash
docker compose up --build
```

This command provisions:

- **api** – Fastify service built from this repository (port `3000`).
- **postgres** – PostgreSQL 16 database with seeded credentials (port `5432`).
- **opensearch** – OpenSearch 2.x single-node cluster with security disabled for local development (ports `9200` and `9600`).

Health checks ensure dependent services are available before the API starts. Update the `.env` file if you need to change credentials or network bindings.

To tear everything down:

```bash
docker compose down --volumes
```

## Project Structure

```
├── src/
│   ├── app.ts              # Fastify application factory
│   ├── config/env.ts       # Typed environment parsing and validation
│   ├── routes/health.ts    # Health endpoint implementation
│   ├── services/           # Connectivity helpers (Postgres/OpenSearch)
│   └── index.ts            # Application bootstrap entry point
├── tests/                  # Jest test suites
├── docker-compose.yml      # Local development stack
├── Dockerfile              # Production-ready container image
├── tsconfig*.json          # TypeScript build configurations
└── ...                     # Linting, formatting, and tooling configs
```

## OpenSearch Integration

### Client configuration

- Credentials can be supplied directly via `OPENSEARCH_USERNAME`/`OPENSEARCH_PASSWORD` or mounted securely with the corresponding `*_FILE` environment variables that read from Docker secrets.
- Managed clusters that require TLS can provide a certificate authority with `OPENSEARCH_CA_CERT_PATH` and toggle strict verification with `OPENSEARCH_TLS_REJECT_UNAUTHORIZED`.
- The same client powers runtime health checks, so any connectivity or credential issues surface through the `/health` endpoint.

### Index templates & analyzers

The service manages two index templates and matching aliases on startup:

- **Reviews** (`reviews-template-v1`, alias `reviews`, pattern `reviews-*`)
  - `title` and `content` leverage a folded analyzer for case-insensitive matching, with keyword and autocomplete multi-fields for exact matches and prefix search.
  - `rating`, `helpfulVoteCount`, `viewCount`, and `averageSentiment` are numeric fields optimized for aggregations and scoring.
  - `status`, `userId`, `categoryTierId`, `keywords`, and `lastActivityAt` provide keyword/date fields for filtering and faceting.
- **Review activities** (`review-activities-template-v1`, alias `review-activities`, pattern `review-activities-*`)
  - Captures `quantity` as an integer alongside rolling aggregation buckets (`aggregation.rolling7d`, `aggregation.rolling30d`, `aggregation.total`).
  - Stores `type`, `userId`, and `reviewId` as normalized keywords for breakdowns and unique counts.
  - Indexes `notes` with both full-text search and keyword facets, while preserving `recordedAt`/`createdAt`/`updatedAt` timestamps for time-series queries.

Both templates share folded and autocomplete analyzers to enable intuitive relevance and type-ahead behaviour.

### Bootstrap workflow

- On service startup the API calls `bootstrapOpenSearchInfrastructure` to apply templates and create initial backing indices (`reviews-v1`, `review-activities-v1`) with write aliases when needed.
- Bootstrapping is skipped automatically during tests and can be disabled by setting `OPENSEARCH_BOOTSTRAP_ENABLED=false` for environments where infrastructure is managed externally.
- You can run the process manually without starting the server via `npm run opensearch:bootstrap`, which performs the same checks and exits once the cluster is prepared.

### Cloud vs. self-hosted clusters

Local development (Docker Compose) runs OpenSearch without security, so the defaults in `.env.example` work out of the box. For cloud-managed clusters:

1. Point `OPENSEARCH_NODE` at the managed HTTPS endpoint.
2. Provide credentials either inline (`OPENSEARCH_USERNAME`/`OPENSEARCH_PASSWORD`) or through mounted secret files (`OPENSEARCH_USERNAME_FILE`/`OPENSEARCH_PASSWORD_FILE`).
3. Supply the provider CA certificate with `OPENSEARCH_CA_CERT_PATH` and set `OPENSEARCH_TLS_REJECT_UNAUTHORIZED=true` to enforce validation.
4. Optionally disable automatic bootstrapping if index lifecycle is controlled by infrastructure tooling.

## Environment Variables

All environment variables are validated on startup. Refer to [`.env.example`](./.env.example) for available settings and defaults.

## Health Endpoint

`GET /health`

Returns an overview of the service status and underlying dependencies. In non-test environments, connection checks attempt to query PostgreSQL and OpenSearch. During automated tests, the checks are intentionally skipped to keep the suite deterministic.

## Domain Endpoints

All domain endpoints perform input validation with `zod` and persist data through Prisma. Each endpoint responds with structured payloads and meaningful error codes for invalid input, missing resources, or business rule violations.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/users` | List users |
| `POST` | `/users` | Create a user |
| `GET` | `/users/:id` | Retrieve a user |
| `PUT` | `/users/:id` | Update a user |
| `DELETE` | `/users/:id` | Remove a user |
| `GET` | `/reviews` | List reviews with associations |
| `POST` | `/reviews` | Create a review |
| `GET` | `/reviews/:id` | Retrieve a review |
| `PUT` | `/reviews/:id` | Update a review |
| `DELETE` | `/reviews/:id` | Remove a review |
| `GET` | `/review-activities?reviewId=...` | List activity metrics for a review |
| `POST` | `/review-activities` | Record activity metrics |
| `GET` | `/review-activities/:id` | Retrieve an activity metric |
| `PUT` | `/review-activities/:id` | Update an activity metric |
| `DELETE` | `/review-activities/:id` | Remove an activity metric |
| `GET` | `/boosts` | List boost purchases with usage |
| `POST` | `/boosts` | Create a boost purchase |
| `GET` | `/boosts/:id` | Retrieve a boost purchase |
| `PUT` | `/boosts/:id` | Update a boost purchase |
| `DELETE` | `/boosts/:id` | Remove a boost purchase |
| `GET` | `/boosts/:id/usage` | List usage entries for a boost purchase |
| `POST` | `/boosts/:id/usage` | Record usage for a boost purchase |
| `GET` | `/category-tiers` | List category tiers |
| `POST` | `/category-tiers` | Create a category tier |
| `GET` | `/category-tiers/:id` | Retrieve a category tier |
| `PUT` | `/category-tiers/:id` | Update a category tier |
| `DELETE` | `/category-tiers/:id` | Remove a category tier |
| `GET` | `/scoring/:id` | Retrieve a user's composite score |
| `POST` | `/scoring/:id/calculate` | Calculate user score without persisting |
| `PUT` | `/scoring/:id` | Calculate and update user's composite score |

## Composite Scoring Engine

The service implements a configurable scoring engine that combines performance metrics, activity signals, and boost purchases into a normalized composite score per user. The score is calculated based on:

- **Performance (40%)**: Average review rating, total reviews, and published reviews
- **Activeness (30%)**: Weighted activity metrics (views, helpful votes, shares, comments, clicks)
- **Boost (30%)**: Active boost credits with type-specific weights

The weights are configurable in `src/config/scoring.ts` and can be adjusted to suit business requirements. Scores are normalized to a 0-1 range and stored in the User table for efficient retrieval during search ranking.

---

Happy building! 🚀
