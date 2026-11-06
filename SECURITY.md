# Security Policy

## Supported versions

This is a small project with a single main line. Security fixes are applied
to the latest commit on `main`. There are no maintained release branches.
If you are running an older checkout, update to the latest `main` first.

| Version | Supported |
| --- | --- |
| Latest `main` | Yes |
| Older commits | No, please update |

## Reporting a vulnerability

If you find a security issue, please report it through a GitHub issue in
this repository, or through the contact options on
https://mrpythonist.com. Do not include secrets, real API keys, or
personal data in the report.

To help the report get fixed quickly, include:

- A description of the issue and what an attacker could do with it.
- Steps to reproduce, with the smallest setup that shows the problem.
- The commit or version you tested against.
- Any suggested fix, if you have one.

You will get a response confirming the report, and an update once a fix
is ready. If the issue is confirmed, a fix will be prioritised on `main`
and noted in `CHANGELOG.md`.

## Known security notes

These are properties of the current design, not vulnerabilities, but they
matter when you deploy the project:

- The management API uses one shared key (`ADMIN_API_KEY`, sent as
  `x-api-key`). There is no per-user auth. Keep the key long and random,
  never commit it, and rotate it if it leaks.
- The dashboard key (`API_KEY`) is server-side only. The browser never
  sees it. Public status pages use the keyless `/status` endpoints.
- Monitor URLs must be valid `http(s)`. Custom headers on a monitor are
  sent to the monitored URL on every check, so do not put secrets in
  monitor headers unless you trust that target.
- Incident webhooks POST incident data to the configured URL. Use HTTPS
  for webhook receivers.
- `docker-compose.yml` ships with the local development database password
  `postgres:postgres`. Change it before exposing the stack anywhere
  outside your own machine.
- JSON request bodies are limited to 256kb.
