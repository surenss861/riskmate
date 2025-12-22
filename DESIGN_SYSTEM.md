# Design System - Product-Wide Standard

## Canonical Tokens (Single Source of Truth)

### Surfaces
- **Primary surface:** `bg-white/[0.03]` (GlassCard component)
- **Secondary surface:** `bg-white/5` (for inputs, selects, segmented controls)
- **Border:** `border-white/10` (all cards, inputs, dividers)
- **Hover surface:** `hover:bg-white/5` or `hover:bg-white/10`

### Typography
- **Page titles:** `text-4xl md:text-5xl font-bold font-display` (serif)
- **Section titles:** `text-2xl font-bold font-display` (serif)
- **Body text:** `text-base text-white/70` (sans-serif)
- **Muted text:** `text-sm text-white/60` (sans-serif)
- **Labels:** `text-xs uppercase tracking-wider text-white/50` (sans-serif)

### Spacing
- **Section spacing:** `mb-16` (64px between major sections)
- **Card padding:** `p-6` to `p-10` depending on content
- **Inner spacing:** `gap-6` for grids, `space-y-16` for vertical stacks

### Components

#### GlassCard
- **MUST USE** for all cards, containers, panels
- Canon surface: `bg-white/[0.03]`, `border-white/10`
- Rounded: `rounded-3xl`
- Shadow: `shadow-[0_8px_32px_rgba(0,0,0,0.3)]`

#### Button
- **MUST USE** shared Button component (primary/secondary/ghost)
- Never inline button styles

#### Badge
- **MUST USE** shared Badge component
- No colored dots or custom badge styling

### Design Rules (Non-Negotiable)

1. **No raw colors in page files**
   - ❌ `className="bg-white/5 border-white/10"`
   - ✅ Use `<GlassCard>`, `<Button>`, `<Badge>` components

2. **Typography hierarchy**
   - Serif (`font-display`) ONLY for page/section titles
   - Sans-serif for all data, labels, UI text

3. **Orange accent usage**
   - Primary CTAs only
   - Selected states (time range, active nav)
   - Hairline dividers
   - Hover states on links

4. **No dashboard kit artifacts**
   - ❌ Colored dots, colored left borders
   - ❌ Heavy shadows, multiple glows
   - ❌ Cramped spacing, tight grids
   - ❌ Generic "No data" empty states

5. **Editorial density**
   - Tables → editorial list rows
   - Generous padding, breathing room
   - Subtle separators (`border-white/10` or `divide-white/5`)

## PR Checklist

- [ ] All cards use `<GlassCard>` component
- [ ] All buttons use `<Button>` component
- [ ] No raw `bg-white/*` or `border-white/*` classes (except in shared components)
- [ ] Page headers use `<PageHeader>` with serif title
- [ ] Sections use `mb-16` spacing
- [ ] Empty states have editorial CTAs (not system text)
- [ ] Tables/list rows have editorial density (not cramped)
- [ ] No colored dots or dashboard kit artifacts

## Migration Order

1. ✅ Operations page (done)
2. ⏳ Jobs list/roster pages
3. ⏳ Job detail page
4. ⏳ Mitigations/Evidence pages
5. ⏳ Settings/Account pages

