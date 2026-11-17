# LodgeCore PMS Migration Plan

**Status:** AWS deployment active; production domains and S3 storage migrated
**Prepared:** 2026-11-17
**Repository:** `hotel_pms`

## 1. Executive recommendation

Move the server-rendered applications from Vercel to one small AWS Linux host during the AWS Free Plan/credit period, while keeping Neon PostgreSQL and using `cron-job.org` as the temporary external scheduler.

The first migration should not deploy the legacy remote lock gateway. The current desktop application performs keycard operations locally through the installed lock SDKs and its offline SQLite database. The remote gateway remains in the repository and must be treated as legacy until its production usage is confirmed, but it is not part of the minimum current deployment.

Target first-stage topology:

```text
Users / public booking / mobile / desktop sync
                    |
                 HTTPS
                    |
          AWS EC2 + reverse proxy
          |                       |
       apps/web              apps/website
          |                       |
          +----------+------------+
                     |
              Neon PostgreSQL

cron-job.org ---> authenticated cron routes

Desktop lock encoding: local SDK + local SQLite (no cloud worker)
```

This is a cost-control and migration architecture, not the final high-availability architecture. A later stage can move to ECS/RDS/managed Redis after revenue and operational requirements justify it.

## 2. What was found in the repository

### Applications and services

| Component | Location | Current role | First AWS stage |
|---|---|---|---|
| PMS management app | `apps/web` | Next.js 16 server app, UI, API routes, Prisma access, desktop static-build source | Deploy as a long-running Node process |
| Public website/portal | `apps/website` | Next.js 16 public website, portal, booking engine, billing and booking APIs | Deploy as a second Node process |
| Stanzel site | `apps/hotel-stanzel` | Separate property website/booking client | Migrate only if it is actively served |
| Desktop PMS | `apps/desktop/LodgeCore.Desktop` | Offline SQLite PMS, cloud sync, local hardware integration | Not hosted on AWS; update API URL after cutover |
| Mobile management | `apps/mobile_management` | Flutter client | Rebuild with new API/WS configuration after cutover |
| Local lock SDK library | `hardware-agent/src/LodgeCore.HardwareAgent` | Referenced by desktop; local card encoder providers and SDK bridge | Keep in desktop builds |
| Legacy remote lock gateway | `workers/src/gateway.ts` | WebSocket hardware-agent gateway using Redis and cloud lock tables | Do not deploy initially; validate usage first |
| External Windows lock agent | `apps/agent-windows` / `hardware-agent` | Remote hardware-agent path for cloud lock commands | Legacy/optional until confirmed |
| Shared database package | `packages/db` | Prisma schema, migrations, seed and domain services | Keep Neon connection; run production migrations safely |

### Current desktop lock path

The current desktop path is local:

- `MauiProgram.cs` registers `ILockProvider` implementations for Deluns, HSLock, RFV2016, Xeeder and ProUSB.
- `HardwareInterop.cs` calls the selected provider directly.
- `MainPage.xaml.cs` handles `keycards.encode`, `keycards.read` and `keycards.cancel` locally.
- The desktop project references the hardware-agent library for SDK code, not because it requires the remote gateway.

The desktop still syncs operational data to the cloud through `SyncEngine`, so the API hostname must be changed after cutover. Local keycard encoding should continue to work when the cloud is unavailable, subject to the existing local authorization and sync behavior.

### Legacy worker finding

`workers/src/index.ts` starts `workers/src/gateway.ts`. That gateway:

- listens on `GATEWAY_PORT` (default `3001`);
- uses Redis pub/sub channels named `gateway:commands:*`;
- looks up `hardwareAgent`, `lockCommand`, `lockOperation` and `lockEvent` records in PostgreSQL;
- accepts authenticated WebSocket connections from remote hardware agents.

The repository still contains cloud lock orchestration in `apps/web/src/lib/locks/orchestrator.ts` and related API routes. Therefore, do not delete the worker or cloud lock tables during this migration. First confirm whether any live property has an enrolled remote agent or active cloud lock commands. If not, leave this path undeployed and schedule a separate cleanup decision.

There is no complete BullMQ processing worker currently running in `workers`; `bullmq` is a dependency, but the implemented entry point is primarily the WebSocket gateway.

