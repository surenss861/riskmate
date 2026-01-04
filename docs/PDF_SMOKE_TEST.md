# PDF Smoke Test Guide

## Overview

The PDF smoke test validates that PDF generation works correctly and catches regressions before they reach production. It verifies:

1. **Basic Structure**: Print page loads, PDF ready marker exists
2. **Court-Ready Assertions**:
   - Integrity & Verification page exists with Hash Algorithm/SHA-256
   - Empty state sections render correctly
   - TOC alignment (titles match rendered sections)

## Running Tests Locally

### Single URL Test

```bash
npm run test:pdf-smoke <print-url> [token]
```

Example:
```bash
npm run test:pdf-smoke "https://riskmate.vercel.app/reports/packet/print/abc123?token=xyz789"
```

### With Environment Variables

```bash
PRINT_URL="https://..." PRINT_TOKEN="..." npm run test:pdf-smoke
```

### Save Screenshots

```bash
npm run test:pdf-smoke <print-url> [token] --save-screenshot
```

## CI/CD Integration

The smoke test runs automatically on:
- Pull requests that modify PDF-related code
- Pushes to `main` branch
- Manual workflow dispatch

### Required GitHub Secrets

To enable automated testing across all packet types, add these repository secrets:

- `PDF_TEST_URL_AUDIT` - Print URL for audit packet
- `PDF_TEST_URL_INCIDENT` - Print URL for incident packet  
- `PDF_TEST_URL_COMPLIANCE` - Print URL for compliance packet
- `PDF_TEST_URL_INSURANCE` - Print URL for insurance packet
- `PDF_TEST_TOKEN` - Authentication token (shared across all URLs)

### Manual Workflow Trigger

1. Go to GitHub Actions → "PDF Smoke Tests"
2. Click "Run workflow"
3. Optionally provide a print URL (uses secrets if not provided)

## Test Assertions

### 1. PDF Ready Marker
- Verifies `#pdf-ready[data-ready="1"]` exists
- Critical: PDF service waits for this marker

### 2. Page Structure
- Cover page exists
- Section headers present
- Metadata attributes on `<body>` tag

### 3. Integrity & Verification Page
- Page with "Integrity" or "Verification" text exists
- Contains "Hash Algorithm" or "SHA-256" text
- Contains hash block (32+ character hex string or monospace font)

### 4. Empty State Sections
- At least one `.section-empty` element (if data is missing)
- Empty sections have title and message structure
- Informational only (doesn't fail if all sections have data)

### 5. TOC Alignment
- TOC item count roughly matches section header count
- Ratio check (TOC items / sections) should be ~0.8-1.2
- Informational only (doesn't fail if TOC is missing)

## Test Output

### Success Example

```
🔍 Starting PDF smoke test...
📍 URL: https://riskmate.vercel.app/reports/packet/print/abc123?token=***
📄 Loading print page...
✅ Page loaded successfully
⏳ Waiting for PDF ready marker (#pdf-ready[data-ready="1"])...
✅ PDF ready marker found
🔍 Verifying page structure...
  ✅ Cover page
  ✅ Section headers
  ✅ Organization metadata
  ✅ Job ID metadata
  ✅ Run ID metadata
🔍 Court-ready check 1: Integrity & Verification page...
  ✅ Integrity page found
  ✅ Hash Algorithm/SHA-256 content present
  ✅ Hash block detected
🔍 Court-ready check 2: Empty state sections...
  Found 3 empty section(s)
  ✅ Empty section structure verified
🔍 Court-ready check 3: TOC alignment...
  TOC items: 8, Section headers: 10
  ✅ TOC alignment verified (ratio: 0.80)
📸 Taking screenshot...
✅ Screenshot captured (245832 bytes)

✅ Smoke test passed!
```

### Failure Example

```
❌ Smoke test failed!
   Error: PDF ready marker not found - PDF service will hang!
```

## Troubleshooting

### "PDF ready marker not found"
- Check that the print page renders correctly in browser
- Verify `#pdf-ready[data-ready="1"]` exists in page HTML
- Check for JavaScript errors preventing render

### "Integrity page check failed"
- Ensure Integrity & Verification section is included in packet
- Verify "Hash Algorithm" or "SHA-256" text is present
- Check that document hash is computed and displayed

### Screenshots
- Screenshots are automatically saved in CI as artifacts
- Use `--save-screenshot` flag locally to save files
- Compare screenshots visually to catch visual regressions

## Future Enhancements

- **Pixel Diff Testing**: Compare screenshots against golden baselines
- **PDF Content Parsing**: Extract text from generated PDF and assert key strings
- **Performance Metrics**: Measure page load time, PDF generation time
- **Multi-Packet Validation**: Test all packet types in single run

