# Playwright smoke testing

This folder gives us a lightweight pre-production smoke suite for TraceForge.

## What it covers

- Public page rendering:
  - `/`
  - `/pricing`
  - `/contact`
  - `/signin`
  - `/signup`
- Authenticated smoke flows:
  - sign in
  - dashboard shell render
  - billing page render
  - projects page render
  - organizations page render
- Super admin smoke flow:
  - `/dashboard/admin`

## Install

From `apps/frontend`:

```bash
npm install
npx playwright install chromium
```

## Run against an existing app

If your frontend is already running, point Playwright at it:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npm run test:e2e
```

## Run with the local frontend dev server

This is useful for public-page smoke checks:

```bash
PLAYWRIGHT_USE_DEV_SERVER=true npm run test:e2e
```

For authenticated testing, the backend and dependencies must also be running.

## Recommended local full-stack test flow

From the repo root:

```bash
docker compose up -d
```

Then from `apps/frontend`:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 \
PLAYWRIGHT_TEST_EMAIL=your-test-user@example.com \
PLAYWRIGHT_TEST_PASSWORD='your-password' \
PLAYWRIGHT_ADMIN_EMAIL=team@usetraceforge.com \
PLAYWRIGHT_ADMIN_PASSWORD='your-admin-password' \
npm run test:e2e
```

## Useful commands

```bash
npm run test:e2e
npm run test:e2e:headed
npm run test:e2e:ui
npm run test:e2e:report
```

## Notes

- Authenticated specs automatically skip if the required env vars are missing.
- Keep a dedicated seeded test account for repeatable smoke runs.
- Run this suite against staging before production deploys.