## 3. Vercel-specific dependencies and migration impact

### A. Vercel Cron

The following schedules are currently declared in `vercel.json` files and must be recreated in `cron-job.org` during the transition:

| Application | Route | Current schedule | Migration action |
|---|---|---:|---|
| `apps/web` | `/api/cron/night-audit` | `0 4 * * *` | Create authenticated external cron job |
| `apps/web` | `/api/v1/refund-requests/escalate` | `0 5 * * *` | Create authenticated external cron job; route accepts `POST` |
| `apps/website` | `/api/v1/cron/expire-booking-holds` | `0 0 * * *` | Create authenticated external cron job |
| `apps/website` | `/api/v1/cron/reconcile-flutterwave-refunds` | `0 5 * * *` | Create authenticated external cron job |
| `apps/website` | `/api/cron/expire-demo-accounts` | `0 * * * *` | Create authenticated external cron job |

There are additional cron-style routes, including OTA reconciliation and trial expiry, which must be inventoried against the production Vercel configuration before cutover. Every scheduled route must be idempotent, authenticated with `CRON_SECRET`, and tested manually with a non-production database first.

### B. Vercel Blob

The following features write files through `@vercel/blob`:

- HR document uploads;
- room-type photos;
- property media;
- POS product images;
- booking-engine property logos;
- Reach creative jobs in the website app.

These are persistent business assets. Before Vercel is closed, either:

1. migrate the upload code to an S3-compatible adapter and copy existing objects; or
2. temporarily keep Vercel Blob as an external storage dependency while AWS hosts the applications.

The recommended long-term option is S3 with private buckets and signed access where documents are sensitive. Public HR documents should not remain public by default during this migration; confirm the intended access model before changing them.

### C. Upstash QStash

QStash is used for OTA sync/outbox processing and Reach marketing/creative jobs. It is not the same thing as Vercel hosting and can remain temporarily after the application moves to AWS. The first migration should preserve QStash if those jobs are active, then replace it with an EC2 worker/queue or AWS-native queue in a later phase.

If QStash is removed immediately, the following must be redesigned and tested first:

- OTA publish and retry behavior;
- internal outbox processing;
- marketing job signature verification and retries;
- any scheduled job that currently depends on QStash delivery.

### D. Vercel URLs and platform integrations

The code contains hardcoded `vercel.app` fallbacks in the web app, website, Stanzel site, desktop app, mobile app, Windows lock-agent setup, payment callback/webhook messages, SEO metadata and referral links. These must become environment variables with no Vercel fallback in production.

The website also contains a Vercel domain-attachment integration for custom booking domains. AWS migration does not automatically replace that feature. Choose one of these options:

- temporarily disable automatic domain attachment and manage DNS manually;
- implement Route 53/Cloudflare domain management later;
- keep the Vercel domain API integration only for domains that still terminate at Vercel.

## 4. Recommended first-stage AWS architecture

### EC2 host

Use one eligible small Linux EC2 instance during the AWS Free Plan/credit period. Run the services with Docker Compose or systemd:

| Process | Port | Notes |
|---|---:|---|
| Reverse proxy | 80/443 | Nginx or Caddy; TLS and host routing |
| `apps/web` | 3000 | PMS management UI and API |
| `apps/website` | 3002 | Public website, portal and booking APIs |
| Redis | 6379, private only | Keep only if active web lock orchestration, rate limiting or other paths require it |
| Legacy worker | 3001/3003 | Not started in the first deployment unless live usage is confirmed |

Neon remains the PostgreSQL provider. Do not run a second production PostgreSQL database on the EC2 instance unless there is a deliberate data-migration project; two databases would create data divergence risk.

### Domains

Use separate hostnames so each application and integration has a stable origin, for example:

- `pms.example.com` → `apps/web`;
- `www.example.com` or `book.example.com` → `apps/website`;
- `api.example.com` only if a separate API origin becomes necessary;
- `ws.example.com` only if the legacy worker is later reactivated.

Current production domains:

- `https://pms.zubplug.com.ng` → PMS, API, mobile and desktop sync
- `https://lodgecore.zubplug.com.ng` → public LodgeCore website and booking engine
- `https://www.stanzelgrandresort.org` → Stanzel property website

