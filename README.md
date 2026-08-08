# Sadaqa+ · صدقة+

**Ensemble, multiplions le bien.** — **معًا نضاعف الخير.** — **Together, we multiply good.**

An Algerian digital solidarity platform connecting people who need help with the
people, associations and companies ready to provide it.

> **This platform launches empty, on purpose.** There is no demo data, no
> placeholder association, no sample campaign and no invented statistic. Every
> counter reads from PostgreSQL; on a fresh install they all read zero, and the
> interface says so plainly. See [Zero demo data](#zero-demo-data).

---

## Table of contents

- [What it does](#what-it-does)
- [Stack](#stack)
- [Getting started](#getting-started)
- [Zero demo data](#zero-demo-data)
- [Creating the first administrator](#creating-the-first-administrator)
- [Architecture](#architecture)
- [Security model](#security-model)
- [Internationalisation](#internationalisation)
- [PWA](#pwa)
- [Testing](#testing)
- [Deployment](#deployment)
- [Scheduled jobs](#scheduled-jobs)
- [External services](#external-services)
- [Scripts](#scripts)

---

## What it does

| Area | Summary |
|---|---|
| **Help requests** | A seven-step submission wizard, a strict state machine, and human verification before anything is published. |
| **Verification** | Every decision records the reviewer, timestamp, outcome and reason. No badge is ever awarded automatically. |
| **Organisations** | A partnership application pipeline; approval creates the organisation, its owner and its role in one transaction. |
| **Campaigns** | Monetary or material goals with progress derived from confirmed donations — never a stored percentage. |
| **Events** | Registration, capacity with waitlisting, and HMAC-signed QR attendance codes. |
| **Volunteering** | Profiles, missions, applications with accept/reject, and logged hours. |
| **Donations** | Donation *intents* (an offer of help) kept strictly separate from *confirmed donations* (a real transaction). |
| **Messaging** | Conversations scoped by membership, with moderation and blocking. |
| **Notifications** | In-app, email and Web Push, each gated by user preference and by whether the channel is actually configured. |
| **Moderation** | Report queue, duplicate signals, audit log. Nothing is auto-labelled fraudulent. |
| **Administration** | Real analytics, moderation queues, user and role management, categories, settings, audit trail. |

---

## Stack

- **Next.js 16** (App Router, React 19, Server Components by default)
- **TypeScript** in strict mode
- **PostgreSQL 16** + **Prisma 6**
- **Tailwind CSS v4** with a token-based design system
- **Radix UI** primitives, **Framer Motion**, **Lucide**
- **TanStack Query**, **React Hook Form**, **Zod**
- **Redis** (optional) for distributed rate limiting
- **Vitest** + **Playwright**

---

## Getting started

### Prerequisites

- Node.js 24+
- Docker (for PostgreSQL and Redis), or your own instances

### 1. Dependencies and services

```bash
npm install
docker compose up -d db redis
```

### 2. Environment

```bash
cp .env.example .env
node -e "console.log('AUTH_SECRET=' + require('crypto').randomBytes(48).toString('base64url'))"
```

Paste the generated value into `.env`. `DATABASE_URL` already points at the
docker-compose database.

### 3. Database

```bash
npm run db:migrate     # apply migrations
npm run db:seed        # reference data only — no activity
```

The seed prints what it created and asserts that every activity table is still
empty:

```
  roles: 7, permissions: 40
  wilayas: 58, communes: 1541
  categories: 39
  settings: 9

Activity tables (must be zero on a fresh install):
  users=0 organizations=0 requests=0 campaigns=0 events=0 donations=0
```

### 4. Run

```bash
npm run dev          # http://localhost:3000
```

---

## Zero demo data

This is a hard rule of the product, enforced in three places:

1. **`prisma/seed.ts`** creates roles, permissions, the 58 wilayas, all 1,541
   communes, categories and system settings — and nothing else. It never
   inserts a user, organisation, request, campaign, event or donation.
2. **Every statistic** on the homepage and in `/admin` comes from a live
   `COUNT`/`SUM`. There is no hardcoded number anywhere in the UI.
3. **CI asserts it.** The `build-and-e2e` job fails if the seed produced any
   activity row, or if reference data is incomplete.

Empty states are designed as first-class screens, not fallbacks: each one names
what will appear there and offers the action that creates it.

### Geographic reference data

All 58 wilayas and all 1,541 communes are included, with names in Arabic and
Latin script plus the daïra each commune belongs to. The commune dataset is
committed at `prisma/data/communes.json`, derived from a public dataset of the
official 58-wilaya administrative division.

---

## Creating the first administrator

There is no default admin account and no well-known password anywhere in this
repository.

```bash
BOOTSTRAP_ADMIN_EMAIL=ops@your-domain.dz \
BOOTSTRAP_ADMIN_FIRST_NAME=Prénom \
BOOTSTRAP_ADMIN_LAST_NAME=Nom \
npm run bootstrap:admin
```

The password is prompted for without echo (or supplied via
`BOOTSTRAP_ADMIN_PASSWORD` in a non-interactive environment). The command:

- refuses to run if an active `SUPER_ADMIN` already exists;
- enforces the same password policy as public registration;
- marks the address verified and writes an audit entry;
- never prints the password.

Further administrators are granted from `/admin/users`.

---

## Architecture

```
src/
  app/
    [locale]/            # every page; one tree, three languages
      (main)/            # public shell: header, footer, bottom nav
      (auth)/            # focused sign-in shell
      admin/             # staff area, server-gated
    api/                 # route handlers
  components/            # design system + shared UI
  features/              # feature-scoped UI (requests, campaigns, …)
  server/
    auth/                # sessions, password hashing, guards
    services/            # business logic — the only place that writes
    domain/              # state machines
    permissions/         # the RBAC matrix, single source of truth
    storage/             # local + S3 drivers behind one interface
    payments/            # provider boundary (unconfigured by default)
  validations/           # Zod contracts shared by client and server
  i18n/                  # locale config, dictionaries, formatting
```

**Request lifecycle:** route handler → validate (Zod) → authenticate →
authorize → service → Prisma → typed response envelope.

A route handler never queries the database directly, and a service never trusts
an id, role or ownership claim that arrived from the client.

---

## Security model

| Control | Implementation |
|---|---|
| Password hashing | scrypt (N=32768, r=8, p=2), parameters stored in the hash, transparent upgrade on login |
| Sessions | Opaque random secret in an httpOnly `SameSite=Lax` cookie; only an HMAC is stored |
| Tokens | Email verification and password reset are single-use, expiring, HMAC-stored |
| Authorization | Server-derived roles and permissions on every request; the client's copy is display-only |
| IDOR | Unauthorized records return **404**, not 403, so ids cannot be probed |
| CSRF | `SameSite=Lax` plus an explicit `Origin` check on every mutation |
| Rate limiting | Redis-backed, per surface; documented in-memory fallback when Redis is absent |
| Brute force | Per-account failure counter with temporary lockout, plus per-IP and per-email limits |
| Enumeration | Registration and password reset return identical responses regardless of account existence |
| Uploads | Magic-byte sniffing, declared-vs-actual type mismatch rejected, polyglot detection, size cap, private by default |
| File access | Every read goes through `/api/files/[id]`, which re-checks permissions |
| CSP | Per-request nonce with `strict-dynamic`; `object-src 'none'`, `frame-ancestors 'none'` |
| Headers | HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP/CORP |
| Error handling | No stack trace, SQL or ORM detail ever crosses the API boundary |
| Audit | Append-only log of authentication, verification, role, moderation and donation state changes |

### Privacy

Exact addresses, identity documents and private contact details are **never**
published by default. Map pins for approximate locations are rounded
server-side to roughly a kilometre. Attachments default to moderators-only.
Publishing any of it is an explicit, per-item choice by the person concerned.

---

## Internationalisation

Three languages — **العربية (RTL)**, **Français**, **English** — served from one
page tree under `/[locale]/…`. French is the default.

- Direction and font switch on the `<html>` element.
- `ar.ts` and `en.ts` implement a TypeScript type derived from `fr.ts`, so a
  missing translation is a compile error, not a blank string.
- Numbers use Western Arabic digits in all three locales, matching Algerian
  administrative and banking usage.

---

## PWA

- Manifest served from a route so `start_url` follows the deployment origin
- Icons generated from the logo (`node scripts/generate-icons.mjs`)
- Service worker with a deliberately conservative policy: **nothing** under
  `/api`, `/admin`, `/dashboard`, `/messages`, `/notifications`, `/profile` or
  `/auth` is ever cached, and any `Cache-Control: private` response is skipped
- Offline fallback page per locale
- Install prompt that waits for the browser's own signal and snoozes for 30 days
- Web Push, disabled and reported as unconfigured until VAPID keys are set

---

## Testing

```bash
npm test          # Vitest unit suite
npm run test:e2e  # Playwright, against a production build
```

The unit suite covers password hashing, the request state machine, the RBAC
matrix, validation contracts and utilities. The E2E suite covers locale
routing and RTL, empty states, security headers, the PWA surface, and a
security regression set: authentication requirements, IDOR, CSRF, account
enumeration, error-shape leakage, the public-status filter, and the fact that
a donation cannot be confirmed without a payment provider.

---

## Deployment

### Vercel

```bash
vercel link
vercel integration add neon --plan free_v3 -m region=fra1        # DATABASE_URL
vercel blob create-store <name> --access private --yes           # BLOB_READ_WRITE_TOKEN
```

Then set, at minimum:

| Variable | Value |
|---|---|
| `AUTH_SECRET` | 48 random bytes, base64url |
| `DIRECT_DATABASE_URL` | the provider's **unpooled** URL (migrations only) |
| `NEXT_PUBLIC_APP_URL` | your production origin |
| `STORAGE_DRIVER` | `blob` — the local driver loses files on serverless |
| `CRON_SECRET` | 32 random bytes, base64url |

Apply migrations with the **direct** URL before the first deploy, so the build
can read reference data:

```bash
DATABASE_URL="<direct url>" DIRECT_DATABASE_URL="<direct url>" npx prisma migrate deploy
DATABASE_URL="<direct url>" DIRECT_DATABASE_URL="<direct url>" npm run db:seed
```

Then `vercel deploy --prod` and create the first administrator (see above).

**Before opening registration**, provision Redis and set `REDIS_URL`:

```bash
vercel integration add upstash/upstash-kv --plan free
```

Without it, rate limiting is per-instance — which on serverless means an
attacker can spread login attempts across instances and largely evade it.

### Docker

```bash
docker compose --profile app up --build
```

The image is multi-stage, runs as a non-root user, and ships only the Next.js
standalone output plus the Prisma migrations.

> `prisma migrate deploy` is the production path. `migrate reset` and
> `migrate dev` must never run against production data.

---

## Scheduled jobs

Four endpoints, each guarded by `CRON_SECRET`:

| Path | Ideal schedule | Does |
|---|---|---|
| `/api/cron/reminders` | hourly | Reminds participants 24–48h before an event |
| `/api/cron/outbox` | every 15 min | Retries undelivered transactional email |
| `/api/cron/expire` | daily | Expires stale requests, closes finished campaigns and events |
| `/api/cron/cleanup` | daily | Removes expired sessions, consumed tokens, old read notifications |

Call with `Authorization: Bearer $CRON_SECRET`.

`vercel.json` currently schedules **all four daily**, because a Vercel Hobby
account cannot run a cron more than once per day. The reminder job still works
— it looks 24–48h ahead, so a single daily run covers the whole window — but
the outbox retry is slower to recover from an SMTP outage than it should be.
On a Pro plan, restore `0 * * * *` for `reminders` and `*/15 * * * *` for
`outbox`. Any external scheduler hitting the same URLs with the bearer token
works equally well.

---

## External services

Everything below is optional. The platform runs without any of them, and the
`/admin` overview shows exactly which are configured — including the
consequence of each one being absent.

| Service | Without it |
|---|---|
| **SMTP** | Emails are rendered to the server log. The outbox records the attempt; nothing claims delivery. |
| **Redis** | Rate limiting falls back to a per-instance in-memory limiter. **Not meaningful on serverless**, where instances come and go — provision it before opening registration. |
| **Object storage** | With `STORAGE_DRIVER=local`, files go to the local filesystem. On serverless that is ephemeral and uploads are silently lost — use `blob` or `s3` there. |
| **Web Push** | Push is reported as unconfigured and the toggle is disabled. |
| **Payment provider** | Online payment is disabled. Donation intents still work. No donation can reach `CONFIRMED`. |
| **AI** | Moderation assistance is off. No automated decision is ever made about a request. |
| **Malware scanner** | Uploads are type-checked and sniffed but not scanned; status stays `PENDING`, reported in `/admin`. |

---

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | `prisma generate` + production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests |
| `npm run test:e2e` | Playwright |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:deploy` | `prisma migrate deploy` |
| `npm run db:seed` | Reference data |
| `npm run db:studio` | Prisma Studio |
| `npm run bootstrap:admin` | Create the first `SUPER_ADMIN` |
| `npm run push:keys` | Generate a VAPID key pair |

---

## Legal

Sadaqa+ makes **no** claim to registered-charity status, public accreditation,
government affiliation or tax deductibility. Legal documents ship unwritten:
`/legal/*` states plainly that the operator has not published them yet, rather
than shipping boilerplate that would commit the operator to terms nobody wrote.
Publish real content through `/admin/settings` before launch.
