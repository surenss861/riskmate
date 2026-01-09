# PDF Report Template

This is a template for creating new PDF reports following the structural 2-page lock pattern.

## Structure

```
_template/
├── types.ts          # Input/output types
├── build.ts          # ONLY place allowed to call doc.addPage() (max once)
├── render/
│   ├── page1.ts     # Page 1 renderer
│   └── page2.ts     # Page 2 renderer
└── __tests__/
    └── golden-assertions.test.ts  # Board credibility tests
```

## Rules

1. **Only build.ts can add pages** - Call `doc.addPage()` exactly once (between Page 1 and Page 2)
2. **ensureSpace() never adds pages** - It only checks space and returns boolean
3. **Renderers must skip/truncate** - When `ensureSpace()` returns false, skip the section
4. **Golden tests assert board credibility** - Not pixel perfection, but:
   - Exactly 2 pages
   - Required phrases/blocks exist
   - No junk tokens / lonely pages
   - Lines that must be separate are separate

## Usage

1. Copy `_template/` to `yourReport/`
2. Update types in `types.ts`
3. Implement `build.ts` (import from `/lib/pdf/core/*`)
4. Implement renderers in `render/page1.ts` and `render/page2.ts`
5. Add golden assertions in `__tests__/golden-assertions.test.ts`
6. Register in `/lib/pdf/reports/index.ts`

## Example Route

```typescript
import { reports } from '@/lib/pdf/reports'

export async function POST(request: NextRequest) {
  // ... auth + fetch data ...
  
  const input = { /* your report input */ }
  const deps = { /* helpers from route */ }
  
  const result = await reports.yourReport.build(input, deps)
  
  return new NextResponse(result.buffer, {
    headers: { 'Content-Type': 'application/pdf' }
  })
}
```