### Secrets

Do not commit `.env`, `.env.local`, `.env.production.local`, `.vercel` or any AWS credentials. The current worktree contains untracked `.env.production.local` and `.vercel` entries; preserve them locally and verify they are ignored before any commit or archive.

At minimum, production secrets/configuration must be inventoried and loaded securely:

- `DATABASE_URL` and, if required by Neon, `DIRECT_URL`;
- `AUTH_SECRET` / `NEXTAUTH_SECRET` and `NEXTAUTH_URL`;
- `CRON_SECRET`;
- payment keys and webhook secrets;
- Resend/email configuration;
- encryption and signing keys;
- OTA credentials and encryption keys;
- QStash token/signing keys while QStash remains active;
- Firebase service-account material if push notifications are enabled;
- Redis URL if active;
- public origins and client API/WS URLs.

Use an EC2-protected environment file for the initial low-cost deployment, with restrictive permissions. Move to AWS Secrets Manager when the deployment becomes permanent.

## 5. Migration phases

### Phase 0 — Freeze and inventory

1. Record the current Vercel project names, production domains, deployment commit, environment variable names, cron configuration, Blob usage, QStash usage and current Neon database branch/connection details.
2. Export a Neon backup and verify that it can be restored to a non-production database.
3. Record the current Vercel deployment URL as the rollback target.
4. Confirm whether any live property has a remote `hardwareAgent` record or active cloud lock traffic.
5. Do not change DNS or delete Vercel resources.

### Phase 1 — Make origins configurable

Replace Vercel fallbacks with explicit environment variables. Priority locations include:

- desktop `ApiBaseUrl` and app-installer/update URL;
- mobile `API_BASE_URL` and `WS_URL` build defines;
- website and web public site/API origins;
- payment callback and webhook URLs;
- corporate/Stanzel API URLs;
- referral/share links and SEO canonical URLs;
- lock-agent enrollment/setup defaults;
- custom-domain attachment behavior.

Add a production startup/configuration check that fails when required public origins still contain `vercel.app`.

### Phase 2 — Remove hosting coupling

1. Add production Dockerfiles or an equivalent reproducible build/start process for `apps/web` and `apps/website`.
2. Confirm Next.js server builds work with `NEXT_PUBLIC_IS_DESKTOP=false`.
3. Keep the desktop build path separate; it uses `output: "export"` and must not be used as the server deployment.
4. Replace `@vercel/blob` with S3 or document the temporary external-Blob decision.
5. Keep QStash temporarily unless a separate queue replacement is ready.
6. Add health endpoints or smoke checks for both applications.

### Phase 3 — Build the AWS staging environment

1. Create the eligible AWS account/plan and set a budget alarm before creating compute resources.
2. Create the EC2 instance with the smallest size that can build/run both Next.js applications, or build in CI and only run production artifacts on the instance.
3. Restrict security-group ingress to SSH from an administrator IP, HTTP/HTTPS publicly, and no public Redis/PostgreSQL ports.
4. Install Docker, reverse proxy, TLS, log rotation and automatic restart policies.
5. Configure Neon connection pooling appropriately for two long-running Next.js processes.
6. Run Prisma client generation and apply migrations with `prisma migrate deploy`; do not use `prisma db push` against production.
7. Start the two apps and test their health endpoints.
8. Start Redis only if the active application paths require it.

### Phase 4 — Recreate scheduled jobs

1. Create one `cron-job.org` job per active route.
2. Use the new HTTPS hostname and `Authorization: Bearer <CRON_SECRET>`.
3. Use `POST` for `/api/v1/refund-requests/escalate` and the method supported by each route.
4. Stagger jobs that can contend for database locks.
5. Run each job manually against staging and record status, duration and database effects.
6. Disable the matching Vercel Cron entries only after the external jobs are succeeding.

### Phase 5 — Client and integration validation

Test from the AWS hostname before changing production DNS:

