# UI Design System

## Principles

- Accessible before decorative.
- Dense enough for statistics without sacrificing scanability.
- Responsive from 320 px through wide desktop displays.
- Consistent states and terminology across explorers.
- NHL-inspired visual energy without copying league/team trademarks or media.

## Foundation

- Angular Material/CDK supplies accessibility behavior and interaction
  primitives.
- IceMetrics components wrap those primitives where product styling or a stable
  application API is needed.
- SCSS and CSS custom properties define color, typography, spacing, radius,
  elevation, and chart tokens.
- Use a system-font stack for body text and tabular numerals for statistics.
- Default spacing unit is 4 px; common gaps are 8, 12, 16, 24, and 32 px.

## Required Shared Components

- application header/navigation;
- page header and breadcrumbs where needed;
- button and icon-button variants;
- card;
- filter bar;
- data table with pagination/sort;
- season selector;
- status badge;
- metric tile;
- chart frame with summary/table fallback;
- loading skeleton/progress;
- empty state;
- error and not-found states;
- freshness indicator; and
- confirmation/dialog primitive for future use.

Feature-specific composition remains inside its feature.

Pass 10 implements the shell/navigation, button primitives, route progress,
loading, empty, error, not-found, freshness, and global notification
foundations. Page headers, filters, tables, selectors, status badges, metric
tiles, charts, and dialogs are added with their first production consumer in
Passes 11 and 12; do not create unused wrappers in advance.

Pass 11 implements page headers, responsive surfaces/cards, filter bars,
season/date selectors, sortable and paginated tables, status badges, and metric
tiles. Tables retain semantic headers and horizontally scroll on compact
screens. Pass 12 adds the chart primitive with ECharts as a progressive visual
enhancement: the canvas is hidden from assistive technology and the complete
dataset remains available in an adjacent captioned table. Dialogs remain
deferred until a feature requires one.

## Color and Status

Define semantic tokens rather than hard-coded colors:

```text
--color-surface
--color-surface-raised
--color-text
--color-text-muted
--color-primary
--color-success
--color-warning
--color-error
--color-focus
```

All text/background combinations meet WCAG 2.2 AA contrast. Game status and
trend direction always include text or an icon with accessible label.

## Tables and Charts

- Right-align numeric columns and use tabular numerals.
- Keep column headers visible on long desktop tables; use horizontal scrolling
  rather than collapsing data into unreadable cards.
- Do not encode more than five series in one chart.
- Tooltips are supplemental; all values remain keyboard-accessible through the
  equivalent table.
- Display units and sample size.

## Responsive Breakpoints

Use content-driven layouts with standard reference breakpoints:

- compact: below 600 px;
- medium: 600-959 px;
- wide: 960 px and above.

Filters stack on compact screens. Tables may scroll horizontally. Primary
actions remain reachable without hover.

## Documentation and Testing

Shared components have focused examples in the web application during the MVP;
a separate Storybook deployment is not required. Component tests cover keyboard
behavior, ARIA naming, disabled/loading states, and responsive DOM behavior.
