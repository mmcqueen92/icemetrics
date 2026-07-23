# GitHub Workflow

## Branching

- `main` is protected, releasable, and auto-deploys to staging after CI.
- Work occurs on short-lived branches named
  `<type>/<issue>-<short-description>`.
- Merge through pull requests using squash merge.
- Direct pushes, force pushes, and deletion of `main` are disabled.
- Production promotion uses an approved GitHub environment and the exact commit
  already verified in staging.

Long-lived develop/release branches are not used.

## Commits

Use imperative Conventional Commit subjects:

```text
feat(players): add paginated player search
fix(ingestion): retain corrected box score payload
docs(api): define comparison response
```

Keep commits focused and never mix unrelated formatting or generated changes
with behavior when separation makes review clearer.

## Required Pull Request Checks

- formatting;
- lint;
- typecheck;
- unit/component tests;
- PostgreSQL/API integration tests;
- Playwright end-to-end tests when the harness exists;
- OpenAPI/generated-client drift;
- production builds;
- dependency/secret/security scans; and
- migration verification when schema changes.

## Pull Request Description

Every pull request states:

- outcome and motivation;
- linked issue/pass;
- authoritative docs;
- tests and commands run;
- API/database/deployment impact;
- screenshots for material UI changes; and
- follow-up work that is explicitly out of scope.

## Review Checklist

- Acceptance criteria are met.
- Controllers, services, repositories, and provider boundaries are preserved.
- Tests cover failure and edge behavior.
- Migrations and custom SQL are reviewed.
- OpenAPI and generated client are synchronized.
- No secrets or licensed media are committed.
- Relevant docs/ADRs are updated.
- Operational and rollback impact is understood.

## Releases

Release tags are created only after the production release gate in
`docs/39-release-strategy.md`. Do not tag a commit that differs from the
staging-verified production artifact.
