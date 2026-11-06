# Support

## Getting help

If you are stuck setting up or running the project, work through these
steps first:

1. Read the README, especially the Configuration and Quick start sections.
   Most setup problems are a missing or mismatched env var.
2. Read `docs/development.md` for the local setup and the commands that
   are verified to work.
3. Check the known limitations in the README Verification status section.
   Docker end-to-end runs, the live migration, and webhook delivery
   against a real receiver have not been verified yet.
4. Search the existing GitHub issues to see if someone already reported
   the same problem.

## Opening an issue

Use the issue templates in this repository:

- Bug report: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Feature request: `.github/ISSUE_TEMPLATE/feature_request.yml`

For a question or a bug, include:

- What you were trying to do and what happened instead.
- The exact commands you ran and the full error output or log lines.
- Your environment: operating system, Node.js version (`node --version`),
  whether you used Docker Compose or a local setup, and the commit you
  are on (`git rev-parse --short HEAD`).
- The relevant part of your `.env` with secrets removed. Never paste a
  real `ADMIN_API_KEY`, `API_KEY`, database password, or webhook URL
  that contains a token.

For a feature request, describe the problem it solves and how you would
use it. A short example of the API or dashboard behaviour you expect
helps a lot.

## Security issues

Do not open a public issue for a security problem. See
[SECURITY.md](SECURITY.md) for how to report it.

## Response time

This project is maintained by one person alongside other work. Issues
are usually answered within a few days. Pull requests that follow
[CONTRIBUTING.md](CONTRIBUTING.md) get reviewed first.
