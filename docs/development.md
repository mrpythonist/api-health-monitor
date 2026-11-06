# Development

## Prerequisites

- Node.js 20 or later and npm.
- Docker and the Compose plugin, for the full stack (PostgreSQL and
  Redis). Without Docker you can still run the tests, the TypeScript
  builds, the Next.js build, `prisma validate`, and the demo target.

## Setup

```bash
git clone https://github.com/mrpythonist/api-health-monitor.git
cd api-health-monitor
cp .env.example .env
```

Edit `.env` and set `ADMIN_API_KEY` to a long random value, and mirror
it in `API_KEY`. The full variable list is in the README Configuration
section and in `.env.example`.

Each app is a separate npm package. Install the ones you need:

```bash
cd apps/api && npm ci
cd ../worker && npm ci
cd ../web && npm ci
cd ../demo-target && npm ci
```

`npm ci` in `apps/api` and `apps/worker` runs `prisma generate` as a
postinstall step.

## Running the stack

### Docker Compose (recommended)

```bash
docker compose up --build
docker compose run --rm -e DEMO_TARGET_URL=http://demo-target:4000 api npm run seed
```

Ports: API 3001, dashboard 3000, demo target 4000, PostgreSQL 5432,
Redis 6379.

### Local processes

```bash
# PostgreSQL, Redis, and the demo target from Compose:
docker compose up -d postgres redis demo-target

# API (new terminal):
cd apps/api
npm ci
npx prisma migrate deploy
npm run seed   # prints the management API key
npm run dev    # http://localhost:3001

# Worker (new terminal):
cd apps/worker
npm ci
npm run dev

# Dashboard (new terminal):
cd apps/web
npm ci
npm run dev    # http://localhost:3000
```

The seed creates 5 monitors against the demo target
(`DEMO_TARGET_URL`, default `http://localhost:4000`). It skips monitors
whose URL already exists. If `ADMIN_API_KEY` is not set, the seed
generates a random key for that run and prints it; set it in `.env` to
keep using it.

## Scripts

Every app has its own `package.json`. There is no root package.json
and no workspace tooling. Run commands from inside the app directory.

| App | Script | What it does |
| --- | --- | --- |
| api | `npm run dev` | `tsx watch src/index.ts` |
| api | `npm run build` | `tsc -p tsconfig.json` |
| api | `npm start` | `node dist/index.js` |
| api | `npm test` | `tsx src/test/uptime.test.ts` (18 checks) |
| api | `npm run seed` | `tsx src/seed.ts` |
| worker | `npm run dev` | `tsx watch src/index.ts` |
| worker | `npm run build` | `tsc -p tsconfig.json` |
| worker | `npm start` | `node dist/index.js` |
| worker | `npm test` | `tsx src/test/incidents.test.ts` (9 checks) |
| web | `npm run dev` | `next dev -p 3000` |
| web | `npm run build` | `next build` |
| web | `npm start` | `next start -p 3000` |
| demo-target | `npm run dev` | `tsx watch src/index.ts` |
| demo-target | `npm run build` | `tsc -p tsconfig.json` |
| demo-target | `npm start` | `node dist/index.js` |

There is no lint script in any app, and `apps/web` has no test script.

`prisma validate` needs `DATABASE_URL` in the environment, even though
validation does not connect to a database:

```bash
cd apps/api
DATABASE_URL='postgresql://postgres:postgres@localhost:5432/apihealth' npx prisma validate
```

The same applies to `apps/worker`, which carries an identical copy of
the schema. If you change the data model, change both copies and add a
migration under `apps/api/prisma/migrations/`.

## Testing

Tests are plain `tsx` scripts, not a test framework. Each check prints
`ok <name>` and the script exits non-zero on the first failure. No
database is needed.

- `apps/api/src/test/uptime.test.ts` covers `uptimePercent`,
  `percentileSorted`, `average`, and `makeSlug`.
- `apps/worker/src/test/incidents.test.ts` covers the incident state
  machine: first failure, threshold hit, counting while open, resolve
  on success, counter reset after recovery, threshold 1, and threshold
  clamping.

Run both before opening a pull request. Add a check in the matching
test file when you change the covered behaviour.

## Debugging

- The worker logs every check outcome in one line
  (`[worker] <name>: UP 200 123ms`) and every incident open and resolve
  (`[worker] INCIDENT OPENED: ...`, `[worker] INCIDENT RESOLVED: ...`).
  Those lines are the basis for the CloudWatch metric filter described
  in the README.
- The API logs `[api] listening on :<port>` on startup, and warns once
  (`[cache]`, `[scheduler]`) when Redis is unreachable. If checks are
  not running, check Redis first: `REDIS_URL`, then whether the queue
  has repeatable jobs.
- The dashboard talks to the API server-side. If a page fails with
  `API <status>: ...`, the API is reachable but returned an error; check
  `API_URL` and `API_KEY` in the web environment.
- `GET /status` and `GET /status/:slug` return an `x-cache` header.
  `HIT` means the Redis cache served the response, `MISS` means it was
  aggregated from PostgreSQL.
- With no PostgreSQL and no Redis, the API still starts and listens,
  but management and status endpoints cannot return data, and
  `GET /health` blocks on Redis readiness (known limitation, observed
  2026-11-06). Run the demo target on its own to check the check loop
  behaviour without the stack: it needs no database.

## Project layout

```
apps/api/           Express API, scheduler, Prisma schema and migrations
apps/worker/        BullMQ worker, check logic, incident state machine
apps/web/           Next.js dashboard and public status pages
apps/demo-target/   endpoints with fixed behaviours for testing
docs/               architecture, development, API reference, screenshots
docker-compose.yml  postgres, redis, demo-target, api, worker, web
```

See `docs/architecture.md` for the component and data model detail.
