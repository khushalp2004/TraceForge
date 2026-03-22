# TraceForge (Local Dev)

TraceForge is a lightweight, AI-assisted error monitoring platform built for developers. This repo scaffolds the local Docker environment and baseline services for the MVP.

## What We Have So Far
- Dockerized local environment (Postgres, Redis, backend API, worker, frontend)
- TypeScript Express API skeleton
- Next.js + Tailwind frontend shell
- AI worker that processes queued errors with Groq

## Why This Structure
- `apps/` keeps deployable services isolated and modular.
- `packages/` will house shared types and the SDK.
- Docker ensures parity between local dev and future cloud deployment.

## Local Setup
1. Copy env file and update secrets:

```bash
cp .env.example .env
```

2. Start the stack:

```bash
docker compose up --build
```

3. Database migrations are applied automatically when the backend and worker start. If you need to run them manually:

```bash
docker compose exec backend npm run prisma:migrate:deploy
```

4. Open services:
- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Health check: http://localhost:3001/health

## Ingestion Test (Phase 3)
1. Create a user + project to get an API key.
2. Send a sample error:

```bash
curl -X POST http://localhost:3001/ingest \
  -H "Content-Type: application/json" \
  -H "X-Traceforge-Key: YOUR_PROJECT_API_KEY" \
  -d '{
    "message": "TypeError: Cannot read properties of undefined",
    "stackTrace": "TypeError: Cannot read properties of undefined\\n    at handler (/app/index.js:10:5)",
    "environment": "development",
    "payload": { "route": "/signup" }
  }'
```

## SDK (Local Publish Workflow)
Build and pack the SDK locally:

```bash
cd packages/sdk
npm pack
```

Install the generated tarball in a local app:

```bash
npm install /path/to/traceforge-js-0.1.0.tgz
```

## Project Layout
- `apps/backend` - Express API (TypeScript)
- `apps/frontend` - Next.js UI (Tailwind)
- `apps/worker` - AI worker service (TypeScript)
- `packages/sdk` - SDK (scaffold)
- `packages/shared` - shared types/utilities (scaffold)
- `docker/postgres` - DB init scripts

## 🎉 MVP Complete!

**Full local SaaS ready.** See TODO.md for status.

## Quick Start
1. `cp .env.example .env` (add `GROQ_API_KEY` from groq.com)
2. `docker compose up -d`
3. Migrations run automatically on startup. If needed, run `docker compose exec backend npx prisma migrate deploy`
4. Open http://localhost:3000 → register → create project → test ingest

## Test Ingest
```
curl -X POST http://localhost:3001/ingest \\
  -H "Content-Type: application/json" \\
  -H "X-Traceforge-Key: YOUR_API_KEY" \\
  -d '{\"message\":\"Test error\",\"stackTrace\":\"at test.js:42\"}'
```

## SDK
```
cd packages/sdk && npm pack
# Install tgz in your app: npm i traceforge-js-0.1.0.tgz
```

**Deploy Next?** AWS ECS + RDS + S3.
# TraceForge
