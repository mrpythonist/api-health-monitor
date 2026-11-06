# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Rewrote the README from scratch with a full API reference, configuration
  table, project structure, deployment notes, and an honest verification
  status section.
- Added community files: `LICENSE` (MIT), `CONTRIBUTING.md`,
  `CODE_OF_CONDUCT.md`, `SECURITY.md`, and `SUPPORT.md`.
- Added `docs/architecture.md`, `docs/development.md`, and `docs/api.md`.
- Added GitHub issue templates (bug report, feature request) and a pull
  request template.
- Added `docs/screenshots/` with genuine terminal captures from running
  the tests, builds, schema validation, the demo target, and the API
  startup on 2026-11-06.
- Expanded `.gitignore` to cover env files, build output, logs, coverage,
  OS files, and editor files.

### Fixed

- Corrected the unit test count in the README: 27 checks (18 API, 9
  worker), verified by running them. An earlier draft said 28.

## [0.1.0] - 2026-11-04

Initial public commit (`e830e09`).

### Added

- Express API with monitor, incident, and public status endpoints,
  protected by an `x-api-key` header on management routes.
- BullMQ scheduling of periodic health checks (one repeatable job per
  monitor) and a worker pool with concurrency 5.
- Incident state machine: an incident opens after N consecutive failures
  (default 2) and resolves on the first successful check; manual
  resolution and incident webhooks included.
- PostgreSQL data model via Prisma (Monitor, CheckResult, Incident) with
  the initial migration `0001_init`.
- Public status pages with a 30 second Redis cache and PostgreSQL
  fallback.
- Next.js dashboard with monitor overview, monitor detail, incident
  inbox, and public status pages.
- Demo target service with `/ok`, `/slow`, `/flaky`, `/dead`, and `/hang`
  endpoints.
- Unit checks for uptime math and the incident state machine, runnable
  with `npm test` and no database.
- Docker Compose stack for PostgreSQL, Redis, demo target, API, worker,
  and dashboard.
