# AccountPro Design System Foundation

## 1. Product Design Principles

AccountPro should feel calm, professional, trustworthy, beginner friendly, and consistent enough for long accounting sessions.

The foundation rules for this system are:

- Calm over flashy
- Clarity over decoration
- Density with legibility
- Reuse over page-specific invention
- Semantic tokens over raw styling values
- Strong defaults over one-off overrides

## 2. Brand Palette

AccountPro uses a Calm Navy + Teal enterprise accounting palette.

### Brand and action

- `--primary`: `#203650`
- `--primary-hover`: `#182C43`
- `--primary-soft`: `#F2F6FC`
- `--primary-border`: `#C7D7EC`
- `--primary-foreground`: `#FFFFFF`

### Accent

- `--accent`: `#148B79`
- `--accent-hover`: `#146F63`
- `--accent-soft`: `#ECFDF9`
- `--accent-foreground`: `#FFFFFF`

### Neutral surfaces

- `--surface-page`: `#F7F9FC`
- `--surface-card`: `#FFFFFF`
- `--surface-subtle`: `#F0F3F7`
- `--surface-hover`: `#E9EEF5`
- `--surface-elevated`: `#FFFFFF`
- `--surface-overlay`: `rgba(15, 23, 42, 0.44)`

### Text

- `--text-primary`: `#111827`
- `--text-secondary`: `#4B5869`
- `--text-muted`: `#687587`
- `--text-disabled`: `#98A4B3`
- `--text-inverse`: `#FFFFFF`

### Borders

- `--border-default`: `#E2E7EE`
- `--border-subtle`: `#EDF1F5`
- `--border-strong`: `#CDD5DF`

### Semantic status

- Success: background `#ECFDF3`, foreground `#067647`, border `#ABEFC6`, icon `#079455`
- Warning: background `#FFFAEB`, foreground `#93370D`, border `#FEDF89`, icon `#DC6803`
- Danger: background `#FEF3F2`, foreground `#B42318`, border `#FECDCA`, icon `#D92D20`
- Info: background `#EFF8FF`, foreground `#175CD3`, border `#B2DDFF`, icon `#1570EF`

### Navigation tokens

Declared in Batch 1 but not yet migrated visually:

- `--nav-background`
- `--nav-border`
- `--nav-text`
- `--nav-text-muted`
- `--nav-active`
- `--nav-active-text`
- `--nav-hover`
- `--nav-hover-text`

## 3. Semantic Color Tokens

### Product surfaces

- `surface.page`
- `surface.card`
- `surface.subtle`
- `surface.hover`
- `surface.elevated`
- `surface.overlay`

### Text

- `text.primary`
- `text.secondary`
- `text.muted`
- `text.disabled`
- `text.inverse`

### Borders

- `border.default`
- `border.subtle`
- `border.strong`

### Actions

- `action.primary`
- `action.primary-hover`
- `action.secondary`
- `action.secondary-hover`
- `action.ghost`
- `action.ghost-hover`

### Status

- `status.success.*`
- `status.warning.*`
- `status.danger.*`
- `status.info.*`

### Navigation

- `navigation.background`
- `navigation.border`
- `navigation.text`
- `navigation.text-muted`
- `navigation.active`
- `navigation.active-text`
- `navigation.hover`
- `navigation.hover-text`

### Compatibility aliases

The existing shadcn contract is retained through these mapped aliases:

- `--background`
- `--foreground`
- `--card`
- `--card-foreground`
- `--popover`
- `--popover-foreground`
- `--primary`
- `--primary-foreground`
- `--secondary`
- `--secondary-foreground`
- `--muted`
- `--muted-foreground`
- `--accent`
- `--accent-foreground`
- `--destructive`
- `--destructive-foreground`
- `--border`
- `--input`
- `--ring`

RGB channel aliases are also retained for Tailwind alpha utilities like `bg-muted/50`.

## 4. Typography

Geist remains the UI typeface.

### Recipes

- Display: `36 / 40 / 700`
- Page title: `28 / 36 / 700`
- Section title: `20 / 28 / 600`
- Card title: `16 / 24 / 600`
- Body: `14 / 21 / 400`
- Body strong: `14 / 21 / 600`
- Small: `13 / 18 / 400`
- Caption: `12 / 16 / 500`
- Label: `12 / 16 / 600`
- Table header: `12 / 16 / 600`
- Table body: `13 / 18 / 400`
- Financial metric: `28 / 34 / 700`