- browser login, NextAuth session renewal and logout;
- desktop login, pull/push sync, retry/offline behavior and local SQLite operation;
- local keycard read/encode/cancel without any worker process;
- mobile login and API calls;
- mobile WebSocket behavior; if the old cloud WS feature is unused, document it as disabled rather than exposing a broken endpoint;
- Flutterwave and Paystack callbacks/webhooks;
- Resend email flows;
- OTA webhooks, QStash delivery and retries;
- file upload/download behavior;
- booking engine custom-domain routing;
- desktop update/app-installer downloads;
- night audit, booking expiry, refund reconciliation and demo expiry.

### Phase 6 — Controlled DNS cutover

1. Lower DNS TTL before the change.
2. Deploy the exact tested commit to AWS.
3. Change only the intended production records.
4. Keep Vercel live for the rollback window.
5. Monitor authentication, API errors, database connections, payment callbacks, cron results and desktop sync health.
6. Confirm at least one real end-to-end desktop sync cycle and one local keycard operation at the hotel.

### Phase 7 — Decommission only after proof

After the rollback window and backup verification:

- disable Vercel Cron;
- stop unnecessary Vercel deployments;
- migrate or preserve Blob assets;
- retain the Vercel project in a non-destructive state until all links and integrations are confirmed;
- remove Vercel packages only after the code no longer imports them;
- do not remove the legacy worker/cloud-lock code until live usage has been formally ruled out.

## 6. Acceptance gates

The migration is not complete until all gates pass:

1. The AWS applications boot from a clean deployment without local files or developer-only environment values.
2. Prisma migrations are applied successfully to the intended Neon database.
3. A Neon backup has been created and restoration has been verified.
4. No required production URL resolves to a Vercel fallback.
5. cron-job.org returns successful authenticated responses for every active schedule.
6. Payment and OTA webhooks reach AWS and write expected records.
7. Desktop `SyncEngine` completes push and pull cycles against AWS.
8. Desktop keycard encoding works with AWS unavailable, proving it remains local.
9. File uploads are durable and access-controlled.
10. Rollback to Vercel has been rehearsed or documented with tested DNS and environment steps.

## 7. Rollback plan

If AWS fails during cutover:

1. Stop cron-job.org jobs temporarily to prevent duplicate scheduled work.
2. Point DNS back to the Vercel production hostname.
3. Re-enable Vercel Cron only after confirming AWS cron jobs are disabled.
4. Verify payment providers still point to the active webhook origin.
5. Compare Neon writes and idempotency keys before replaying any job.
6. Keep AWS available for diagnosis; do not destroy the instance or database artifacts during an incident.

## 8. Risks and decisions still required

### High risk

- Existing hardcoded Vercel fallbacks can silently send users, clients or payment providers to the old deployment.
- Vercel Blob assets may be lost or become inaccessible if the Vercel project is closed before migration.
- Running both Vercel and AWS cron jobs can duplicate financial or booking work.
- Neon connection limits can be exhausted by two Next.js processes, migrations, scripts and local tools.
- The current repository contains a legacy cloud-lock path that still expects Redis and the remote gateway.

### Decisions required before cutover

- Production hostnames for `apps/web` and `apps/website`.
- Whether `apps/hotel-stanzel` is active production scope.
- Whether the current live database is Neon and which branch is authoritative.
- Whether Vercel Blob is still actively used and whether its assets are public or private.
- Whether QStash is active for OTA/outbox and Reach jobs.
- Whether any hotel still uses a remote `hardwareAgent`.
- Whether mobile WebSocket functionality is active or legacy.
- The AWS account/region and Free Plan eligibility.
- The rollback window and the person authorized to change DNS/payment webhook URLs.

## 9. Immediate next implementation tasks

1. Add Docker/release configuration for `apps/web` and `apps/website`.
2. Add an environment-origin validation utility and remove production Vercel fallbacks.
3. Produce a non-secret environment variable manifest for AWS deployment.
4. Configure the S3 storage abstraction in `packages/storage`, attach the least-privilege EC2 bucket policy, and migrate existing Vercel Blob assets before decommissioning Vercel.
5. Add a cron route inventory and staging smoke script.
6. Add a safe Redis feature flag or verify whether Redis is required when cloud locks are disabled.
7. Test the desktop `SyncEngine` against a staging API URL.
8. Confirm the production Neon backup/restore process.
9. Create the EC2 deployment files only after the target hostnames and AWS region are chosen.
