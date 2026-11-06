# API Reference

Base URL: `http://localhost:3001` (or the value of `PORT`).

Auth: every `/api/*` route requires the `x-api-key` header with the
value of `ADMIN_API_KEY`. A missing or wrong key returns 401 with
`{"error": "invalid or missing x-api-key"}`. If `ADMIN_API_KEY` is not
configured at all, management routes return 500 with
`{"error": "server misconfigured: ADMIN_API_KEY missing"}`.

Public routes: `/status/*` needs no key. `GET /health` needs no key.

Errors are JSON: `{"error": "<message>"}`. Unknown routes return 404
with `{"error": "not found"}`.

## Health

### `GET /health`

Returns queue reachability. Known limitation: with Redis down this
endpoint blocks instead of answering, because it waits on BullMQ queue
readiness (observed 2026-11-06). Only rely on it when Redis is up.

Response (200):

```json
{ "ok": true, "queue": true, "time": "2026-11-04T10:00:00.000Z" }
```

## Monitors

### `GET /api/monitors`

List all monitors, oldest first, each with its 24h uptime, 24h average
response time, and its open incident (or null).

Response (200): an array of monitor objects:

```json
[
  {
    "id": "cm3...",
    "name": "Payments API",
    "slug": "payments-api-a3f9c1",
    "url": "https://api.example.com/health",
    "method": "GET",
    "expectedStatus": 200,
    "timeoutMs": 10000,
    "intervalSeconds": 60,
    "headers": null,
    "incidentWebhookUrl": null,
    "enabled": true,
    "consecutiveFails": 0,
    "lastStatus": "up",
    "lastCheckedAt": "2026-11-04T10:00:00.000Z",
    "createdAt": "2026-11-04T09:00:00.000Z",
    "updatedAt": "2026-11-04T10:00:00.000Z",
    "uptime24h": 99.5,
    "avgResponseMs24h": 123.4,
    "openIncident": null
  }
]
```

`uptime24h` and `avgResponseMs24h` are null when there are no checks in
the last 24 hours.

### `POST /api/monitors`

Register an endpoint to watch. The monitor is scheduled immediately
when enabled.

Request body (JSON):

| Field | Type | Default | Rules |
| --- | --- | --- | --- |
| `name` | string | - | Required, non-empty |
| `url` | string | - | Required, valid `http(s)` URL |
| `method` | string | `GET` | `GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS` |
| `expectedStatus` | integer | `200` | 100-599 |
| `timeoutMs` | integer | `10000` | 1000-60000 |
| `intervalSeconds` | integer | `60` | 30-86400 |
| `headers` | object | - | JSON object of header name to value |
| `incidentWebhookUrl` | string or null | `null` | Valid `http(s)` URL or null |
| `enabled` | boolean | `true` | `false` creates the monitor paused |

Validation failure returns 400 with `{"error": "<reason>"}`.

Response (201): the created monitor object.

### `GET /api/monitors/:id`

Detail for one monitor.

Response (200):

```json
{
  "monitor": { "...": "monitor object, see GET /api/monitors" },
  "uptime": { "24h": 99.5, "7d": 99.8, "30d": 99.9 },
  "latency24h": { "avgMs": 123.4, "minMs": 98, "maxMs": 412, "samples": 1420 },
  "recentChecks": [
    { "id": "...", "monitorId": "...", "status": "up", "statusCode": 200, "responseTimeMs": 121, "error": null, "checkedAt": "2026-11-04T10:00:00.000Z" }
  ],
  "incidents": [
    { "id": "...", "monitorId": "...", "status": "open", "cause": "unexpected status 500 (expected 200)", "failedChecks": 2, "startedAt": "2026-11-04T09:58:00.000Z", "resolvedAt": null, "resolvedBy": null }
  ]
}
```

`uptime` values are null when there are no checks in that window.
`latency24h` values are null (and `samples` 0) with no successful
checks in 24 hours. `recentChecks` holds at most 50 rows, `incidents`
at most 20, both newest first.

Unknown id returns 404 with `{"error": "monitor not found"}`.

### `PATCH /api/monitors/:id`

Update a monitor. Any subset of the `POST` fields may be sent. The
merged record is validated with the same rules. Changing
`intervalSeconds` or `enabled` reschedules the monitor automatically.
Disabling a monitor removes its scheduled job; re-enabling schedules
it again.

Response (200): the updated monitor object. Unknown id returns 404
with `{"error": "monitor not found"}`.

### `DELETE /api/monitors/:id`

Delete a monitor, its check history, and its incidents (database
cascade), and remove its scheduled job. Its cached status page is also
invalidated.

