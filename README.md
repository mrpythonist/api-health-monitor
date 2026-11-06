# API Health Monitoring and Incident Tracker

A small monitoring platform that continuously checks APIs and tracks downtime.
Register endpoints, schedule periodic health checks, record every result in
PostgreSQL, open incidents after consecutive failures, and publish public
status pages. A simplified take on Better Stack / UptimeRobot.

## Problem

An API can go down silently. Without a watcher, the first person to notice is
usually a customer. This project gives a small team a self-hosted way to watch
its own services: define what "healthy" means for each endpoint, check it on a
schedule, keep the history, and get a clear record of every outage with its
cause and duration.

## Why it exists

It is a focused, readable implementation of the core loop of uptime
monitoring: schedule, check, store, detect, notify, publish. It is built to
be run, read, and extended, not to replace a hosted monitoring service. The
incident rules live in one pure function with unit tests, the check logic is
separate from the HTTP layer, and the dashboard is a thin view over the same
API the CLI uses.

## Features

Implemented and verified as described in [Verification status](#verification-status):

- Register endpoints to watch: URL, HTTP method, expected status, timeout,
  check interval (30s to 24h), custom headers, optional incident webhook URL.
- Periodic checks scheduled with BullMQ repeatable jobs, one job per monitor.
  Schedules are re-synced from the database on API startup, and rescheduled
  automatically when a monitor's interval or enabled flag changes.
- Background worker pool (concurrency 5) performs the checks. Response time
  is time-to-first-byte. A hard timeout is enforced with `AbortController`.
  A check is "up" only when the HTTP status exactly matches the expected
  status.
- Downtime detection: an incident opens after N consecutive failures
  (`INCIDENT_THRESHOLD`, default 2) and resolves on the first successful
  check after that. Further failures while an incident is open only raise
  its failed-check count. Incidents can also be resolved manually.
- Incident management: open/resolved lifecycle, failure counts, cause,
  durations, manual resolution, and an optional webhook POST on open and
  on resolve (`incident.opened`, `incident.resolved`).
- Uptime percentages over 24h / 7d / 30d, plus average, minimum, and maximum
  response time over 24h.
- Every check result is stored in PostgreSQL. Results older than 90 days
  are pruned by a daily worker job. Incidents are kept indefinitely.
- Public status pages (`/status`, `/status/:slug`) with no auth, cached in
  Redis for 30 seconds (`x-cache: HIT` / `MISS`) with graceful fallback to
  PostgreSQL when Redis is down.
- Dashboard: monitor cards with live status, uptime bars, and latency;
  per-monitor detail with a response-time chart, check history, and
  incidents; an incident inbox with open/resolved/all filters; "Check now",
  pause, resume, and delete actions.
- Demo target service with `/ok`, `/slow`, `/flaky`, `/dead`, and `/hang`
  endpoints, so you can watch checks, incidents, and recovery happen live.
- Unit-tested core logic: the incident state machine (`apps/worker`) and the
  uptime, percentile, and slug helpers (`apps/api`) run with plain `tsx`
  and need no database.

Not included: alerting by email or SMS, multi-user accounts, role-based
access, TLS termination, or hosted deployment. The management API uses a
single shared API key (see [Security](#security)).

## Screenshots

No headless browser is available in the verification environment, so there
are no GUI screenshots. What exists instead is genuine terminal output
captured while running the code on 2026-11-06, in `docs/screenshots/`:

- `api-unit-tests.txt` - 18 API unit checks passing.
- `worker-unit-tests.txt` - 9 worker unit checks passing.
- `api-worker-build-and-prisma-validate.txt` - `tsc` builds for the API and
  worker, and the first `prisma validate` attempt, which fails without
  `DATABASE_URL` set (the schema reads it from the environment).
- `prisma-validate.txt` - `prisma validate` passing for both schemas once a
  `DATABASE_URL` value is present in the environment.
- `web-next-build.txt` - `next build` for the dashboard, including the route
  table.
- `demo-target-live-curl.txt` - the demo target running live: `/ok` returns
  200, `/slow` returns 200 in about 2.55s, `/dead` returns 500, `/hang`
  times out, `/flaky` alternates 200 and 500.
- `api-live-health-check.txt` - the API starting with no PostgreSQL and no
  Redis, and `GET /health` not answering within 60 seconds in that state.
  See the known limitation in [Verification status](#verification-status).
- `api-start-without-database.txt` - the API startup log with both backing
  services unreachable.

## Architecture

```mermaid
flowchart TB
    User([Operator / dashboard user])
    Web[Next.js dashboard :3000]
    API[Express API :3001<br/>/api/* x-api-key<br/>/status/* public]
    Worker[BullMQ worker<br/>concurrency 5]
    Queue[(Redis :6379<br/>health-checks queue<br/>30s status cache)]
    DB[(PostgreSQL :5432<br/>monitors, checks, incidents)]
    Target[Demo target :4000<br/>/ok /slow /flaky /dead /hang]
    Hook([Incident webhook<br/>optional])

    User --> Web
    Web --> API
    API --> DB
    API --> Queue
    API -.->|repeatable jobs| Queue
    Queue --> Worker
    Worker --> DB
    Worker --> Target
    Worker -.-> Hook
    API -.->|status cache| Queue
```

Check flow: repeatable job fires, the worker fetches the URL, a `CheckResult`
row is stored, the consecutive-failure counter is updated, and the incident
state machine decides: open, count, resolve, or nothing. On open or resolve,
the optional webhook fires.

Status flow: `GET /status/:slug` reads Redis first (30s TTL, `x-cache: HIT`).
On a miss it aggregates from PostgreSQL and caches the result. When Redis is
down, the API serves everything straight from PostgreSQL.

Data model (Prisma, PostgreSQL): `Monitor` 1-N `CheckResult`, `Monitor` 1-N
`Incident`. See `docs/architecture.md` and `apps/api/prisma/schema.prisma`.

## Tech stack

| Layer | Technology |
| --- | --- |
| Language | TypeScript, Node.js 20+ (strict mode) |
| API | Express 4, `x-api-key` auth, JSON body limit 256kb |
| Queue | BullMQ 5 on Redis 7 (ioredis) |
| Database | PostgreSQL 16 via Prisma 5 |
| Dashboard | Next.js 14 (App Router, standalone output), React 18, Tailwind CSS 3 |
| Worker | BullMQ worker, plain `fetch` with `AbortController` timeouts |
| Tests | Plain `tsx` test scripts, no test framework, no database needed |
| Containers | Docker Compose, multi-stage Node 20 slim images |

## Prerequisites

- Node.js 20 or later and npm.
- Docker and the Compose plugin, for the full stack (PostgreSQL, Redis, and
  all four services). This is the recommended way to run it.
- Without Docker you can still run the unit tests, the TypeScript builds,
  the Next.js build, `prisma validate`, and the demo target. The API,
  worker, and dashboard need a reachable PostgreSQL and Redis to do useful
  work.

## Installation

```bash
git clone https://github.com/mrpythonist/api-health-monitor.git
cd api-health-monitor
cp .env.example .env
# Edit .env and set a strong ADMIN_API_KEY (and mirror it in API_KEY).
```

## Configuration

All variables live in `.env` at the repo root. See `.env.example` for the
full annotated list.

| Variable | Used by | Default | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | api, worker | - | PostgreSQL connection string |
| `REDIS_URL` | api, worker | - | Redis (BullMQ queue; optional 30s status cache in the API) |
| `ADMIN_API_KEY` | api | - | Management API key, sent as `x-api-key` |
| `API_KEY` | web | - | Same value as `ADMIN_API_KEY`, server-side only |
| `API_URL` | web | `http://localhost:3001` | How the dashboard reaches the API (server-side) |
| `INCIDENT_THRESHOLD` | api, worker | `2` | Consecutive failures before an incident opens |
| `DEMO_TARGET_URL` | seed | `http://localhost:4000` | Base URL the seed script points monitors at |
| `PORT` | api | `3001` | API listen port |

Notes:

- If `ADMIN_API_KEY` is not set, the API returns 500 for every management
  route. If the seed runs without it, the seed generates a random key for
  that run and prints it; set it in `.env` to keep using it.
- `REDIS_URL` is required for checks to be scheduled. If it is unset or
  unreachable, the API still serves reads and writes, but no checks run,
  and the status pages run uncached.
- The worker exits at startup if `REDIS_URL` is not set.
- `docker-compose.yml` uses `postgres:postgres` as the local database
  password. That is a local development default only. Change it before
  exposing the stack anywhere outside your own machine.

## Quick start

### With Docker Compose (recommended)

```bash
cp .env.example .env
# Edit .env: set a strong ADMIN_API_KEY (and mirror it in API_KEY).
docker compose up --build
# In another terminal, seed the demo monitors once:
docker compose run --rm -e DEMO_TARGET_URL=http://demo-target:4000 api npm run seed
```

- API: http://localhost:3001 (`/health` to check, when Redis is up)
- Dashboard: http://localhost:3000
- Demo target: http://localhost:4000

The seed creates 5 monitors against the demo target. Within a couple of
minutes you will see the flaky, down, and hanging ones open incidents.

Management API calls need the `x-api-key` header (the value of
`ADMIN_API_KEY`).

### Local development

```bash
# Start PostgreSQL, Redis, and the demo target:
docker compose up -d postgres redis demo-target

# API:
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
npm run dev    # http://localhost:3000 (uses API_URL/API_KEY from ../../.env)
```

`prisma migrate deploy` applies `apps/api/prisma/migrations/0001_init`.
The worker uses an identical copy of the schema
(`apps/worker/prisma/schema.prisma`); the API image runs the migration on
container start.

## Usage

### Dashboard

Open http://localhost:3000. The overview lists every monitor with its
current status, 24h uptime, and average response time. Each monitor has a
detail page with a response-time chart, the last 50 checks, and its last 20
incidents. The incident inbox at `/incidents` filters by open, resolved,
or all. From the dashboard you can create a monitor, trigger a check now,
pause or resume a monitor, delete it, and resolve an incident manually.

Public status pages need no login: `/status` lists every enabled monitor,
`/status/:slug` shows one monitor with uptime windows, its open incident,
recent resolved incidents, and the last 20 checks.

### Demo target

The demo target (`apps/demo-target`, port 4000) exists so the monitoring
loop can be seen working without a real service to watch:

| Endpoint | Behaviour |
| --- | --- |
| `GET /ok` | 200 immediately |
| `GET /slow` | 200 after about 2.5s |
| `GET /flaky` | Alternates 200 and 500 on successive hits |
| `GET /dead` | 500 always |
| `GET /hang` | Never responds, so the monitor timeout fires |

## API reference

Base URL: `http://localhost:3001`. All `/api/*` routes require the
`x-api-key` header. `/status/*` is public. `GET /health` returns
`{"ok": true, "queue": <bool>, "time": "<iso>"}` when Redis is reachable;
see the known limitation below for what happens when it is not.

Errors are JSON: `{"error": "<message>"}`. Unknown routes return 404 with
`{"error": "not found"}`.

### Monitors

```bash
AUTH="x-api-key: <redacted>

# List monitors (current status, 24h uptime, open incident)
curl -s http://localhost:3001/api/monitors -H "$AUTH"

# Register an endpoint
curl -s -X POST http://localhost:3001/api/monitors -H "$AUTH" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Payments API","url":"https://api.example.com/health",
       "intervalSeconds":60,"timeoutMs":10000,"expectedStatus":200,
       "incidentWebhookUrl":"https://hooks.example.com/incidents"}'

# Detail: uptime 24h/7d/30d, latency stats, recent checks, incidents
curl -s http://localhost:3001/api/monitors/<id> -H "$AUTH"

# Update (reschedules automatically when interval/enabled change)
curl -s -X PATCH http://localhost:3001/api/monitors/<id> -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{"intervalSeconds":300}'

# Trigger an immediate check
curl -s -X POST http://localhost:3001/api/monitors/<id>/check -H "$AUTH"

# Delete (also removes its scheduled job)
curl -s -X DELETE http://localhost:3001/api/monitors/<id> -H "$AUTH"
```

Monitor fields and validation (enforced by the API, 400 on bad input):

| Field | Type | Default | Rules |
| --- | --- | --- | --- |
| `name` | string | - | Required, non-empty |
| `url` | string | - | Required, valid `http(s)` URL |
| `method` | string | `GET` | One of `GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS` |
| `expectedStatus` | integer | `200` | 100-599 |
| `timeoutMs` | integer | `10000` | 1000-60000 |
| `intervalSeconds` | integer | `60` | 30-86400 |
| `headers` | object | - | JSON object of header name to value |
| `incidentWebhookUrl` | string or null | `null` | Valid `http(s)` URL or null |
| `enabled` | boolean | `true` | `false` pauses checks and removes the schedule |

Responses: `POST` returns 201 with the monitor. `GET /api/monitors/:id`
returns the monitor plus `uptime` (`24h`, `7d`, `30d`), `latency24h`
(`avgMs`, `minMs`, `maxMs`, `samples`), the last 50 `recentChecks`, and
the last 20 `incidents`. `DELETE` returns 204. `POST .../check` returns
202 with `{"queued": true}`, or 503 with
`{"error": "check queue unavailable - is Redis running?"}` when Redis is
down. Unknown monitor ids return 404 with `{"error": "monitor not found"}`.

Slugs are generated from the monitor name plus a random suffix
(`payments-api-a3f9c1`), so duplicate names still get unique public status
pages.

### Incidents

```bash
# List (status=open|resolved|all, default open; max 100 rows)
curl -s 'http://localhost:3001/api/incidents?status=all' -H "$AUTH"

# Manually resolve (resolving an already-resolved incident returns it unchanged)
curl -s -X PATCH http://localhost:3001/api/incidents/<id>/resolve -H "$AUTH"
```

Unknown incident ids return 404 with `{"error": "incident not found"}`.
Manually resolved incidents record `resolvedBy: "manual"`; worker-resolved
ones record `resolvedBy: "worker"`.

### Public status pages

```bash
curl -s http://localhost:3001/status | jq .overall
curl -s http://localhost:3001/status/<slug> | jq '{uptime, openIncident}'
```

`GET /status` returns `generatedAt`, `overall` (`operational` or
`degraded`), and every enabled monitor with its 24h uptime.
`GET /status/:slug` returns the monitor, uptime for 24h/7d/30d, the open
incident (or null), the last 10 resolved incidents, and the last 20 checks.
Both responses carry an `x-cache` header (`HIT` or `MISS`). A disabled or
unknown slug returns 404 with `{"error": "status page not found"}`.

### Incident webhook payload

When a monitor has an `incidentWebhookUrl`, the worker POSTs JSON to it on
open and on resolve. Delivery is fire-and-forget with a 5 second timeout:
a failing webhook is logged and never fails the check.

```json
{
  "event": "incident.opened",
  "monitor": { "id": "...", "name": "Payments API", "url": "https://api.example.com/health" },
  "incident": { "id": "...", "cause": "unexpected status 500 (expected 200)", "failedChecks": 2, "startedAt": "2026-11-04T10:00:00.000Z", "resolvedAt": null },
  "checkedAt": "2026-11-04T10:00:00.000Z"
}
```

`event` is `incident.opened` or `incident.resolved`. `resolvedAt` is null
on open. The request sends `Content-Type: application/json` and
`User-Agent: api-health-monitor/1.0`.

Full endpoint detail, including response shapes, is in `docs/api.md`.

## Project structure

```
api-health-monitor/
  docker-compose.yml        # postgres, redis, demo-target, api, worker, web
  .env.example              # annotated list of every env var
  apps/
    api/                    # Express API + BullMQ scheduler + Prisma schema
      src/index.ts          # app wiring, /health, route mounts
      src/routes/           # monitors, incidents, public status pages
      src/scheduler.ts      # repeatable jobs, sync, check-now, queue health
      src/lib/uptime.ts     # uptime %, percentiles, averages (unit-tested)
      src/lib/slug.ts       # public status page slugs (unit-tested)
      src/test/uptime.test.ts
      prisma/schema.prisma  # Monitor, CheckResult, Incident
      prisma/migrations/0001_init/
    worker/                 # BullMQ check worker
      src/index.ts          # queue consumer, prune job, graceful shutdown
      src/check.ts          # one HTTP check with hard timeout
      src/incidents.ts      # incident state machine (unit-tested)
      src/webhook.ts        # fire-and-forget incident webhook POST
      src/test/incidents.test.ts
      prisma/schema.prisma  # identical copy of the API schema
    web/                    # Next.js dashboard + public status pages
      app/                  # overview, monitor detail, incidents, status pages
      components/           # monitor form, actions, charts, badges
      lib/api.ts            # server-side API client (key never reaches the browser)
    demo-target/            # /ok, /slow, /flaky, /dead, /hang
  docs/
    architecture.md         # components, flows, data model, failure modes
    development.md          # local setup, scripts, debugging
    api.md                  # full endpoint reference
    screenshots/            # genuine terminal captures (no GUI screenshots)
```

## Testing

There is no test framework. Each app has a plain `tsx` script that prints
`ok` per check and exits non-zero on the first failure. No database is
needed for any of them.

```bash
cd apps/api && npm test      # 18 checks: uptime math, percentiles, averages, slugs
cd apps/worker && npm test   # 9 checks: incident state machine
```

27 checks in total, all passing on 2026-11-06 (see
`docs/screenshots/api-unit-tests.txt` and
`docs/screenshots/worker-unit-tests.txt`).

Other verified commands:

```bash
cd apps/api && npm run build        # tsc, clean
cd apps/worker && npm run build     # tsc, clean
cd apps/demo-target && npm run build  # tsc, clean
cd apps/web && npm run build        # next build, clean
# prisma validate needs DATABASE_URL in the environment:
cd apps/api && DATABASE_URL='postgresql://postgres:postgres@localhost:5432/apihealth' npx prisma validate
```

There is no lint script in any `package.json`. `apps/web` has no test
script. The worker and API have `dev` (`tsx watch`), `start`
(`node dist/index.js`), and `build` scripts; the API also has `seed`
(`tsx src/seed.ts`). The demo target has `dev`, `start`, and `build`.

## Deployment

### Docker Compose on one host

The compose stack is a single-host deployment, so it maps directly onto
one small server:

1. Launch a server (Amazon Linux 2023 / Ubuntu 22.04, t3.small or similar),
   open ports 3000/3001 (or put a load balancer in front and keep them
   private).
2. Install Docker and the Compose plugin, copy the repo and `.env`, then
   `docker compose up -d --build`.
3. Run migrations and seed once:
   `docker compose run --rm api npx prisma migrate deploy && docker compose run --rm -e DEMO_TARGET_URL=http://demo-target:4000 api npm run seed`
4. Point a DNS record at the server or load balancer; terminate TLS at the
   load balancer.

For CloudWatch: install the CloudWatch agent and ship the containers'
stdout (the worker logs every check outcome and every incident open/resolve
in a parseable one-line format), then create a metric filter on
`INCIDENT OPENED` and alarm on it. That gives you paging on top of the
built-in incident records and webhooks. None of this is provisioned in the
repo; it is a documented next step, not a claim.

Backups: PostgreSQL holds all history. Back up the `pgdata` volume on a
schedule; there is no backup automation in the repo.

## Verification status

Verified on 2026-11-06 on a VM with Node 24 and no Docker daemon, no
PostgreSQL, and no Redis:

- `tsc` clean for `apps/api`, `apps/worker`, and `apps/demo-target`.
- `next build` clean for `apps/web`.
- `prisma validate` clean for both copies of the schema (needs
  `DATABASE_URL` set in the environment; without it validation fails with
  `Environment variable not found: DATABASE_URL`).
- Unit tests pass: 18 checks in `apps/api`, 9 in `apps/worker`
  (27 total).
- Demo target runs live: `/ok`, `/slow`, `/flaky`, `/dead`, and `/hang`
  all behave as documented (see `docs/screenshots/demo-target-live-curl.txt`).
- The API process starts and listens on :3001 with no PostgreSQL and no
  Redis, warning once about each missing service.

Not verified here, flagged honestly; each needs a machine with Docker:

- `docker compose up` end to end, the initial migration against a live
  PostgreSQL, and the seed against the live demo target.
- BullMQ repeatable scheduling against a real Redis.
- Webhook delivery against a real receiver.

Known limitation found during verification:

- `GET /health` did not answer within 60 seconds with Redis down. It calls
  `queueHealth()`, which waits on BullMQ/Redis readiness, so the request
  blocks instead of returning `{"ok": true, "queue": false}`. Until this is
  fixed, treat `/health` as meaningful only when Redis is up, and do not
  use it as a fast liveness probe in an environment where Redis may be
  down. See `docs/screenshots/api-live-health-check.txt`.

## Security

- The management API is protected by a single shared key
  (`ADMIN_API_KEY`, sent as `x-api-key`). Keep it long and random, never
  commit it, and rotate it if it leaks. There is no per-user auth.
- The dashboard key (`API_KEY`) is server-side only; the browser never
  sees it. Public status pages use the keyless `/status` endpoints.
- JSON bodies are limited to 256kb. Monitor URLs must be valid `http(s)`.
- Custom headers on a monitor are sent to the monitored URL on every
  check. Do not put secrets in monitor headers unless you trust that
  target.
- Incident webhook URLs receive incident data on open and resolve. Use
  HTTPS for webhook receivers.
- `docker-compose.yml` ships with the local development database password
  `postgres:postgres`. Change it before exposing the stack.
- To report a security issue, see [SECURITY.md](SECURITY.md).

## Roadmap

Work that is known to be unfinished, in rough priority order. These are
open items, not promises with dates:

- Verify the full stack end to end with Docker Compose: migration against
  live PostgreSQL, seed against the live demo target, scheduling against
  real Redis, webhook delivery against a real receiver.
- Fix `GET /health` so it answers promptly when Redis is down instead of
  blocking on queue readiness.
- Add a lint setup (there is currently no lint script) and a CI workflow.
- Add an end-to-end smoke test that runs the demo target, registers a
  monitor, and asserts an incident opens and resolves.
- Consider per-monitor alerting options beyond webhooks (for example
  email), and retention controls for incidents.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Bug reports and small, focused pull
requests are welcome. Please include steps to reproduce for bugs, and keep
changes to one concern per pull request.

## Support

See [SUPPORT.md](SUPPORT.md) for how to get help and what to include in a
question.

## License

MIT. See [LICENSE](LICENSE).
