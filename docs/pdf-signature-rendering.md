# PDF Signature Rendering (SVG to PDF)

## Overview

The PDF Signature Rendering feature enables conversion of SVG signature data captured from web and mobile interfaces into high-quality vector signatures embedded in PDF reports. This ensures signatures remain crisp and tamper-evident when printed or viewed at any resolution.

## Architecture

### Core Components

1. **SVG Path Extraction** (`extractAllPathDs`)
   - Extracts `<path>` elements with `d` attributes
   - Converts `<polyline>` elements to SVG path syntax
   - Supports multiple strokes for complex signatures

2. **ViewBox Parsing** (`getViewBox`)
   - Parses SVG `viewBox` attribute for accurate scaling
   - Falls back to default dimensions (400x100) when viewBox is missing
   - Ensures proper aspect ratio preservation

3. **PDF Rendering** (`drawSignatureSvgPath`)
   - Scales and positions signatures within defined bounding boxes
   - Uses PDFKit's native `.path()` method for vector rendering
   - Handles multiple strokes for complete signature reproduction

## Implementation Details

### File Locations

- **Backend**: `apps/backend/src/utils/pdf/sections/signatures.ts`
- **Frontend/Lib**: `lib/utils/pdf/sections/signatures.ts`

### Data Flow

```
Signature Capture (Web/iOS)
    ↓
SVG String Storage (Supabase: report_signatures.signature_svg)
    ↓
API Fetch (GET /api/reports/runs/[id]/signatures)
    ↓
PDF Generation (Print Page → PDF Service)
    ↓
SVG Extraction & Rendering (drawSignatureSvgPath)
    ↓
Final PDF Output
```

## Supported SVG Formats

### Path Elements

```xml
<path d="M10 50 L100 50"/>
<path d="M10 50 Q50 10 100 50"/>
<path d="M10 50 C30 10 70 90 100 50"/>
```

### Polyline Elements

```xml
<polyline points="10,50 30,30 50,50 70,30 90,50"/>
```

Polylines are automatically converted to path syntax:
```
M 10 50 L 30 30 L 50 50 L 70 30 L 90 50
```

### ViewBox

```xml
<svg viewBox="0 0 400 100">...</svg>
```

The viewBox defines the coordinate system and aspect ratio. If missing, defaults to 400×100.

## Signature Capture Sources

### Web (React Signature Canvas)

```typescript
// Typical output from react-signature-canvas
const signatureSvg = canvas.toDataURL('image/svg+xml');
// Results in: <svg viewBox="0 0 400 100"><path d="..."/></svg>
```

### iOS (PKCanvas/PKDrawing)

```swift
// Native iOS signature capture
let drawing = pkCanvas.drawing
let svgData = drawing.dataRepresentation()
// Serializes to SVG with polyline elements
```

### Android (Custom Signature View)

```kotlin
// Custom signature capture view
val svgString = signatureView.toSVG()
// Generates SVG with path elements
```

## Scaling and Positioning

The rendering system automatically:

1. **Extracts dimensions** from viewBox or uses defaults
2. **Calculates scale** to fit signature within target box while preserving aspect ratio
3. **Centers signature** within the box using calculated offsets
4. **Applies padding** (2pt) for visual breathing room

```typescript
const pad = 2;
const scaleX = (boxW - pad * 2) / srcW;
const scaleY = (boxH - pad * 2) / srcH;
const scale = Math.min(scaleX, scaleY, 1.2); // Max 120% scale
const offsetX = boxX + pad + (boxW - pad * 2 - srcW * scale) / 2;
const offsetY = boxY + pad + (boxH - pad * 2 - srcH * scale) / 2;
```

## API Integration

### Creating a Signature

```typescript
POST /api/reports/runs/[id]/signatures
Content-Type: application/json

{
  "signer_name": "John Doe",
  "signer_title": "Site Manager",
  "signature_role": "prepared_by",
  "signature_svg": "<svg viewBox=\"0 0 400 100\"><path d=\"M10 50 L390 50\"/></svg>",
  "attestationAccepted": true
}
```

### Fetching Signatures

```typescript
GET /api/reports/runs/[id]/signatures

Response:
{
  "data": [
    {
      "id": "uuid",
      "signer_name": "John Doe",
      "signer_title": "Site Manager",
      "signature_role": "prepared_by",
      "signature_svg": "<svg>...</svg>",
      "signed_at": "2026-02-12T10:30:00Z",
      "signature_hash": "abc123...",
      "attestation_text": "I attest this report is accurate..."
    }
  ]
}
```

