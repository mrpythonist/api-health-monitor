# API Health Monitoring & Incident Tracker

A small monitoring platform that continuously checks APIs and tracks downtime —
a simplified Better Stack / UptimeRobot. Register endpoints, schedule periodic
health checks on a BullMQ queue, record every result in PostgreSQL, open
incidents after consecutive failures, resolve them on recovery, and publish
public status pages.

**Stack:** Node.js 20 + TypeScript, Express, BullMQ on Redis, PostgreSQL
(Prisma), Next.js 14 + Tailwind dashboard, Docker Compose. AWS EC2 /
CloudWatch deployment notes included (optional).

## Features

- Register API endpoints: URL, method, expected status, timeout, check
  interval (≥ 30s), custom headers, optional incident webhook URL
- Periodic health checks scheduled with BullMQ repeatable jobs — one job per
  monitor, re-synced from the database on API startup
- Background worker pool (concurrency 5) performs the checks: measures
  response time (time-to-first-byte), enforces a hard timeout via
  `AbortController`, records HTTP status vs. expected status
- Downtime detection: an incident opens after N consecutive failures
  (`INCIDENT_THRESHOLD`, default 2) and resolves on the first successful check
- Incident management: open/resolved lifecycle, failure counts, causes,
  durations, manual resolution, optional webhook POST on open/resolve
- Uptime percentages over 24h / 7d / 30d, plus avg/min/max response time
- Every check result stored in PostgreSQL (pruned after 90 days by a daily
  worker job); incidents kept indefinitely
- Public status pages (`/status`, `/status/:slug`) — no auth, cached in Redis
  for 30s with graceful fallback to PostgreSQL
- Dashboard: monitor cards with live status, uptime bars and latency, per-monitor
  detail with response-time chart + check history + incidents, incident inbox
  with open/resolved/all filters, "Check now" / pause / resume / delete actions
- Demo target service with `/ok`, `/slow`, `/flaky`, `/dead`, `/hang` endpoints
  so you can watch checks, incidents and recovery happen live
- Unit-tested core logic: incident state machine (`apps/worker`) and uptime /
  percentile math (`apps/api`) run with plain `tsx`, no database needed

## Architecture

```
                    ┌────────────────────┐
                    │  Demo target :4000 │  /ok /slow /flaky /dead /hang
                    └────────▲───────────┘
                             │ HTTP checks (timeout enforced)
                             │
 ┌──────────┐   ┌─────────────┴──────────────┐   ┌──────────────┐
 │ Next.js  │   │  Express API :3001         │   │  PostgreSQL  │
 │ :3000    │──▶│  /api/* (x-api-key)        ├──▶│  monitors,   │
 │ dashboard│   │  /status/* (public)        │   │  checks,     │
 │ + public │   │                            │   │  incidents   │
 │ status   │   │  scheduler: BullMQ         │   └──────────────┘
 │ pages    │   │  repeatable jobs           │
 └──────────┘   └─────────────┬──────────────┘   ┌──────────────┐
                              │ enqueue 'check'  │    Redis     │
                              ▼                  │    :6379     │
                ┌──────────────────────────┐  ┌─▶│ BullMQ queue │
                │ Worker (concurrency 5)   │──┘  │ + 30s status │
                │ perform check → store    │     │   page cache │
                │ result → incident state  │     └──────────────┘
                │ machine → webhook        │
                └──────────────────────────┘

Check flow:  repeatable job → worker fetches URL → CheckResult row →
             consecutiveFails++ / reset → open | count | resolve incident →
             optional webhook POST.

Status flow: /status/:slug → Redis (30s TTL, x-cache HIT) → else PostgreSQL
             aggregates (MISS), cache-through.
```

## Quickstart

### With Docker Compose (recommended)

```bash
cp .env.example .env
# Edit .env: set a strong ADMIN_API_KEY (and mirror it in API_KEY).
docker compose up --build
# In another terminal, seed the demo monitors once:
docker compose run --rm -e DEMO_TARGET_URL=http://demo-target:4000 api npm run seed
```

