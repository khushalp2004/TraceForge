# Load testing TraceForge with k6

Use the starter scripts in `load-tests/k6`.

## Goal

We want to answer practical questions like:

- Can the API handle 10 concurrent users?
- 25?
- 50?
- 100?

## What this setup measures well

- backend health endpoints
- authenticated dashboard API traffic
- notifications surface pressure
- worker queue enqueue pressure
- combined API + notifications + worker behavior

## What it does not fully measure yet

- heavy ingest traffic
- worker AI backlog behavior
- frontend rendering bottlenecks
- browser-driven checkout and OAuth performance

## Setup

1. Start the app locally:

```bash
docker compose up -d
```

2. Install k6:

```bash
brew install k6
```

3. Run a starter test:

```bash
k6 run load-tests/k6/public-api.js
```

4. Run authenticated dashboard load:

```bash
K6_BASE_URL=http://127.0.0.1:3001 \
K6_EMAIL=your-test-user@example.com \
K6_PASSWORD='your-password' \
K6_VUS=25 \
K6_DURATION=1m \
k6 run load-tests/k6/authenticated-dashboard.js
```

## Recommended 4-test sequence

### 1. Realtime notifications only

```bash
K6_BASE_URL=http://127.0.0.1:3001 \
K6_EMAIL=your-test-user@example.com \
K6_PASSWORD='your-password' \
K6_VUS=25 \
K6_DURATION=1m \
k6 run load-tests/k6/realtime-notifications.js
```

### 2. API only

```bash
K6_BASE_URL=http://127.0.0.1:3001 \
K6_EMAIL=your-test-user@example.com \
K6_PASSWORD='your-password' \
K6_VUS=25 \
K6_DURATION=1m \
k6 run load-tests/k6/authenticated-dashboard.js
```

### 3. Workers only

```bash
K6_BASE_URL=http://127.0.0.1:3001 \
K6_EMAIL=your-test-user@example.com \
K6_PASSWORD='your-password' \
K6_ERROR_ID=your-error-id \
K6_VUS=10 \
K6_DURATION=1m \
k6 run load-tests/k6/worker-queue.js
```

### 4. All combined

```bash
K6_BASE_URL=http://127.0.0.1:3001 \
K6_EMAIL=your-test-user@example.com \
K6_PASSWORD='your-password' \
K6_ERROR_ID=your-error-id \
K6_VUS=25 \
K6_DURATION=2m \
k6 run load-tests/k6/combined-system.js
```

## Read the result

Focus on:

- `http_req_failed`
- `http_req_duration`
- `p(95)` latency
- `p(99)` latency

## Production-minded thresholds

As a rough early-stage goal:

- failed requests under `1-2%`
- p95 under `1.2s`
- p99 under `2.5s`

If the app stays under those limits while CPU, RAM, DB, and Redis remain healthy, the tested concurrency is a reasonable working number.

## Next load-test extensions

After this starter phase, we should add:

- ingest endpoint load
- issue list / analytics load
- true long-lived SSE connection saturation
- spike tests
- longer soak tests
