# Contributing to API Health Monitoring and Incident Tracker

Thank you for considering a contribution. This project is a small, focused
monitoring platform, and the goal is to keep it readable and honest about
what is verified. Small, well-tested changes are preferred over large ones.

## Getting started

1. Fork the repository and clone your fork.
2. Copy the environment template and set a key for local use:

   ```bash
   cp .env.example .env
   ```

   Set `ADMIN_API_KEY` to a long random value. Never commit a real key.
3. Install dependencies for the app you are changing. Each app is a
   separate package with its own `package.json`:

   ```bash
   cd apps/api && npm ci
   cd ../worker && npm ci
   cd ../web && npm ci
   cd ../demo-target && npm ci
   ```

4. Run the unit tests for the app you changed before opening a pull
   request (see [Testing](#testing)).

The full stack needs Docker Compose with PostgreSQL and Redis. Without
Docker you can still run the tests, the TypeScript builds, the Next.js
build, `prisma validate`, and the demo target. See `docs/development.md`
for the full local setup.

## Branches and commits

- Create a feature branch from `main` with a short descriptive name, for
  example `fix-health-redis-timeout` or `docs-api-reference`.
- Keep each commit to one logical change. Write commit messages in the
  imperative mood with a short summary line, for example
  `Fix /health blocking when Redis is down`. Add a longer explanation in
  the commit body when the reason is not obvious from the diff.
- Do not commit `node_modules/`, `dist/`, `.next/`, `.env`, or any file
  containing a real key, token, or password. `.env.example` is the only
  env file that belongs in the repo, and it must contain placeholders only.

## Testing

There is no test framework. Tests are plain `tsx` scripts that print `ok`
per check and exit non-zero on the first failure. They need no database.

```bash
cd apps/api && npm test      # 18 checks: uptime math, percentiles, slugs
cd apps/worker && npm test   # 9 checks: incident state machine
```

If you change behaviour in `apps/api/src/lib/uptime.ts`,
`apps/api/src/lib/slug.ts`, or `apps/worker/src/incidents.ts`, add or
update a check in the matching test file. If you change an endpoint,
update `docs/api.md` and the README API reference in the same pull
request.

Before submitting, also run the builds for the apps you touched:

```bash
cd apps/api && npm run build
cd apps/worker && npm run build
cd apps/demo-target && npm run build
cd apps/web && npm run build
```

`prisma validate` needs `DATABASE_URL` set in the environment, even
though validation does not connect to a database:

```bash
cd apps/api && DATABASE_URL='postgresql://postgres:postgres@localhost:5432/apihealth' npx prisma validate
```

There is currently no lint script in the repo. Match the existing code
style: TypeScript strict mode, two-space indentation, single quotes, and
no unused imports or variables (`tsc` will catch most of these).

## Pull request process

1. Open an issue first for anything larger than a small fix, so the
   direction can be agreed before you write a lot of code.
2. Keep the pull request to one concern. A pull request that mixes a
   feature, a refactor, and a docs rewrite is hard to review.
3. Fill in the pull request template: what changed, why, how it was
   tested, and what is still not verified (for example, "not tested
   against a live Redis").
4. Do not claim verification you have not done. If Docker, a live
   database, or a real webhook receiver was not available, say so in the
   pull request. Honest gaps are fine; unverified claims are not.
5. Update documentation with code changes. At minimum, keep the README
   and `docs/api.md` accurate.
6. A maintainer will review the pull request. Be ready to answer
   questions and make small follow-up changes.

## Reporting bugs

Use the bug report template in `.github/ISSUE_TEMPLATE/bug_report.yml`.
Include the steps to reproduce, what you expected, what actually
happened, the app and version or commit, and the relevant log output.
If the bug involves a check, an incident, or a webhook, include the
monitor configuration (without any secrets) and the incident cause
string if one was recorded.

## Code of conduct

This project follows the Contributor Covenant. See
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Be respectful and direct, and
assume good intent.
