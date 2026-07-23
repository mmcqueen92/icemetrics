# Frontend Architecture

## Runtime and Libraries

- Angular 22 standalone application; do not introduce NgModules for new code.
- Client-rendered SPA deployed as static assets. SSR is not part of the MVP.
- Angular Router with lazy-loaded feature routes.
- Angular `HttpClient` through one generated OpenAPI client boundary.
- Angular signals for local/view state and RxJS for asynchronous HTTP flows.
- Angular Material/CDK for accessible interaction primitives.
- Apache ECharts behind shared chart components.
- SCSS plus CSS custom properties for design tokens.

Do not add NgRx or another global state library. Server data is loaded by
feature facades/services and kept only as long as its route needs it. URL query
parameters are the source of truth for shareable filters and comparisons.

## Source Layout

```text
apps/web/src/app/
  core/
    api/
    errors/
    layout/
    routing/
  shared/
    components/
    charts/
    pipes/
  features/
    dashboard/
    players/
    teams/
    games/
    analytics/
```

- `core` is instantiated once and contains application infrastructure.
- `shared` contains reusable presentation code and no feature data access.
- Feature directories own pages, feature components, facades, and route config.
- Cross-feature imports go through public feature APIs or shared/core code, not
  another feature's internal files.

## API Boundary

- OpenAPI source is `apps/api/openapi/openapi.json`.
- Generated client code lives under `core/api/generated` and is never manually
  edited.
- A thin handwritten facade maps transport DTOs to view models only when the UI
  requires a different shape.
- Components never call arbitrary URLs or depend on Prisma/backend types.

## State and Request Behavior

- Loading, empty, error, and success are explicit view states.
- Cancel superseded searches with RxJS `switchMap`.
- Debounce player search by 300 ms and do not issue a search below 2 characters.
- Keep pagination, sort, filters, season, selected players, and analytics window
  in URL query parameters.
- Do not retry 4xx responses. A transient read request may retry once after a
  short delay; the UI then offers an explicit retry action.
- Preserve the last successful view while a user-initiated refresh is pending
  when doing so cannot misrepresent filter state.

## Performance

- Lazy-load every top-level feature.
- Use `OnPush` change detection.
- Track table rows by stable UUID.
- Do not render more than one API page of table rows.
- Load ECharts only on routes that render charts.
- Meet budgets in `docs/31-performance-guide.md`.

## Accessibility

Target WCAG 2.2 AA:

- all interactions work by keyboard;
- headings and landmarks follow semantic order;
- focus is visible and moves predictably after navigation/errors;
- charts have a text summary and equivalent data table;
- color is never the only indicator;
- reduced-motion preference is honored; and
- responsive pages remain usable at 320 CSS pixels.
