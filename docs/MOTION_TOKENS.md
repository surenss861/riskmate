# Motion tokens (web alignment)

Shared motion numbers for iOS (SwiftUI) and web (e.g. Framer Motion). Use these so transitions and springs feel consistent across platforms.

## Durations

| Token   | Value |
|--------|-------|
| fast   | 0.14  |
| normal | 0.22  |
| slow   | 0.32  |

## Springs

| Token  | response | damping |
|--------|----------|---------|
| press  | 0.25     | 0.85    |
| select | 0.35     | 0.88    |
| soft   | 0.45     | 0.9     |

## Easing

| Token      | Value                        |
|------------|------------------------------|
| easeOut    | cubic-bezier(0.16, 1, 0.3, 1) |
| easeOutSlow| cubic-bezier(0.22, 1, 0.36, 1)|

## Stagger

| Token       | Value  |
|-------------|--------|
| stagger step| 0.045  |

## Shimmer (skeleton)

| Token    | Value |
|----------|-------|
| duration | 1.25  |
| opacity  | 0.22  |

---

In web (Framer Motion), reuse these numbers for `duration`, `type: "spring"` with `stiffness`/`damping` derived from response/damping, and the same cubic-bezier curves.
