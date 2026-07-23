# Pass 0: Implementation Specification

## Objective

Make the project implementable without requiring a developer to invent
architectural decisions.

## Deliverables

- `AGENTS.md` references every existing context document and no missing path.
- Context and instructions are intended to be version-controlled.
- Repository layout, supported runtime, package manager, naming, and root command
  contract are fixed.
- Initial NHL provider and failure policy are selected.
- Analytics computation/persistence policy and formulas are fixed.
- Public/authenticated endpoint scope is fixed.
- API envelopes, pagination, filters, sorting, DTO boundaries, errors, and
  OpenAPI ownership are fixed.
- Raw, core, analytics, operations, identity, and job persistence are defined.
- Render topology, environment separation, migrations, promotion, and recovery
  are selected.
- Sequential passes have objective acceptance gates.

## Completion Checklist

- [ ] All context files and `AGENTS.md` are committed.
- [x] A script/manual audit confirms every required-reading path exists.
- [x] Searches find no stale `/api` paths without `/api/v1`.
- [x] Searches find no MVP requirement for JWT/users/admin HTTP endpoints.
- [x] Database entity names and field terminology agree across schema documents.
- [x] Provider paths and job names agree across ingestion documents.
- [x] Metric codes/formulas agree across API, database, analytics, and UI docs.
- [x] Render is named consistently across architecture, environment, and release
      documents.
- [x] Every implementation pass has measurable acceptance criteria.
- [x] Another developer has no unresolved Pass 1 architectural choice.

Pass 0 is complete only after this checklist is satisfied and committed. Tooling,
CI, and application scaffolding begin in Pass 1.
