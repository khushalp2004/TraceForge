# TraceForge k6 load testing

These scripts help us estimate how much traffic the app can handle before production.

## Scripts

- `public-api.js`
  - hits `/`
  - hits `/health/live`
  - hits `/health/ready`
- `realtime-notifications.js`
  - logs in once in `setup()`
  - load tests the notifications surface:
    - `/notifications/dismissals`
    - `POST /notifications/dismissals`
- `authenticated-dashboard.js`
  - logs in once in `setup()`
  - then load tests:
    - `/auth/me`
    - `/auth/usage`
    - `/projects`
    - `/orgs`
    - `/alerts/projects`
- `worker-queue.js`
  - logs in once in `setup()`
  - repeatedly enqueues AI worker jobs with:
    - `POST /errors/:id/regenerate`
- `combined-system.js`
  - runs API + notifications together
  - optionally also queues worker jobs if `K6_ERROR_ID` is set

## Install k6

### macOS

```bash
brew install k6
```

### Docker alternative

```bash
docker run --rm -i grafana/k6 run - < load-tests/k6/public-api.js
```

## Start the app first

From the repo root:

```bash
docker compose up -d
```

That gives us:

- frontend at `http://127.0.0.1:3000`
- backend at `http://127.0.0.1:3001`

## Public API smoke load

```bash
k6 run load-tests/k6/public-api.js
```

Custom example:

```bash
K6_BASE_URL=http://127.0.0.1:3001 \
K6_VUS=25 \
K6_DURATION=1m \
k6 run load-tests/k6/public-api.js
```

## Authenticated dashboard load

Use a real test user that can sign in successfully.

```bash
K6_BASE_URL=http://127.0.0.1:3001 \
K6_EMAIL=your-test-user@example.com \
K6_PASSWORD='your-password' \
K6_VUS=25 \
K6_DURATION=1m \
k6 run load-tests/k6/authenticated-dashboard.js
```

## Realtime notifications load

```bash
K6_BASE_URL=http://127.0.0.1:3001 \
K6_EMAIL=your-test-user@example.com \
K6_PASSWORD='your-password' \
K6_VUS=50 \
K6_DURATION=2m \
k6 run load-tests/k6/realtime-notifications.js
```

## Worker-only load

Use a real error id that can be reprocessed.

```bash
K6_BASE_URL=http://127.0.0.1:3001 \
K6_EMAIL=your-test-user@example.com \
K6_PASSWORD='your-password' \
K6_ERROR_ID=your-error-id \
K6_VUS=10 \
K6_DURATION=1m \
k6 run load-tests/k6/worker-queue.js
```

## Combined real-system load

```bash
K6_BASE_URL=http://127.0.0.1:3001 \
K6_EMAIL=your-test-user@example.com \
K6_PASSWORD='your-password' \
K6_ERROR_ID=your-error-id \
K6_VUS=25 \
K6_DURATION=2m \
k6 run load-tests/k6/combined-system.js
```

If you want usage scoped to a specific org:

```bash
K6_BASE_URL=http://127.0.0.1:3001 \
K6_EMAIL=your-test-user@example.com \
K6_PASSWORD='your-password' \
K6_ORG_ID=your-org-id \
K6_VUS=25 \
K6_DURATION=1m \
k6 run load-tests/k6/authenticated-dashboard.js
```

## Suggested 4-test strategy

### Test 1: Realtime notifications only

```bash
K6_BASE_URL=http://127.0.0.1:3001 \
K6_EMAIL=your-test-user@example.com \
K6_PASSWORD='your-password' \
K6_VUS=25 \
K6_DURATION=1m \
k6 run load-tests/k6/realtime-notifications.js
```

### Test 2: API only

```bash
K6_BASE_URL=http://127.0.0.1:3001 \
K6_EMAIL=your-test-user@example.com \
K6_PASSWORD='your-password' \
K6_VUS=25 \
K6_DURATION=1m \
k6 run load-tests/k6/authenticated-dashboard.js
```

### Test 3: Workers only

```bash
K6_BASE_URL=http://127.0.0.1:3001 \
K6_EMAIL=your-test-user@example.com \
K6_PASSWORD='your-password' \
K6_ERROR_ID=your-error-id \
K6_VUS=10 \
K6_DURATION=1m \
k6 run load-tests/k6/worker-queue.js
```

### Test 4: All combined

```bash
K6_BASE_URL=http://127.0.0.1:3001 \
K6_EMAIL=your-test-user@example.com \
K6_PASSWORD='your-password' \
K6_ERROR_ID=your-error-id \
K6_VUS=25 \
K6_DURATION=2m \
k6 run load-tests/k6/combined-system.js
```

## Then scale up gradually

```bash
K6_BASE_URL=http://127.0.0.1:80 \
K6_EMAIL=your-test-user@example.com \
K6_PASSWORD='your-password' \
K6_ERROR_ID=your-error-id \
K6_VUS=100 \
K6_DURATION=2m \
k6 run load-tests/k6/combined-system.js
```

## What to watch while tests run

- API response times
- failed request rate
- backend CPU and memory
- Postgres CPU and connections
- Redis health
- worker lag / queue backlog

## Important notes

- TraceForge uses SSE-style realtime notifications, not classic WebSockets, so the realtime test targets the notifications API surface.
- This is a practical starter, not a full production performance program.
- These scripts measure backend/API capacity much better than frontend rendering capacity.
- If you want deeper realism later, we can add:
  - ingest load
  - worker backlog load
  - browser-style flows
  - staged ramps and spike tests
