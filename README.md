# Certmaster

A free, responsive exam-preparation app for CompTIA Security+ (SY0-701), CompTIA Server+ (SK0-005), Cisco CCNA (200-301), and Splunk Cloud Certified Admin (SPLK-1005). Built with Next.js App Router, TypeScript, Tailwind, Prisma, NextAuth, Zod, React Hook Form, Zustand, and Lucide.

## Run locally

Requirements: Node.js 20+ and npm.

```powershell
npm install
Copy-Item .env.example .env
```

Create a free PostgreSQL database at [Neon](https://neon.tech) and set `DATABASE_URL` (pooled connection string) and `DIRECT_URL` (direct connection string, without `-pooler` in the host) in `.env`. Use a separate Neon database or branch from production.

Set a unique `NEXTAUTH_SECRET` in `.env`. One way to generate it is:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Apply the migrations and load the sample question bank, then start Next.js:

```powershell
npm run db:setup
npm run dev
```

Visit `http://localhost:3000`. The idempotent seed contains four certifications, objective-aligned domains, and 800 original sample questions (200 per certification, distributed across domains by each exam's published objective weighting). The questions live in `prisma/seed.ts` and `prisma/questions/`. Timed exams use a certification's `timedExamQuestions` and `timedExamMinutes` when set (Splunk Cloud Admin: 60 questions in 72 minutes) and otherwise allow 90 seconds per question. Add your own question content before treating the question bank as a complete exam simulator.

## Authentication

Email and password registration/sign-in work locally. Google sign-in is optional: create OAuth credentials, add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `.env`, set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED="true"`, and add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI in Google Cloud Console.

## Database

Development and production both use Neon PostgreSQL through `prisma/schema.prisma` and the Neon driver adapter. The schema contains users, NextAuth accounts/sessions, certifications, domains, questions/options, quiz sessions, ordered quiz questions, and attempts.

Schema changes go through Prisma migrations in `prisma/migrations`: edit the schema, run `npx prisma migrate dev --name <change>` against a development database, commit the generated migration, and apply it elsewhere with `npm run db:migrate`.

## Deploy to Cloudflare Workers

This is a full-stack Next.js app, so deploy it to **Cloudflare Workers** with the OpenNext adapter. A static Pages export would omit the server-rendered pages, authentication, and database-backed API routes.

1. Create a Cloudflare Worker connected to this repository and use `npm ci` for install and `npm run cf:build` for the build. Alternatively, deploy from a trusted terminal with `npm run cf:deploy`; use `npm run cf:preview` to test in the local Workers runtime.
2. Provision a Neon PostgreSQL database. Before the first deploy, set `DATABASE_URL` and `DIRECT_URL` in a trusted terminal, then run `npm run db:migrate` to create the tables and optionally `npm run db:seed` to load the sample content.
3. Add these Worker secrets in Cloudflare (**Settings → Variables and Secrets**) or with `npx wrangler secret put <NAME>`:
   - `DATABASE_URL`: Neon pooled connection string used by the Worker.
   - `NEXTAUTH_URL`: your deployed URL, such as `https://cert-mastery.<your-subdomain>.workers.dev`.
   - `NEXTAUTH_SECRET`: a unique, long random secret for this deployment.
   - Optional Google OAuth: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
4. For Google sign-in, set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED="true"` as a Worker variable and add `https://<your-domain>/api/auth/callback/google` to the OAuth client's authorized redirect URIs.

Use a separate Neon database for preview deployments. Do not commit database credentials or `.dev.vars`.

The Worker entry point is `cloudflare-worker.ts`, which wraps the OpenNext handler to record analytics and runs the daily maintenance cron (03:15 UTC, configured in `wrangler.jsonc`).

## Local database

`docker-compose.yml` runs Postgres plus Neon's local proxy, so the app's Neon driver works against it unchanged:

```powershell
docker compose up -d
```

Point development at it with a `.env.local` (used by `next dev` and `cf:build`) and a `.dev.vars` (used by `wrangler dev`), both gitignored:

```text
DATABASE_URL="postgres://postgres:postgres@db.localtest.me:5432/main"
DIRECT_URL="postgres://postgres:postgres@localhost:54329/main"
NEXTAUTH_URL="http://localhost:8787"
NEXTAUTH_SECRET="<any local secret>"
```

Prisma CLI commands read only `.env`, so pass the local URLs in the shell, then apply migrations and load data:

```powershell
$env:DATABASE_URL = "postgres://postgres:postgres@db.localtest.me:5432/main"
$env:DIRECT_URL = "postgres://postgres:postgres@localhost:54329/main"
npm run db:setup
npm run db:seed-dev
```

`db:seed-dev` adds fake users, quiz activity, and analytics events, plus `admin@example.test` / `admin-pass-123` (admin) and `student@example.test` / `student-pass-123`. It refuses to run unless `DATABASE_URL` is the local database. Delete `.env.local` before building for production, because OpenNext embeds `.env*` values in the bundle.

To test the Worker and its cron locally: `npm run cf:build`, then `npx wrangler dev --test-scheduled` and open `http://localhost:8787/__scheduled?cron=15+3+*+*+*`.

## Analytics and admin dashboard

The Worker records one `Event` row per page view (including client-side navigations), a `session_start` per browser session, and server errors (status 500+). Route handlers add `signup`, `login`, `exam_started` (with certification, mode, domain, difficulty, and search text), and `exam_finished`. Answers and quiz results come from the existing `Attempt` and `QuizSession` tables rather than being duplicated. Static assets, prefetches, and `/admin` are not logged, and known bots are flagged with `isBot` and excluded from statistics unless "Show bots" is on.

Events store no IP addresses, emails, tokens, query strings, or user-agent strings. Visitors are counted with a random ID in the first-party `cm_aid` cookie. A daily cron rolls events up into `DailyStat` and deletes raw events older than 90 days. Overview charts for ranges over 7 days read `DailyStat` for days already rolled up, so long-range charts keep working after raw events are deleted.

`/admin` (Overview, Content & usage, Users, Logs) is visible only to users with the `ADMIN` role; everyone else gets a 404, and every `/api/admin/*` call checks the role on the server. To make an account an admin, run this against the target database:

```powershell
'UPDATE "User" SET role = ''ADMIN'' WHERE email = ''you@example.com'';' | npx prisma db execute --stdin --schema prisma/schema.prisma
```

The role is read from the database on every request, so the change applies on the next page load. For a second layer of protection, put Cloudflare Access in front of `/admin*` and `/api/admin*`.

## Future access tiers

`User.accessTier`, `User.role`, and the Stripe customer/subscription identifiers establish the access-control boundary for future free and paid plans. Keep entitlement checks in server-side quiz/content APIs when adding limits; payment processing is not implemented.

## Scripts

- `npm run dev` starts the development server.
- `npm run build` creates the production build.
- `npm run cf:build` creates the Cloudflare Workers build.
- `npm run cf:preview` builds and previews the app in the Workers runtime.
- `npm run cf:deploy` builds and deploys the Worker.
- `npm run db:generate` generates Prisma Client.
- `npm run db:migrate` applies pending migrations to the configured database.
- `npm run db:push` syncs the schema to a throwaway database without creating a migration.
- `npm run db:seed` loads or refreshes the sample content.
- `npm run db:setup` applies migrations and seeds the database.
- `npm run db:seed-dev` loads fake users, activity, and analytics into the local database only.

Question content is original practice material and is not affiliated with or endorsed by CompTIA, Cisco, or Splunk.