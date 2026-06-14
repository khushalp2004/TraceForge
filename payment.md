# Razorpay Payment Reconciliation System

This document outlines the architecture and implementation plan for the **Automated Billing Reconciliation System**. We will implement this to handle edge cases where the server crashes during a payment or drops the webhook, ensuring that users are automatically upgraded when the server recovers, accompanied by an apology email.

## The Problem
If the TraceForge server is down for more than 72 hours, Razorpay stops retrying webhooks. A user who paid for a Pro/Team plan during this time will successfully be charged, but the database will still reflect them as "FREE".

## The Solution: Nightly Cron Job

We will build an automated `Reconciliation Worker` using BullMQ's repeatable jobs that runs every night at 2:00 AM. 

### Step 1: BullMQ Repeatable Job Setup
- Add a new queue `BILLING_RECONCILIATION_QUEUE` in `apps/backend/src/queue/queues.ts` and `apps/worker/src/queue/queues.ts`.
- Schedule it to run daily using `repeat: { cron: '0 2 * * *' }`.

### Step 2: Razorpay API Integration
- The worker will use the Razorpay API (`razorpayRequest`) to fetch all successful subscriptions/payments created in the last 72 hours.
- Endpoint: `GET /subscriptions?from={timestamp}&to={timestamp}`

### Step 3: Database Verification (Prisma)
- Loop through the fetched subscriptions.
- For each subscription, check if the associated `userId` or `organizationId` in our PostgreSQL database has the `plan` set correctly (`PRO` or `TEAM`).
- Check if `subscriptionStatus` is `active`.

### Step 4: Automatic Upgrades
- If a user paid but their plan is still `FREE`, we found a dropped webhook!
- Update the Prisma database:
  - Set `plan = "PRO"` (or `"TEAM"`)
  - Set `subscriptionStatus = "active"`
  - Log the recovery in `Payment` table as `recovered_via_cron`.

### Step 5: Apology Email (Resend)
- For every user recovered this way, trigger the `mailer.ts` utility using the existing Resend integration.
- **Email Subject:** `Your TraceForge Pro Upgrade (Apologies for the delay!)`
- **Email Body:** *"Hi there, we noticed a slight delay in syncing your recent payment due to heavy load. We have successfully upgraded your account to Pro! We are incredibly sorry for the inconvenience and appreciate your patience."*

## How to execute this plan later:
When you are ready to build this feature, simply tell Antigravity:
*"Implement the reconciliation cron job from payment.md"*
