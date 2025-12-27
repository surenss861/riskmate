# RiskMate Design System

Shared design system for both marketing site and app UI.

## Structure

```
lib/design-system/
├── tokens.ts          # Colors, spacing, typography, shadows, etc.
├── components/        # Shared React components
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Input.tsx
│   ├── Table.tsx
│   └── ...
└── hooks/            # Shared hooks
    ├── useGSAP.ts
    └── useThree.ts
```

## Usage

### Marketing Site
- Uses `typography.marketing` (larger, more expressive)
- Uses `spacing.marketing` (more generous)
- Motion: GSAP + Three.js hero
- Glass cards, cinematic reveals

### App UI
- Uses `typography.app` (tighter, information-dense)
- Uses `spacing.app` (compact)
- Motion: Subtle transitions only
- Clean tables, enterprise polish

## Principles

1. **One Source of Truth**: All tokens in `tokens.ts`
2. **Two Skins**: Same tokens, different application
3. **Performance First**: Lazy-load heavy effects
4. **Accessibility**: WCAG AA minimum

