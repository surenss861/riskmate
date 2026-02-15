# iOS SignatureCaptureSheet Verification Report

## Overview

Verification of the iOS `SignatureCaptureSheet` component against the specification. The implementation at `mobile/Riskmate/Riskmate/Views/Signatures/SignatureCaptureSheet.swift` is **production-ready** and exceeds requirements with pressure-sensitive drawing, Apple Pencil support, and enhanced SVG export.

## 1. Core Features Verified

### Signature Canvas (Lines 214-238, 349-461)

| Requirement | Status | Location |
|-------------|--------|----------|
| `PressureSignaturePadView` (UIViewRepresentable) provides native drawing | ✅ | Lines 354-411 |
| Pressure sensitivity: `strokeWidth(for:)` uses `touch.force` for variable width (1-6pt) | ✅ | Lines 370-381 |
| Apple Pencil support: altitude angle (`touch.altitudeAngle`) affects stroke width | ✅ | Lines 376-379 |
| Touch handling: `touchesBegan`, `touchesMoved`, `touchesEnded`, `touchesCancelled` | ✅ | Lines 383-410 |
| Strokes stored as `[[SignaturePoint]]` with location and width per point | ✅ | Lines 13-17, 352-353 |

### Text Fields (Lines 242-278)

| Requirement | Status | Location |
|-------------|--------|----------|
| "Full Legal Name" with `.textContentType(.name)` and `.autocapitalization(.words)` | ✅ | Lines 247-257 |
| "Title / Role" with `.textContentType(.jobTitle)` and `.autocapitalization(.words)` | ✅ | Lines 263-273 |
| Fields use `RMTheme.Colors.inputFill` and `RMTheme.Colors.inputStroke` | ✅ | Lines 252-256, 268-272 |
| Placeholder text: "John Doe" and "Site Supervisor" | ✅ | Lines 247, 263 |

### Attestation Toggle (Lines 172-201)

| Requirement | Status | Location |
|-------------|--------|----------|
| Checkbox: `checkmark.square.fill` when checked, `square` when unchecked | ✅ | Line 177 |
| Attestation: "I attest this report is accurate to the best of my knowledge." | ✅ | Line 19, 184 |
| Explanatory: "By signing, you confirm the information in this report run reflects..." | ✅ | Lines 186-187 |
| Toggle bound to `attestationAccepted` | ✅ | Lines 36, 175-176 |

### Clear Button (Lines 228-236)

| Requirement | Status | Location |
|-------------|--------|----------|
| Appears only when `hasSignature` is true | ✅ | Line 227 |
| Clears both `paths` and `currentPath` | ✅ | Lines 230-231 |
| Haptic feedback on tap (`Haptics.tap()`) | ✅ | Line 230 |

### Sign & Lock Button (Lines 92-99)

| Requirement | Status | Location |
|-------------|--------|----------|
| Toolbar placement: `.topBarTrailing` | ✅ | Line 91 |
| Button text: "Sign & Lock" | ✅ | Line 93 |
| Disabled when `!canSubmit` (gray: `RMTheme.Colors.textTertiary`) | ✅ | Lines 95-97 |
| Enabled state: black text with `RMTheme.Typography.bodyBold` | ✅ | Lines 94-95 |

## 2. SVG Export Verified (Lines 329-346)

| Requirement | Status | Details |
|-------------|--------|---------|
| `exportPathsToSvg(strokes:width:height:)` generates valid SVG | ✅ | Lines 330-345 |
| SVG structure: `xmlns`, `width`, `height`, `viewBox` | ✅ | Line 344 |
| Path generation: per-segment `<path>` elements | ✅ | Lines 335-341 |
| Stroke attributes: `fill="none"`, `stroke="#000000"`, `stroke-linecap="round"`, `stroke-linejoin="round"` | ✅ | Line 340 |
| Pressure-sensitive width: `stroke-width` = average of adjacent point widths | ✅ | Line 338 |
| Path data format: `M x1 y1 L x2 y2` | ✅ | Line 339 |
| Only strokes with ≥2 points exported | ✅ | Lines 331, 335 |
| Canvas size fallback: 400×180 when `canvasSize` is zero | ✅ | Lines 302-303 |
| Empty SVG when no valid strokes | ✅ | Line 332 |

## 3. Validation Logic Verified (Lines 47-64)

| Requirement | Status | Details |
|-------------|--------|---------|
| `allPaths`: filters paths with ≥2 points, combines `paths` + `currentPath` | ✅ | Lines 47-51 |
| `hasSignature`: true when `allPaths` not empty | ✅ | Lines 53-55 |
| `canSubmit`: requires signature, name, title, attestation, !isSubmitting | ✅ | Lines 57-63 |
| Submit handler trims name and title | ✅ | Lines 286-287 |
| Validation messages: name/title, signature, SVG generation | ✅ | Lines 292, 299, 307 |
| `SignatureCaptureData` structure matches API | ✅ | Lines 6-11, 311-316 |
| `onSave` callback with completion handler | ✅ | Lines 318-327 |
| Dismiss only on `.success`, stay open on `.failure` | ✅ | Lines 321-324 |

