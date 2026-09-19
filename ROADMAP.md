# TraceForge Future Roadmap & Action Plan

This document serves as the master blueprint for the next phases of TraceForge. It is organized sequentially so you can pick up exactly where we left off when you return.

---

## Phase 1: Production Deployment (Immediate Next Step)
*All codebase pre-deployment tasks (Docker optimizations, network hardening, `.env.production` templates, and `deploy.sh`) are 100% complete.*

**When you get your VPS:**
1. **Domain Setup:** Ensure Cloudflare DNS (`usetraceforge.com`) points to your new VPS IP address (Proxied / Orange Cloud enabled).
2. **Server Provisioning:** SSH into the VPS and install Docker & Git.
3. **Clone & Configure:**
   ```bash
   git clone https://github.com/khushalp2004/TraceForge.git
   cd TraceForge
   cp .env.production.example .env
   ```
   *Edit the `.env` file to generate secure random keys for `JWT_SECRET` and Postgres.*
4. **Deploy:**
   Run `./deploy.sh` to build and start the entire cluster.
5. **Backups:** Set up a host machine `cron` job to run `pg_dump` on the database container daily at 2:00 AM, compressing the output and pushing it to offsite R2/S3 storage.

---

## Phase 2: Source Maps & De-minification (Backend Heavy)
*Goal: Translate unreadable minified production stack traces (e.g., `chunk.js:1:400`) back to the original developer code (e.g., `Home.tsx:42`).*
*Constraint: Zero changes required in the runtime SDKs.*

1. **Database Update:** Add a `SourceMap` model to `schema.prisma` to store associations between a `releaseId` and a raw `.map` file payload.
2. **Upload API:** Create a `POST /api/sourcemaps` route on the backend that accepts `.map` files securely via an API Key.
3. **Developer Tooling:** Create a simple TraceForge Webpack/Vite plugin (or a basic CLI tool) that developers run during their CI/CD build process to upload maps automatically.
4. **Parser Engine:** Integrate Mozilla's `source-map` library into the backend `ingest.ts` pipeline. When a minified error arrives, the backend intercepts it, fetches the corresponding map from the DB, translates the trace, and saves the readable version.

---

## Phase 3: Performance & Web Vitals Monitoring (Frontend/Backend)
*Goal: Evolve TraceForge into a full APM by tracking LCP, FID, CLS, TTFB, and API Latency.*
*Constraint: Modify only the React/Browser SDKs; leave backend SDKs alone for now.*

1. **Database Update:** Add a `PerformanceMetric` model to `schema.prisma` (storing `name`, `value`, `environment`, `path`).
2. **Ingest API:** Create `POST /ingest/vitals` to accept arrays of metrics securely.
3. **Analytics API:** Create backend routes to aggregate P50, P90, and P99 metric scores.
4. **TraceForge Dashboard:** Build a new `/dashboard/performance` view with time-series charts visualizing latency and web vitals.
5. **React SDK Update:** Carefully update `packages/sdk` to import Google's `web-vitals` library and automatically `fetch()` to `/ingest/vitals` in the background (wrapped in strict `try/catch` blocks to ensure it never breaks the Error Boundary).

---

## Phase 4: Breadcrumbs / Session Tracking
*Goal: Show a timeline of the last 20 user actions (clicks, fetch requests, route changes) leading up to a crash.*

1. **SDK Update:** Update the browser SDK to monkey-patch `console.log`, `fetch`, and global click event listeners.
2. **Rolling Buffer:** Maintain an in-memory queue (max 50 items) of these actions.
3. **Payload Attachment:** When an error is caught by the SDK, attach the current buffer array to the error payload.
4. **Dashboard Visualization:** Add a "Timeline" tab to the Error Details page showing exactly what the user did right before the crash.

---

## Phase 5: High Availability & Load Testing
1. **Load Testing:** Run progressive `k6` scripts against the live VPS to establish a baseline of how many requests/second the single VPS can handle.
2. **Scaling Architecture:** When traffic exceeds VPS capacity:
   - Migrate Postgres to a managed database (e.g., Supabase or AWS RDS).
   - Move Redis to a managed cache (e.g., Upstash).
   - Horizontally scale the Node.js backend/worker containers across multiple servers behind a load balancer.
