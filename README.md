# Search Platform API

Production-ready Fastify service written in TypeScript that exposes baseline health endpoints and is prepared to integrate with OpenSearch and PostgreSQL. The project includes opinionated tooling for development, testing, linting, and containerized local infrastructure.

## Features

- ⚡️ [Fastify](https://fastify.dev/) + TypeScript application scaffold
- ✅ Typed environment management powered by [`zod`](https://github.com/colinhacks/zod) and `dotenv`
- 🧪 Unit testing via Jest with `ts-jest`
- 🧹 Code quality tooling: ESLint, Prettier, TypeScript strict mode
- 🐘 PostgreSQL and 🧭 OpenSearch local stack with Docker Compose
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

## Environment Variables

All environment variables are validated on startup. Refer to [`.env.example`](./.env.example) for available settings and defaults.

## Health Endpoint

`GET /health`

Returns an overview of the service status and underlying dependencies. In non-test environments, connection checks attempt to query PostgreSQL and OpenSearch. During automated tests, the checks are intentionally skipped to keep the suite deterministic.

---

Happy building! 🚀
