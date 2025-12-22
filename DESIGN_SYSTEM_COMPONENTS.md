# Design System Components - Usage Guide

## Standardized Components (Use These, Not Raw Styling)

### Layout Components

#### `<AppBackground>`
- **Purpose:** Provides ambient gradient backdrop (matches landing page)
- **Usage:** Wrap entire page content
- **Rules:** Single source of background, no extra glows per card

#### `<AppShell>`
- **Purpose:** Consistent page container (max-w-6xl, padding)
- **Usage:** Wrap page content after AppBackground
- **Rules:** Always use for authenticated routes

#### `<PageHeader>`
- **Purpose:** Editorial-style page title with optional subtitle and divider
- **Usage:** Top of every page
- **Props:** `title`, `subtitle?`, `showDivider?`
- **Rules:** Title uses serif (font-display), subtitle uses muted sans

#### `<PageSection>`
- **Purpose:** Enforces consistent spacing (mb-16) between sections
- **Usage:** Wrap each major section
- **Rules:** Prevents density drift - never use raw mb-* for sections

### Surface Components

#### `<GlassCard>`
- **Purpose:** Canonical surface component (bg-white/[0.03], border-white/10)
- **Usage:** All cards, panels, containers
- **Props:** `className?`, `href?`, `onClick?`
- **Rules:** 
  - Always use for cards/panels (never raw `bg-white/[0.03]`)
  - Padding: `p-6` or `p-8` (pick one per card type)

#### `<ChartCard>`
- **Purpose:** Wrapper for charts with enforced empty states
- **Usage:** Wrap all chart components
- **Props:** `title?`, `emptyReason?`, `emptyTitle?`, `emptyMessage?`, `onCreateJob?`, `onViewData?`
- **Rules:**
  - Title uses font-display (serif)
  - Empty states always use editorial CTAs
  - Enforces chart token styling

### Form Components

#### `<Input>`
- **Purpose:** Standardized input field
- **Usage:** All text inputs
- **Props:** Standard input props + `variant?: 'default' | 'search'`
- **Rules:**
  - Height: 44px (h-11) - locked
  - Secondary surface: bg-white/5
  - Focus ring: ring-1 ring-white/20
  - Placeholder: text-white/40

#### `<Select>`
- **Purpose:** Standardized dropdown
- **Usage:** All select dropdowns
- **Props:** Standard select props
- **Rules:**
  - Height: 44px (h-11) - locked
  - Secondary surface: bg-white/5
  - Chevron icon: Consistent styling

#### `<SearchInput>`
- **Purpose:** Search field with icon
- **Usage:** Search inputs
- **Props:** `value`, `onChange`, `placeholder?`, `className?`
- **Rules:** Uses Input styling + search icon (w-4 h-4 text-white/40)

### Data Components

#### `<DataTable>`
- **Purpose:** Standardized table container with editorial density
- **Usage:** All data tables
- **Rules:**
  - Uses GlassCard container
  - No inner cell borders (only row separators)
  - Increased row height + padding (editorial density)

#### `<TableRow>`
- **Purpose:** Editorial density row
- **Usage:** Table rows
- **Props:** `onClick?`, `className?`
- **Rules:**
  - Padding: py-4 (generous spacing)
  - Hover: subtle bg-white/5, no bright outlines

#### `<TableCell>`, `<TableHeaderCell>`
- **Purpose:** Standardized cell styling
- **Usage:** Table cells
- **Rules:**
  - Padding: px-6 py-4
  - Text: Base sans-serif (no serif in data)
  - Status: Use Badge component only

### UI Components

#### `<Button>`
- **Purpose:** Standardized button
- **Variants:** `primary` (orange), `secondary` (glass), `ghost` (text-only)
- **Sizes:** `sm`, `md`, `lg`
- **Rules:** Always use component, never raw button styles

#### `<Badge>`
- **Purpose:** Status indicators
- **Variants:** `neutral`, `warning`, `critical`, `success`
- **Rules:** Use for all status indicators (no colored dots)

## Chart Tokens

Import chart styling tokens from `@/lib/styles/chart-tokens`:

```tsx
import { chartTokens } from '@/lib/styles/chart-tokens'

// Apply to chart library
<CartesianGrid 
  stroke={chartTokens.gridlines.stroke}
  strokeWidth={chartTokens.gridlines.strokeWidth}
/>
```

### Chart Token Rules
- **Gridlines:** `rgba(255, 255, 255, 0.06)` - subtle opacity
- **Axis labels:** `rgba(255, 255, 255, 0.6)` - muted sans
- **Axis ticks:** `rgba(255, 255, 255, 0.4)` - very muted
- **Tooltips:** bg-white/5, border-white/10

## Migration Checklist

When migrating a page:
1. ✅ Wrap with `<AppBackground>` and `<AppShell>`
2. ✅ Use `<PageHeader>` for title
3. ✅ Wrap sections with `<PageSection>`
4. ✅ Replace all cards with `<GlassCard>`
5. ✅ Replace all buttons with `<Button>`
6. ✅ Replace all inputs/selects with `<Input>`/`<Select>`
7. ✅ Replace tables with `<DataTable>` components
8. ✅ Wrap charts with `<ChartCard>`
9. ✅ Use `<Badge>` for all status indicators
10. ✅ Apply chart tokens to chart libraries

## Anti-Patterns (Don't Do This)

❌ Raw `bg-white/[0.03]` - Use `<GlassCard>`
❌ Raw button styles - Use `<Button>`
❌ Raw input styles - Use `<Input>`/`<Select>`
❌ Colored dots - Use `<Badge>`
❌ Custom table styling - Use `<DataTable>`
❌ Raw `mb-*` for sections - Use `<PageSection>`
❌ Custom chart styling - Use `<ChartCard>` + chart tokens

