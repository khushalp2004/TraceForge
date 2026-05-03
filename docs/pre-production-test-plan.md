# TraceForge pre-production test plan

Use this before a production deployment.

## 1. Build and static validation

- Frontend: `cd apps/frontend && npm run build`
- Backend: `cd apps/backend && npm run build`
- Worker: `cd apps/worker && npm run build`
- Security CI: confirm `.github/workflows/security.yml` is green

## 2. Playwright smoke pass

Run the smoke suite in `apps/frontend/e2e`.

Minimum:

- homepage
- pricing
- contact
- signin
- signup

Recommended before release:

- authenticated dashboard
- billing page
- projects page
- organizations page
- admin page

## 3. Manual product smoke

Test these end to end in staging:

- sign up
- email verification
- sign in
- forgot password
- project creation
- organization creation
- issue ingest
- issue triage
- alerts
- releases
- repo analysis
- subscriber signup
- admin subscribers / announcements
- billing checkout in Razorpay test mode

## 4. Integration checks

- Resend email delivery
- Google OAuth
- GitHub OAuth
- Slack integration
- Jira integration
- Razorpay webhook delivery
- Redis-backed worker processing

## 5. Security checks

- cookie auth works in deployed environment
- protected routes return `401` after logout
- CORS allows only expected frontend origins
- CSP allows only intended third-party origins
- rate limiting works on auth endpoints
- super admin routes stay blocked for standard users

## 6. Operational checks

- `docker-compose.prod.yml` boots cleanly
- migrations apply successfully
- health endpoints respond:
  - `/health/live`
  - `/health/ready`
  - `/health/diagnostics`
- restart containers once and confirm recovery
- verify backups / snapshots are enabled

## 7. Release gate

Treat production as ready only when:

- builds pass
- smoke tests pass
- staging integrations pass
- billing test payment passes
- no blocker errors remain in browser console or backend logs