- API: http://localhost:3001 (`/health` to check)
- Dashboard: http://localhost:3000
- Demo target: http://localhost:4000
- The seed creates 5 monitors against the demo target; within a couple of
  minutes you will see the flaky/down/hanging ones open incidents.

Management API calls need the `x-api-key` header (the value of `ADMIN_API_KEY`).

### Local development

```bash
# Start PostgreSQL + Redis + demo target:
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

## API reference

All `/api/*` routes require the `x-api-key` header. `/status/*` is public.

### Monitors

```bash
AUTH="x-api-key: $ADMIN_API_KEY"

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

### Incidents

```bash
# List (status=open|resolved|all, default open)
curl -s 'http://localhost:3001/api/incidents?status=all' -H "$AUTH"

# Manually resolve
curl -s -X PATCH http://localhost:3001/api/incidents/<id>/resolve -H "$AUTH"
```

### Public status pages

```bash
curl -s http://localhost:3001/status | jq .overall
curl -s http://localhost:3001/status/<slug> | jq '{uptime, openIncident}'
```

## Configuration

| Variable | Used by | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | api, worker | — | PostgreSQL connection string |
| `REDIS_URL` | api, worker | — | Redis (BullMQ queue; optional 30s status cache in api) |
| `ADMIN_API_KEY` | api | — | Management API key (`x-api-key`) |
| `API_KEY` | web | — | Same value, server-side only |
| `API_URL` | web | `http://localhost:3001` | How the dashboard reaches the API (server-side) |
| `INCIDENT_THRESHOLD` | api, worker | `2` | Consecutive failures before an incident opens |
| `DEMO_TARGET_URL` | seed | `http://localhost:4000` | Base URL the seed script points monitors at |
| `PORT` | api | `3001` | API listen port |

## AWS EC2 / CloudWatch (optional)

The compose stack is a single-host deployment, so it maps directly onto one
EC2 instance:

1. Launch an EC2 instance (Amazon Linux 2023 / Ubuntu 22.04, t3.small+),
   open ports 3000/3001 (or put an ALB in front and keep them private).
2. Install Docker + the Compose plugin, copy the repo and `.env`, then
   `docker compose up -d --build`.
3. Run migrations + seed once:
   `docker compose run --rm api npx prisma migrate deploy && docker compose run --rm -e DEMO_TARGET_URL=http://demo-target:4000 api npm run seed`
4. Point a Route 53 record at the instance/ALB; terminate TLS at the ALB.

For CloudWatch: install the CloudWatch agent and ship the containers'
stdout (the worker logs every check outcome and every incident open/resolve in
a parseable one-line format), then create a metric filter on
`INCIDENT OPENED` and alarm on it — that gives you paging on top of the
built-in incident records and webhooks. None of this is provisioned in the
repo; it is a documented next step, not a claim.

## Verification status

VM-verified (no Docker daemon in this environment, so containers were not run):

- `tsc` clean for `apps/api`, `apps/worker`, `apps/demo-target`
- `next build` clean for `apps/web`
- `prisma validate` clean for the shared schema
- Unit tests pass: `npm test` in `apps/api` (uptime math, percentiles, slugs)
  and `apps/worker` (incident state machine, 8 cases)

Not verified here (flagged honestly, needs a machine with Docker):

- `docker compose up` end-to-end, the initial migration against a live
  PostgreSQL, and the seed against the live demo target
- BullMQ repeatable scheduling against a real Redis
- Webhook delivery against a real receiver

## Resume bullets

- Built an API health-monitoring platform (Node.js/TypeScript, Express,
  BullMQ/Redis, PostgreSQL/Prisma, Next.js, Docker Compose) that schedules
  periodic checks, tracks response times, and maintains uptime percentages
- Implemented downtime detection with a tested incident state machine
  (open on N consecutive failures, auto-resolve on recovery, manual resolve,
  webhook notifications) and public status pages with Redis caching
- Shipped a dashboard with per-endpoint uptime, latency charts, check history
  and an incident inbox, plus a demo target (healthy/slow/flaky/down/hanging)
  for end-to-end verification