### Utility classes

- `.type-display`
- `.type-page-title`
- `.type-section-title`
- `.type-card-title`
- `.type-body`
- `.type-body-strong`
- `.type-small`
- `.type-caption`
- `.type-label`
- `.type-table-header`
- `.type-table-body`
- `.type-financial-metric`

## 5. Spacing

### Scale

- `4px`
- `8px`
- `12px`
- `16px`
- `20px`
- `24px`
- `32px`
- `40px`
- `48px`
- `64px`

### Semantic usage

- Inline gap: `8px`
- Field gap: `12px`
- Control padding: `12px`
- Card padding compact: `16px`
- Card padding default: `24px`
- Section gap: `24px`
- Page gap: `32px`
- Page horizontal padding: `24px`
- Large empty-state spacing: `48px`

Batch 1 only defines the scale and semantic intent. It does not mass-migrate page spacing classes.

## 6. Radius

### Scale

- `--radius-sm`: `6px`
- `--radius-md`: `8px`
- `--radius-lg`: `12px`
- `--radius-xl`: `16px`
- `--radius-full`: `9999px`

### Usage

- Badges and compact controls: `sm`
- Buttons, inputs, and select triggers: `md`
- Cards and filter panels: `lg`
- Dialogs and larger panels: `xl`
- Status pills: `full`

## 7. Shadows

### Tokens

- `--shadow-surface`
- `--shadow-dropdown`
- `--shadow-dialog`

### Rules

- Borders are the main separation mechanism
- Cards use restrained surface shadows only
- Dropdowns and dialogs may use stronger elevation
- Buttons must not get decorative shadows

## 8. Focus States

### Tokens

- `--focus-ring`
- `--focus-ring-offset`
- `--disabled-opacity`
- `--placeholder-color`
- `--selection-background`
- `--selection-foreground`

### Rules

- Focus must be visible on keyboard navigation
- Focus must work on white and muted surfaces
- Do not rely on color alone for status or focus
- Shared primitives should use the same focus-ring treatment

## 9. Motion

### Tokens

- Fast: `120ms`
- Normal: `180ms`
- Slow: `240ms`
- Easing: `cubic-bezier(0.2, 0, 0, 1)`

### Rules

- Use restrained motion only
- Prefer state clarity over animation
- Respect `prefers-reduced-motion`
- Do not add decorative transitions

## 10. Financial-Number Formatting

Use the `.financial-number` utility for values that benefit from tabular numerals.

Rule:

- Prioritize it for totals, balances, ledgers, tables, payroll amounts, and other repeated numeric columns

## 11. Token Usage Examples

### Safe examples

- Primary action button uses `primary` + `primary-foreground`
- Standard card uses `surface.card` + `border.default` + `shadow.surface`
- Empty state uses `surface.card` or `surface.subtle`, not custom tinted gradients
- Status badge uses semantic status tokens, not page-local greens or ambers

### Shared primitives should prefer

- Semantic tokens
- Shared motion tokens
- Shared radius tokens
- Shared typography recipes

## 12. Prohibited Practices

- Raw hex colors inside page components
- New `slate`, `emerald`, or `amber` Tailwind colors for product semantics
- Arbitrary border radii
- Arbitrary shadows
- Page-specific status badge colors
- Color-only status communication
- Random typography sizes
- Decorative gradients for core product surfaces
- New one-off focus-ring styles

## 13. Migration Rules

- Do not bypass semantic tokens when building new shared primitives
- Prefer compatibility aliases over breaking component APIs
- Do not mass-rewrite page styles during foundation batches
- Do not change business logic while doing UI foundation work
- Remove hardcoded page colors only in later migration batches
- Replace arbitrary radii and shadows during page migration, not blindly in Batch 1

## 14. Batch 1 Scope

Batch 1 establishes:

- Global design tokens
- Tailwind semantic token mapping
- Shared typography utilities
- Shared motion and focus foundations
- Safe primitive-level compatibility updates

Batch 1 does not include:

- Page redesigns
- Sidebar or topbar migration
- Accounting workflow refactors
- Route, API, schema, or logic changes
