# AGENTS.md

# IceMetrics Development Instructions

Welcome to the IceMetrics repository.

Before making **any** architectural, implementation, or design decisions, you **must** read the project documentation located in the `/docs` directory.

The documentation in `/docs` is considered the **source of truth** for this project.

---

# Primary Objective

IceMetrics is a production-quality NHL analytics platform designed to demonstrate professional software engineering, data engineering, cloud engineering, and analytics skills.

The goal is **not** simply to produce working code.

The goal is to produce code that a senior software engineer would be comfortable shipping and maintaining.

---

# Development Philosophy

Prioritize, in order:

1. Correctness
2. Maintainability
3. Readability
4. Simplicity
5. Performance (when justified)

Avoid clever solutions unless they provide measurable value.

Prefer explicit, understandable code over abstraction.

Avoid introducing unnecessary dependencies.

---

# Required Reading

Before implementing features, read the documents in approximately this order.

## Project

* `docs/00-project-overview.md`
* `docs/34-mvp-feature-specification.md`

## Architecture

* `docs/01-engineering-decisions.md`
* `docs/20-architecture-decisions.md`
* `docs/40-maintenance-and-evolution.md`

## Database

* `docs/02-database-specification.md`
* `docs/03-prisma-model-guidelines.md`
* `docs/13-database-schema.md`
* `docs/23-prisma-schema.md`
* `docs/36-entity-relationship-model.md`

## Backend

* `docs/04-api-specification.md`
* `docs/14-api-endpoints.md`
* `docs/15-backend-module-design.md`
* `docs/24-openapi-examples.md`
* `docs/29-backend-development-guide.md`

## Data Engineering

* `docs/05-etl-implementation.md`
* `docs/16-etl-job-specifications.md`
* `docs/25-data-provider-design.md`
* `docs/30-data-quality-guide.md`
* `docs/35-nhl-data-source-research.md`

## Frontend

* `docs/07-frontend-specification.md`
* `docs/17-frontend-page-specifications.md`
* `docs/27-ui-design-system.md`

## Analytics

* `docs/06-analytics-metric-catalog.md`

## Security

* `docs/09-security-architecture.md`
* `docs/26-authentication-design.md`

## Testing

* `docs/08-testing-strategy.md`

## Infrastructure and Operations

* `docs/10-observability.md`
* `docs/11-local-development-guide.md`
* `docs/22-environment-configuration.md`
* `docs/31-performance-guide.md`
* `docs/39-release-strategy.md`

## Workflow

* `docs/18-implementation-phases.md`
* `docs/21-github-workflow.md`
* `docs/28-first-sprint-plan.md`
* `docs/33-developer-onboarding.md`
* `docs/38-sprint-zero-plan.md`
* `docs/37-github-backlog.md`

## AI and Codex

* `docs/12-codex-development-instructions.md`
* `docs/19-codex-master-prompt.md`
* `docs/32-ai-assistant-architecture.md`

---

# Source of Truth

If implementation and documentation disagree:

* Assume the documentation is correct.
* Do **not** silently diverge from it.
* Update the implementation to match the documentation, or propose a documentation update if the documentation is demonstrably incorrect.

---

# Architecture Constraints

Unless explicitly instructed otherwise:

* Keep the project as a **modular monolith**.
* Do not introduce microservices.
* Do not introduce event-driven architecture unless documented.
* Do not replace existing technologies.
* Follow the documented module boundaries.
* Preserve separation between raw, normalized, and analytics data.

---

# Database Rules

* Never modify the schema outside Prisma migrations.
* Preserve referential integrity.
* Prefer normalization over duplication.
* Keep analytics separate from operational data.
* Preserve imported raw data whenever practical.

---

# Backend Rules

Controllers should:

* validate requests
* call services
* return DTOs

Controllers should **not** contain business logic.

Services should:

* implement business logic
* orchestrate repositories
* remain framework-independent where practical

Repositories should:

* encapsulate persistence
* avoid business logic

---

# Frontend Rules

* Keep components small.
* Reuse shared components.
* Keep API access centralized.
* Avoid duplicated business logic.
* Prefer composition over inheritance.

---

# Code Quality

Every contribution should leave the codebase in a better state than it was found.

Prefer:

* small commits
* descriptive names
* strong typing
* defensive programming
* automated tests

Avoid:

* TODOs without context
* commented-out code
* dead code
* unnecessary abstraction

---

# Documentation

Whenever architecture, APIs, database design, or workflows change:

1. Update the relevant document in `/docs`.
2. Keep documentation synchronized with implementation.
3. Add an Architecture Decision Record (ADR) for significant changes.

Documentation is considered part of the implementation.

---

# Testing Expectations

New features should include appropriate tests.

Where appropriate:

* unit tests
* integration tests
* API tests
* ETL validation tests

Production bugs should generally receive regression tests.

---

# Dependencies

Before adding a dependency, ask:

* Can the standard library solve this?
* Can existing project code solve this?
* Is the dependency actively maintained?
* Does it materially improve the project?

Default to fewer dependencies.

---

# Decision Making

When requirements are ambiguous:

Act as an experienced senior engineer.

Choose the solution that is:

* easiest to maintain
* easiest to understand
* easiest to test
* easiest to extend

Document important decisions.

---

# Long-Term Goal

The finished project should resemble something produced by a professional engineering team—not a tutorial or student project.

Every implementation decision should support that objective.