Response: 204 with no body. Unknown id returns 404 with
`{"error": "monitor not found"}`.

### `POST /api/monitors/:id/check`

Enqueue an immediate one-off check for the monitor.

Response (202): `{"queued": true}`.

If Redis is unavailable the response is 503 with
`{"error": "check queue unavailable - is Redis running?"}`. Unknown id
returns 404 with `{"error": "monitor not found"}`.

## Incidents

### `GET /api/incidents`

List incidents, newest first, at most 100 rows. Each incident includes
a small monitor summary (`id`, `name`, `url`, `slug`).

Query parameter: `status=open` (default), `resolved`, or `all`.

```bash
curl -s 'http://localhost:3001/api/incidents?status=all' -H 'x-api-key: <redacted>
```

Response (200):

```json
[
  {
    "id": "...",
    "monitorId": "...",
    "status": "open",
    "cause": "timeout after 5000ms",
    "failedChecks": 3,
    "startedAt": "2026-11-04T09:58:00.000Z",
    "resolvedAt": null,
    "resolvedBy": null,
    "monitor": { "id": "...", "name": "Payments API", "url": "https://api.example.com/health", "slug": "payments-api-a3f9c1" }
  }
]
```

### `PATCH /api/incidents/:id/resolve`

Manually resolve an open incident. Sets `status` to `resolved`,
`resolvedAt` to now, and `resolvedBy` to `manual`.

Response (200): the updated incident object. Resolving an
already-resolved incident returns it unchanged with 200. Unknown id
returns 404 with `{"error": "incident not found"}`.

## Public status pages

No auth. Responses carry an `x-cache` header: `HIT` when Redis served
the response, `MISS` when it was aggregated from PostgreSQL.

### `GET /status`

Every enabled monitor with its current state and 24h uptime.

Response (200):

```json
{
  "generatedAt": "2026-11-04T10:00:00.000Z",
  "overall": "operational",
  "monitors": [
    { "id": "...", "name": "Payments API", "slug": "payments-api-a3f9c1", "url": "https://api.example.com/health", "lastStatus": "up", "lastCheckedAt": "2026-11-04T10:00:00.000Z", "uptime24h": 99.5 }
  ]
}
```

`overall` is `operational` when no enabled monitor is currently down,
otherwise `degraded`.

### `GET /status/:slug`

One monitor's public status data.

Response (200):

```json
{
  "generatedAt": "2026-11-04T10:00:00.000Z",
  "monitor": { "name": "Payments API", "slug": "payments-api-a3f9c1", "url": "https://api.example.com/health", "lastStatus": "up", "lastCheckedAt": "2026-11-04T10:00:00.000Z" },
  "uptime": { "24h": 99.5, "7d": 99.8, "30d": 99.9 },
  "openIncident": null,
  "recentIncidents": [],
  "recentChecks": [
    { "status": "up", "statusCode": 200, "responseTimeMs": 121, "checkedAt": "2026-11-04T10:00:00.000Z" }
  ]
}
```

`recentIncidents` holds at most 10 resolved incidents, `recentChecks`
at most 20 checks, both newest first. A disabled or unknown slug
returns 404 with `{"error": "status page not found"}`.

## Incident webhook

When a monitor has an `incidentWebhookUrl`, the worker POSTs JSON to
it when an incident opens and when it resolves. Delivery is
fire-and-forget with a 5 second timeout; a failing webhook is logged
and never fails the check.

Headers: `Content-Type: application/json`,
`User-Agent: api-health-monitor/1.0`.

Payload:

```json
{
  "event": "incident.opened",
  "monitor": { "id": "...", "name": "Payments API", "url": "https://api.example.com/health" },
  "incident": { "id": "...", "cause": "unexpected status 500 (expected 200)", "failedChecks": 2, "startedAt": "2026-11-04T09:58:00.000Z", "resolvedAt": null },
  "checkedAt": "2026-11-04T09:58:00.000Z"
}
```

`event` is `incident.opened` or `incident.resolved`. `resolvedAt` is
null on open and set on resolve. Note: webhook delivery against a real
receiver has not been verified yet (see the README Verification status
section).

## Examples

```bash
AUTH="x-api-key: <redacted>

# List monitors
curl -s http://localhost:3001/api/monitors -H "$AUTH"

# Register an endpoint
curl -s -X POST http://localhost:3001/api/monitors -H "$AUTH" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Payments API","url":"https://api.example.com/health",
       "intervalSeconds":60,"timeoutMs":10000,"expectedStatus":200}'

# Trigger an immediate check
curl -s -X POST http://localhost:3001/api/monitors/<id>/check -H "$AUTH"

# Public status overview
curl -s http://localhost:3001/status | jq .overall
```
