# Anchored Proof™ — Riskmate Abstract Symbol Specification (v1)

**Two elements → one resolved structure**

Upper element = field evidence (variable, imperfect)  
Lower element = ledger anchor (stable, authoritative)  
Resolution = proof (audit-ready, defensible)

No metaphor clutter. No decoration. This is a mechanism, not an icon.

---

## 1. Geometry Construction (24×24 grid)

| Element | Width | Height | Position | Offset |
|---------|-------|--------|----------|--------|
| Bottom block (Anchor) | 16 | 6 | bottom-aligned | center |
| Top block (Proof) | 12 | 5 | gap 1 above anchor | +1 unit right |

- Corner radius: 0 (hard edge = authority)
- The +1 offset is critical — perfect alignment kills the meaning

### Coordinates (viewBox 0 0 24 24)

- Bottom: `rect x=4 y=18 width=16 height=6`
- Top: `rect x=7 y=12 width=12 height=5`

---

## 2. Usage by Context

| Context | Treatment | File |
|---------|-----------|------|
| App icon (iOS/Android) | Solid fill, Riskmate Orange on black, 3u padding | `anchored-proof.svg` |
| Ledger Seal / PDF stamp | Stroke only, 1u width, opacity 0.22 | `anchored-proof-seal.svg` |
| Web / UI small | Solid fill, opacity 0.9, no shadow/glow | `anchored-proof.svg` |

---

## 3. Color Discipline

**Allowed:** Riskmate Orange (#F97316), White, Black  
**Not allowed:** Gradients, glass, glow, secondary accents

Must survive: black & white printing, legal exhibits, screenshot exports.

---

## 4. Motion Rules (Ledger Freeze)

1. Top block enters slightly misaligned
2. Subtle downward motion (evidence submitted)
3. Micro-snap into perfect alignment
4. 120ms settle, hold
5. Easing: cubic, no bounce, no spring

Feels like a mechanical latch, not a UI flourish.

---

## 5. Usage Hierarchy

| Context | Symbol treatment |
|---------|------------------|
| App icon | Symbol only |
| Web hero | Wordmark + symbol (compact lockup) |
| Ledger exports | Seal variant |
| Proof packs | Watermark or footer |
| Motion | Lock-in animation only |

**Never decorate it. Never animate it casually.**

---

## 6. SVG Implementation Rules

- One `<path>` or `<rect>` per block
- No masks
- ViewBox fixed at `0 0 24 24`
- Scale via viewBox, never via path edits

---

## 7. Files

- `public/anchored-proof.svg` — solid fill (app icon, web, UI)
- `public/anchored-proof-seal.svg` — stroke only (PDF, watermark)
- Existing logos: `riskmate logos/` (unchanged)