### PDF Download with Signatures

```typescript
GET /api/reports/runs/[id]/download

// Automatically fetches signatures and includes them in generated PDF
```

## Signature Roles

The system supports four signature roles:

- **`prepared_by`**: Person who prepared the report
- **`reviewed_by`**: Person who reviewed the report
- **`approved_by`**: Person who approved the report
- **`other`**: Additional signatures (stakeholders, clients, etc.)

## Security & Integrity

### Signature Hash

Each signature includes a SHA-256 hash computed from:
- `signature_svg`
- `signer_name`
- `signer_title`
- `signature_role`

This hash is displayed in the PDF for tamper verification.

### Data Binding

Signatures are bound to the `data_hash` of the report run, ensuring they cannot be moved to a different report version.

### Audit Trail

Each signature record includes:
- `ip_address`: IP address when signature was created
- `user_agent`: Browser/device information
- `attestation_text`: Legal attestation statement
- `signed_at`: Timestamp of signature creation

## Error Handling

### Malformed SVG Paths

```typescript
for (const pathD of paths) {
  try {
    doc.path(pathD).stroke();
  } catch (e) {
    // Skip malformed paths silently
    // Ensures PDF generation continues even with invalid paths
  }
}
```

### Missing ViewBox

```typescript
const viewBox = getViewBox(signatureSvg);
const srcW = viewBox?.w ?? 400; // Default to 400
const srcH = viewBox?.h ?? 100; // Default to 100
```

### Invalid Input

```typescript
if (!svg || typeof svg !== 'string') return [];
```

## Testing

### Unit Tests

Location: `__tests__/pdf-signature-rendering.test.ts`

Coverage:
- SVG path extraction (30 test cases)
- ViewBox parsing
- Edge cases and error handling
- Multi-stroke signatures
- Real-world signature formats

Run tests:
```bash
npm test -- pdf-signature-rendering.test.ts
```

### Integration Tests

Location: `__tests__/pdf-signature-integration.test.ts`

Coverage:
- Complete PDF generation with signatures
- Multiple signature formats
- Visual verification (generates test PDFs)

Run tests:
```bash
npm test -- pdf-signature-integration.test.ts
```

Test output PDFs are generated in `test-output/` directory for manual inspection.

## Best Practices

### Capturing Signatures

1. **Use consistent viewBox dimensions** (recommended: 400×100 or 500×200)
2. **Capture at sufficient resolution** for clean vector paths
3. **Validate SVG before storage** using `validateSignatureSvg` utility
4. **Store complete SVG** including viewBox and namespace attributes

### Rendering Signatures

1. **Preserve aspect ratio** when scaling
2. **Center signatures** within bounding boxes
3. **Apply consistent styling** (stroke color, line width)
4. **Handle errors gracefully** (skip malformed paths)

### Security

1. **Validate user authorization** before accepting signatures
2. **Require attestation acceptance** explicitly
3. **Bind signatures to data_hash** for tamper evidence
4. **Log audit trail** (IP, user agent, timestamp)

## Troubleshooting

### Signature Not Rendering

1. **Check SVG format**: Ensure paths or polylines are present
2. **Verify viewBox**: Add viewBox attribute if missing
3. **Check console logs**: Look for path rendering errors
4. **Test with simple SVG**: Start with `<path d="M10 50 L100 50"/>`

### Signature Appears Distorted

1. **Check aspect ratio**: Verify viewBox dimensions match signature bounds
2. **Inspect scale calculation**: Max scale is capped at 1.2×
3. **Review padding**: 2pt padding applied on all sides

### PDF Generation Fails

1. **Check PDF service configuration**: Ensure PDF_SERVICE_URL or BROWSERLESS_TOKEN is set
2. **Verify report run status**: Must be `ready_for_signatures` or later
3. **Check signature data**: Ensure all required fields are present

## Future Enhancements

Potential improvements:
- Support for filled paths and shapes
- Color signature rendering (currently black only)
- Signature compression for large multi-stroke signatures
- Real-time signature preview during capture
- Signature image caching for performance

## Related Documentation

- [Report Runs & Signatures API](./report-runs-api.md)
- [PDF Generation Flow](./pdf-generation.md)
- [Signature Validation](./signature-validation.md)
- [Audit Trail & Compliance](./audit-trail.md)

## Examples

See test files for comprehensive examples:
- `__tests__/pdf-signature-rendering.test.ts` - Unit test examples
- `__tests__/pdf-signature-integration.test.ts` - Integration test examples
- `test-output/signature-test-*.pdf` - Generated sample PDFs