## 4. Integration with TeamSignaturesSheet Verified

| Requirement | Status | Location |
|-------------|--------|----------|
| `SigningContext` provides `run` and `role` | ✅ | TeamSignaturesSheet 367-371 |
| Props: `role`, `reportRunId`, `reportRunHash`, `reportRunCreatedAt` | ✅ | Lines 108-122 |
| `reportRunHash` from `ctx.run.dataHash` | ✅ | Line 112 |
| `reportRunCreatedAt` formatted with dateFormatter | ✅ | Line 113 |
| `onSave` calls `submitSignature()` | ✅ | Lines 114-116 |
| `onCancel` clears `signingContext` | ✅ | Lines 118-119 |

## 5. API Integration Verified (APIClient 808-846)

| Requirement | Status | Details |
|-------------|--------|---------|
| `APIClient.shared.createSignature()` called with correct params | ✅ | TeamSignaturesSheet 339-346 |
| 403/409 errors keep sheet open, show error | ✅ | TeamSignaturesSheet 351-358 |
| Success: dismiss, toast, refresh runs | ✅ | TeamSignaturesSheet 347-350 |
| `isSubmitting` prevents concurrent submissions | ✅ | SignatureCaptureSheet 44, 284, 319 |

## 6. RBAC Permission Checks Verified (RBAC.swift 132-193)

| Role | prepared_by | reviewed_by | approved_by |
|------|-------------|-------------|-------------|
| **prepared_by** | Job creator or admin/owner only | — | — |
| **reviewed_by** | — | Any user except preparer | — |
| **approved_by** | — | — | Admin/owner only |
| **executive** | ❌ | ✅ (not preparer) | ❌ |

- `canSignAsReportRole()` enforces all rules ✅
- `canSignAs()` in TeamSignaturesSheet uses RBAC ✅ (Lines 37-39)
- "Sign as" buttons shown only when `canSignAsRole()` returns true ✅ (Lines 320-330)

## 7. Theme Consistency Verified (RMTheme.swift)

| Token | Expected | Actual |
|-------|----------|--------|
| Background | `#0A0A0A` | ✅ `Color(hex: "#0A0A0A")` |
| Surface | `#121212` | ✅ `Color(hex: "#121212")` |
| Accent | `#F97316` | ✅ `Color(hex: "#F97316")` |
| Spacing | xs=4, sm=8, md=16, lg=24, xl=32, xxl=48, pagePadding=20 | ✅ |
| Typography | body 17pt, bodySmall 15pt, caption 13pt, captionSmall 11pt | ✅ |
| Radius | sm=12, md=16, lg=24 | ✅ |

Component styling: signature pad (white bg, 2pt border, 12pt radius, 180pt height), input fields (inputFill, inputStroke), attestation (info 12%/30% opacity) — all verified ✅

## 8. Cross-Platform Consistency

| Feature | iOS | Web | Status |
|---------|-----|-----|--------|
| Canvas Drawing | Pressure-sensitive | Basic | iOS Enhanced |
| Apple Pencil | Force + Altitude | N/A | iOS Only |
| SVG Export | Per-segment width | Fixed width | iOS Enhanced |
| Attestation | Same text | Same text | ✅ Consistent |
| Validation | Same rules | Same rules | ✅ Consistent |
| Data Structure | SignatureCaptureData | SignatureData | ✅ Compatible |
| Run Info | Hash + Date | Hash + Date | ✅ Consistent |

API payload: both send `signer_name`, `signer_title`, `signature_role`, `signature_svg`, `attestation_text`, `attestation_accepted` — compatible ✅

## 9. Key Files

- `mobile/Riskmate/Riskmate/Views/Signatures/SignatureCaptureSheet.swift` — Main component
- `mobile/Riskmate/Riskmate/Views/Signatures/TeamSignaturesSheet.swift` — Parent workflow
- `mobile/Riskmate/Riskmate/Services/APIClient.swift` — API integration (lines 807-846)
- `mobile/Riskmate/Riskmate/Utils/RBAC.swift` — Permission logic (lines 132-193)
- `mobile/Riskmate/Riskmate/Theme/RMTheme.swift` — Design tokens
- `components/report/SignatureCapture.tsx` — Web equivalent

## 10. Data Flow

```
User → TeamSignaturesSheet → SignatureCaptureSheet → onSave → APIClient.createSignature()
                                                                    ↓
                                                      POST /api/reports/runs/:id/signatures
                                                                    ↓
                                                      Backend 201 → Dismiss + Toast + Refresh
```

## Conclusion

All verification items pass. The iOS SignatureCaptureSheet is production-ready, fully integrated with the team signatures workflow, and consistent with the web implementation while offering enhanced native features (pressure sensitivity, Apple Pencil).
