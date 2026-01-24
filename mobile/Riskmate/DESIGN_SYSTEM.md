# RiskMate iOS Design System

**Single source of truth for all UI components, tokens, and patterns.**

---

## 🎨 Design Principles

1. **Serious Infrastructure, Not a Tool**
   - Every interaction reinforces trust and immutability
   - Visual hierarchy prioritizes proof and verification
   - Motion is purposeful, not decorative

2. **Dark Theme + Orange Accent = Brand Memory**
   - Consistent dark background (#0A0A0A)
   - Orange (#F97316) for primary actions only
   - System colors for semantic states (risk, status)

3. **Information Hierarchy is Sharp**
   - Primary actions are visually distinct
   - Risk signals are immediate and clear
   - Ledger/verification status is always visible

4. **Motion as Confidence, Not Decoration**
   - Spring animations (0.25-0.5s response, 0.85-0.9 damping)
   - Haptics for punctuation, not every tap
   - Numeric transitions for scores/counts

---

## 🎨 Colors

### Backgrounds
```swift
RiskMateDesignSystem.Colors.background  // #0A0A0A - Main background
RiskMateDesignSystem.Colors.surface     // #121212 - Cards, surfaces
RiskMateDesignSystem.Colors.cardBackground // #0B0B0C @ 72% - Glass cards
```

### Accent (Use Sparingly)
```swift
RiskMateDesignSystem.Colors.accent      // #F97316 - Primary actions only
RiskMateDesignSystem.Colors.accentLight // #FB923C - Hover states
RiskMateDesignSystem.Colors.accentDark  // #EA580C - Pressed states
```

**Rule:** Orange only for:
- Primary buttons (Sign In, Add Evidence, Continue)
- Selected states (filters, tabs)
- Critical alerts
- **Never** for text, borders, or secondary actions

### Text Hierarchy
```swift
RiskMateDesignSystem.Colors.textPrimary    // White - Headlines, important text
RiskMateDesignSystem.Colors.textSecondary // White @ 65% - Body text
RiskMateDesignSystem.Colors.textTertiary  // White @ 45% - Captions, metadata
RiskMateDesignSystem.Colors.textPlaceholder // White @ 38% - Placeholders
RiskMateDesignSystem.Colors.textMuted     // White @ 30% - Disabled states
```

### Risk Colors (Semantic - System Colors)
```swift
RiskMateDesignSystem.Colors.riskCritical // System Red
RiskMateDesignSystem.Colors.riskHigh     // System Orange
RiskMateDesignSystem.Colors.riskMedium   // System Yellow
RiskMateDesignSystem.Colors.riskLow      // System Green
```

**Rule:** Always use system colors for risk to ensure accessibility and consistency with iOS.

### Status Colors
```swift
RiskMateDesignSystem.Colors.success // System Green
RiskMateDesignSystem.Colors.error   // System Red
RiskMateDesignSystem.Colors.warning // System Orange
RiskMateDesignSystem.Colors.info    // System Blue
```

---

## 📝 Typography

### Titles
```swift
RiskMateDesignSystem.Typography.largeTitle // 34pt, Bold
RiskMateDesignSystem.Typography.title     // 28pt, Bold
RiskMateDesignSystem.Typography.title2    // 22pt, Semibold
RiskMateDesignSystem.Typography.title3    // 20pt, Semibold
```

### Headings
```swift
RiskMateDesignSystem.Typography.headingLarge // 28pt, Bold
RiskMateDesignSystem.Typography.headingSmall // 18pt, Semibold
RiskMateDesignSystem.Typography.headline      // System headline
RiskMateDesignSystem.Typography.subheadline   // System subheadline
```

### Body
```swift
RiskMateDesignSystem.Typography.body         // 17pt, Regular
RiskMateDesignSystem.Typography.bodyBold     // 17pt, Semibold
RiskMateDesignSystem.Typography.bodySmall    // 15pt, Regular
RiskMateDesignSystem.Typography.bodySmallBold // 15pt, Semibold
```

### Captions
```swift
RiskMateDesignSystem.Typography.caption      // 13pt, Regular
RiskMateDesignSystem.Typography.captionBold  // 13pt, Semibold
RiskMateDesignSystem.Typography.captionSmall // 11pt, Regular
```

### Special
```swift
RiskMateDesignSystem.Typography.monospaced   // Monospaced - for hashes, IDs
```

**Rule:** Use system fonts. Never use custom fonts unless absolutely necessary.

---

## 📏 Spacing Scale (4/8/12/16/24/32)

```swift
RiskMateDesignSystem.Spacing.xs  // 4pt  - Tight spacing
RiskMateDesignSystem.Spacing.sm  // 8pt  - Small gaps
RiskMateDesignSystem.Spacing.md  // 16pt - Standard spacing
RiskMateDesignSystem.Spacing.lg  // 24pt - Large gaps
RiskMateDesignSystem.Spacing.xl  // 32pt - Extra large
RiskMateDesignSystem.Spacing.xxl // 48pt - Section breaks

// Layout tokens
RiskMateDesignSystem.Spacing.pagePadding   // 20pt - Page horizontal padding
RiskMateDesignSystem.Spacing.sectionSpacing // 16pt - Between sections
```

**Rule:** Stick to the scale. Don't use arbitrary values like 13pt or 18pt.

---

## 🔲 Corner Radius

```swift
RiskMateDesignSystem.Radius.xs   // 8pt  - Small elements
RiskMateDesignSystem.Radius.sm   // 12pt - Buttons, inputs
RiskMateDesignSystem.Radius.md   // 16pt - Cards (standard)
RiskMateDesignSystem.Radius.lg   // 24pt - Large cards
RiskMateDesignSystem.Radius.xl    // 26pt - Glass cards
RiskMateDesignSystem.Radius.card  // 24pt - Standardized card
RiskMateDesignSystem.Radius.pill  // 12pt - Pills, chips
```

**Rule:** Cards use 24pt. Buttons use 12pt. Pills use 12pt.

---

## 🌑 Shadows (3 levels max)

```swift
RiskMateDesignSystem.Shadow.small   // 4pt radius, subtle
RiskMateDesignSystem.Shadow.card    // 12pt radius, standard cards
RiskMateDesignSystem.Shadow.button  // 18pt radius, primary buttons
```

**Rule:** Don't create new shadow styles. Use these three only.

---

## 🎭 Blur Materials

```swift
RiskMateDesignSystem.Material.thin      // Thin material
RiskMateDesignSystem.Material.regular   // Regular material
RiskMateDesignSystem.Material.thick     // Thick material
RiskMateDesignSystem.Material.ultraThin // Ultra thin material
```

**Rule:** Use `.ultraThinMaterial` for list rows. Use `.regularMaterial` for cards.

---

## 🎬 Motion Constants

### Durations
```swift
RiskMateDesignSystem.Motion.fast   // 0.2s
RiskMateDesignSystem.Motion.normal // 0.3s
RiskMateDesignSystem.Motion.slow    // 0.5s
```

### Springs
```swift
RiskMateDesignSystem.Motion.springFast // 0.25s response, 0.9 damping
RiskMateDesignSystem.Motion.spring     // 0.35s response, 0.9 damping
RiskMateDesignSystem.Motion.springSlow  // 0.5s response, 0.85 damping
```

### Easing
```swift
RiskMateDesignSystem.Motion.smooth  // easeInOut, 0.3s
RiskMateDesignSystem.Motion.easeOut // easeOut, 0.3s
RiskMateDesignSystem.Motion.easeIn  // easeIn, 0.3s
```

**Rule:** Use springs for interactive elements. Use easing for transitions.

---

## 📳 Haptics

```swift
RiskMateDesignSystem.Haptics.tap()      // Light - toggles, filters
RiskMateDesignSystem.Haptics.impact()   // Medium - buttons, selections
RiskMateDesignSystem.Haptics.success()  // Success - copy, export
RiskMateDesignSystem.Haptics.warning()  // Warning - sign out, delete
RiskMateDesignSystem.Haptics.error()    // Error - failures
```

**Rule:** 
- Primary actions: Medium impact
- Confirmations: Success notification
- Destructive: Warning notification
- Light interactions: Light tap

---

## 🧩 Component Patterns

### Buttons

**Primary Button:**
- Orange gradient background
- Black text
- 52pt height
- 12pt corner radius
- Button shadow
- Compresses to 0.96x on press
- Medium haptic on tap

**Secondary Button:**
- Transparent background
- Orange text
- 1px orange border (optional)
- Same height and radius as primary

**Destructive Button:**
- Red background (system red)
- White text
- Warning haptic

### Cards

**Standard Card:**
- 24pt corner radius
- Card shadow
- Surface background color
- 16pt padding

**Glass Card:**
- 26pt corner radius
- Ultra thin material background
- Subtle border (optional)

### Input Fields

**Text Field:**
- 12pt corner radius
- Input fill background
- 1px border (unfocused) / 1.6px orange border (focused)
- Card lift on focus (1.01x scale + shadow)
- 14pt vertical padding

### Risk Indicators

**Risk Strip (Left Edge):**
- 4px width
- Gradient: Green → Yellow → Orange → Red
- Based on risk level

**Risk Score Badge:**
- Gradient background (subtle, based on score)
- Numeric text with animation
- 12pt corner radius

### Filters

**Filter Pill:**
- 12pt corner radius (pill shape)
- Input fill background
- Active: Orange border (1.5px) + glow shadow + 1.02x scale
- Spring animation on change

---

## ✅ Do's and Don'ts

### ✅ Do

- Use system colors for semantic states (risk, status)
- Use orange only for primary actions
- Stick to spacing scale (4/8/12/16/24/32)
- Use springs for interactive animations
- Apply haptics strategically (not every tap)
- Use monospaced font for hashes/IDs
- Maintain 24pt card radius consistently
- Use `.contentTransition(.numericText())` for scores/counts

### ❌ Don't

- Don't use orange for text, borders, or secondary actions
- Don't create new shadow styles (use the 3 provided)
- Don't use arbitrary spacing values
- Don't add motion to every element
- Don't use custom fonts
- Don't mix brand colors with system colors inconsistently
- Don't create new animation curves
- Don't use haptics on every interaction

---

## 📦 Component Checklist

When creating a new component, ensure:

- [ ] Uses `RiskMateDesignSystem` tokens (not hardcoded values)
- [ ] Follows spacing scale
- [ ] Uses appropriate corner radius
- [ ] Has proper text hierarchy
- [ ] Includes haptic feedback (if interactive)
- [ ] Uses spring animations (if animated)
- [ ] Orange only for primary actions
- [ ] System colors for semantic states
- [ ] Proper shadow level
- [ ] Accessible (VoiceOver labels, Dynamic Type support)

---

## 🔄 Migration Guide

**Old → New:**

```swift
// Old
RMTheme.Colors.accent
RMTheme.Spacing.md
RMTheme.Animation.spring

// New (preferred)
RiskMateDesignSystem.Colors.accent
RiskMateDesignSystem.Spacing.md
RiskMateDesignSystem.Motion.spring
```

**Note:** `RMTheme` and `RMSystemTheme` still work for backward compatibility, but all new code should use `RiskMateDesignSystem`.

---

## 📚 Examples

### Primary Button
```swift
Button {
    RiskMateDesignSystem.Haptics.impact()
    action()
} label: {
    Text("Add Evidence")
        .font(RiskMateDesignSystem.Typography.bodyBold)
        .foregroundColor(.black)
        .frame(height: 52)
        .frame(maxWidth: .infinity)
        .background(
            LinearGradient(
                colors: [
                    RiskMateDesignSystem.Colors.accent,
                    RiskMateDesignSystem.Colors.accentLight
                ],
                startPoint: .leading,
                endPoint: .trailing
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: RiskMateDesignSystem.Radius.sm))
}
.riskMateShadow(RiskMateDesignSystem.Shadow.button)
```

### Card
```swift
RoundedRectangle(cornerRadius: RiskMateDesignSystem.Radius.card)
    .fill(RiskMateDesignSystem.Colors.surface)
    .riskMateShadow(RiskMateDesignSystem.Shadow.card)
    .padding(RiskMateDesignSystem.Spacing.md)
```

### Risk Indicator
```swift
RoundedRectangle(cornerRadius: 2)
    .fill(
        LinearGradient(
            colors: [
                RiskMateDesignSystem.Colors.riskLow,
                RiskMateDesignSystem.Colors.riskHigh
            ],
            startPoint: .top,
            endPoint: .bottom
        )
    )
    .frame(width: 4)
```

---

**Last Updated:** 2024
**Version:** 1.0
