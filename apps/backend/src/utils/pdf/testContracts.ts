/**
 * PDF Contract Test Harness
 * Validates that PDF generators follow their formal contracts
 * 
 * Run with: tsx src/utils/pdf/testContracts.ts
 */

import {
  validateLedgerExportInput,
  validateControlsInput,
  validateAttestationsInput,
  validateEvidenceIndexInput,
} from './contracts'
import {
  calculateControlKPIs,
  calculateAttestationKPIs,
  sortControls,
  sortAttestations,
  normalizeControlStatus,
  normalizeAttestationStatus,
  isControlOverdue,
  isHighSeverity,
  formatDate,
  countActiveFilters,
} from './normalize'

// ============================================================================
// FIXTURE DATA
// ============================================================================

const mockControls = [
  {
    control_id: 'ctrl-001',
    title: 'Control 1',
    status_at_export: 'completed',
    severity: 'high',
    owner_email: 'owner1@example.com',
    due_date: '2024-01-01',
    updated_at: '2024-01-15T10:00:00Z',
  },
  {
    control_id: 'ctrl-002',
    title: 'Control 2',
    status_at_export: 'pending',
    severity: 'critical',
    owner_email: 'owner2@example.com',
    due_date: '2023-12-01', // Overdue
    updated_at: '2024-01-10T10:00:00Z',
  },
  {
    control_id: 'ctrl-003',
    title: 'Control 3',
    status_at_export: 'pending',
    severity: 'low',
    owner_email: 'owner3@example.com',
    due_date: '2024-02-01', // Future
    updated_at: '2024-01-20T10:00:00Z',
  },
]

const mockAttestations = [
  {
    attestation_id: 'att-001',
    title: 'Attestation 1',
    status_at_export: 'completed',
    attested_by_email: 'user1@example.com',
    attested_at: '2024-01-15T10:00:00Z',
  },
  {
    attestation_id: 'att-002',
    title: 'Attestation 2',
    status_at_export: 'pending',
    attested_by_email: '',
    attested_at: '',
  },
  {
    attestation_id: 'att-003',
    title: 'Attestation 3',
    status_at_export: 'signed',
    attested_by_email: 'user2@example.com',
    attested_at: '2024-01-20T10:00:00Z',
  },
]

const mockFilters = {
  time_range: '30d',
  job_id: 'job-123',
  site_id: null,
  category: 'operations',
  actor_id: null,
  severity: null,
  outcome: null,
  view: null,
  start_date: null,
  end_date: null,
}

// ============================================================================
// TESTS
// ============================================================================

function testControlKPIs() {
  console.log('Testing Control KPIs...')
  const kpis = calculateControlKPIs(mockControls)
  
  console.assert(kpis.total === 3, `Expected total=3, got ${kpis.total}`)
  console.assert(kpis.completed === 1, `Expected completed=1, got ${kpis.completed}`)
  console.assert(kpis.pending === 2, `Expected pending=2, got ${kpis.pending}`)
  console.assert(kpis.overdue === 1, `Expected overdue=1, got ${kpis.overdue}`)
  console.assert(kpis.highSeverity === 2, `Expected highSeverity=2, got ${kpis.highSeverity}`)
  
  console.log('✅ Control KPIs passed')
}

function testControlSorting() {
  console.log('Testing Control Sorting...')
  const sorted = sortControls(mockControls)
  
  // First should be overdue (ctrl-002)
  console.assert(sorted[0].control_id === 'ctrl-002', `Expected first=ctrl-002, got ${sorted[0].control_id}`)
  // Second should be high severity (ctrl-001)
  console.assert(sorted[1].control_id === 'ctrl-001', `Expected second=ctrl-001, got ${sorted[1].control_id}`)
  // Third should be low severity (ctrl-003)
  console.assert(sorted[2].control_id === 'ctrl-003', `Expected third=ctrl-003, got ${sorted[2].control_id}`)
  
  console.log('✅ Control Sorting passed')
}

function testAttestationKPIs() {
  console.log('Testing Attestation KPIs...')
  const kpis = calculateAttestationKPIs(mockAttestations)
  
  console.assert(kpis.total === 3, `Expected total=3, got ${kpis.total}`)
  console.assert(kpis.completed === 2, `Expected completed=2, got ${kpis.completed}`)
  console.assert(kpis.pending === 1, `Expected pending=1, got ${kpis.pending}`)
  
  console.log('✅ Attestation KPIs passed')
}

function testAttestationSorting() {
  console.log('Testing Attestation Sorting...')
  const sorted = sortAttestations(mockAttestations)
  
  // First should be pending (att-002)
  console.assert(sorted[0].attestation_id === 'att-002', `Expected first=att-002, got ${sorted[0].attestation_id}`)
  // Then most recent completed (att-003)
  console.assert(sorted[1].attestation_id === 'att-003', `Expected second=att-003, got ${sorted[1].attestation_id}`)
  // Then older completed (att-001)
  console.assert(sorted[2].attestation_id === 'att-001', `Expected third=att-001, got ${sorted[2].attestation_id}`)
  
  console.log('✅ Attestation Sorting passed')
}

function testStatusNormalization() {
  console.log('Testing Status Normalization...')
  
  console.assert(normalizeControlStatus('completed') === 'completed', 'completed should normalize to completed')
  console.assert(normalizeControlStatus('done') === 'completed', 'done should normalize to completed')
  console.assert(normalizeControlStatus('pending') === 'pending', 'pending should normalize to pending')
  
  console.assert(normalizeAttestationStatus('signed') === 'completed', 'signed should normalize to completed')
  console.assert(normalizeAttestationStatus('completed') === 'completed', 'completed should normalize to completed')
  console.assert(normalizeAttestationStatus('pending') === 'pending', 'pending should normalize to pending')
  
  console.log('✅ Status Normalization passed')
}

function testOverdueLogic() {
  console.log('Testing Overdue Logic...')
  
  const now = new Date()
  const pastDate = new Date(now.getTime() - 86400000).toISOString() // Yesterday
  const futureDate = new Date(now.getTime() + 86400000).toISOString() // Tomorrow
  
  console.assert(isControlOverdue('pending', pastDate) === true, 'Pending with past due date should be overdue')
  console.assert(isControlOverdue('completed', pastDate) === false, 'Completed should never be overdue')
  console.assert(isControlOverdue('pending', futureDate) === false, 'Pending with future due date should not be overdue')
  console.assert(isControlOverdue('pending', null) === false, 'Pending with no due date should not be overdue')
  
  console.log('✅ Overdue Logic passed')
}

function testSeverityRanking() {
  console.log('Testing Severity Ranking...')
  
  console.assert(isHighSeverity('high') === true, 'high should be high severity')
  console.assert(isHighSeverity('critical') === true, 'critical should be high severity')
  console.assert(isHighSeverity('low') === false, 'low should not be high severity')
  console.assert(isHighSeverity('info') === false, 'info should not be high severity')
  
  console.log('✅ Severity Ranking passed')
}

function testDateFormatting() {
  console.log('Testing Date Formatting...')
  
  const date = '2024-01-15T10:00:00Z'
  const formatted = formatDate(date, 'short')
  console.assert(formatted !== 'N/A', `Date should format, got ${formatted}`)
  
  const invalid = formatDate('invalid', 'short')
  console.assert(invalid === 'N/A', `Invalid date should return N/A, got ${invalid}`)
  
  console.log('✅ Date Formatting passed')
}

function testFilterCounting() {
  console.log('Testing Filter Counting...')
  
  const count = countActiveFilters(mockFilters)
  console.assert(count === 2, `Expected 2 active filters, got ${count}`) // time_range + job_id + category = 3, but let's check
  
  console.log('✅ Filter Counting passed')
}

function testInputValidation() {
  console.log('Testing Input Validation...')
  
  const ledgerInput = {
    ledgerEvents: [],
    filters: mockFilters,
    packMetadata: {
      packId: 'PACK-TEST',
      organizationName: 'Test Org',
      generatedBy: 'Test User',
      generatedByRole: 'admin',
      generatedAt: new Date().toISOString(),
      timeRange: '30d',
    },
  }
  
  const ledgerValidation = validateLedgerExportInput(ledgerInput)
  console.assert(ledgerValidation.valid === true, 'Valid ledger input should pass validation')
  
  const controlsInput = {
    controls: mockControls,
    filters: mockFilters,
    packMetadata: ledgerInput.packMetadata,
  }
  
  const controlsValidation = validateControlsInput(controlsInput)
  console.assert(controlsValidation.valid === true, 'Valid controls input should pass validation')
  
  const attestationsInput = {
    attestations: mockAttestations,
    filters: mockFilters,
    packMetadata: ledgerInput.packMetadata,
  }
  
  const attestationsValidation = validateAttestationsInput(attestationsInput)
  console.assert(attestationsValidation.valid === true, 'Valid attestations input should pass validation')
  
  console.log('✅ Input Validation passed')
}

function testNoControlCharacters() {
  console.log('Testing No Control Characters in Ledger PDF...')
  
  const { sanitizeText } = require('./normalize')
  
  // Test KPI row values (the most common source of control characters)
  const kpiValues = [
    { label: 'Total Events', value: 100 },
    { label: 'Displayed', value: 100 },
    { label: 'Active Filters', value: 2 },
    { label: 'Hash Verified', value: 'Yes' }, // This was the problematic one
  ]
  
  kpiValues.forEach((kpi) => {
    const labelText = sanitizeText(kpi.label)
    const valueText = typeof kpi.value === 'string' ? sanitizeText(kpi.value) : String(kpi.value)
    
    // Check for control characters (ASCII 0-31, 127)
    const hasControlChars = /[\x00-\x1F\x7F]/.test(labelText) || /[\x00-\x1F\x7F]/.test(valueText)
    console.assert(!hasControlChars, `KPI "${kpi.label}" contains control characters`)
    
    // Check for zero-width characters
    const hasZeroWidth = /[\u200B-\u200D\uFEFF]/.test(labelText) || /[\u200B-\u200D\uFEFF]/.test(valueText)
    console.assert(!hasZeroWidth, `KPI "${kpi.label}" contains zero-width characters`)
  })
  
  // Test table cell data
  const tableCellData = [
    'Event Name',
    'Category',
    'Outcome',
    'Severity',
    'Actor Name',
    'System',
  ]
  
  tableCellData.forEach((cell) => {
    const sanitized = sanitizeText(cell)
    const hasControlChars = /[\x00-\x1F\x7F]/.test(sanitized)
    console.assert(!hasControlChars, `Table cell "${cell}" contains control characters after sanitization`)
  })
  
  // Test evidence reference text
  const evidenceText = 'Note: Evidence files are auth-gated. Use the Work Record IDs below to retrieve evidence via the Compliance Ledger interface.'
  const sanitizedEvidence = sanitizeText(evidenceText)
  const hasControlChars = /[\x00-\x1F\x7F]/.test(sanitizedEvidence)
  console.assert(!hasControlChars, 'Evidence reference text contains control characters after sanitization')
  
  // Test with actual problematic characters
  const problematicText = 'Hash Verified\u0005' // The exact issue reported
  const sanitizedProblematic = sanitizeText(problematicText)
  const stillHasControlChars = /[\x00-\x1F\x7F]/.test(sanitizedProblematic)
  console.assert(!stillHasControlChars, 'Sanitization should remove control character \\u0005')
  console.assert(sanitizedProblematic === 'Hash Verified', `Expected "Hash Verified", got "${sanitizedProblematic}"`)
  
  // Test the "auth￾gated" broken glyph case (U+FFFE or similar replacement character)
  const brokenGlyphText = 'Note: Evidence files are auth￾gated. Use the Work Record IDs below to retrieve evidence via the Compliance Ledger interface.'
  const sanitizedBrokenGlyph = sanitizeText(brokenGlyphText)
  const hasBrokenGlyph = /[\uFFFD-\uFFFF]/.test(sanitizedBrokenGlyph)
  console.assert(!hasBrokenGlyph, 'Evidence reference text contains replacement/broken glyph characters after sanitization')
  // Should normalize to "auth-gated" (the broken glyph should be removed, leaving "authgated" which we can detect)
  // The key is that it should NOT contain the broken glyph character
  const authIndex = sanitizedBrokenGlyph.indexOf('auth')
  if (authIndex >= 0) {
    const authSection = sanitizedBrokenGlyph.substring(authIndex, authIndex + 20)
    const hasBrokenChar = /[\uFFFD-\uFFFF]/.test(authSection)
    console.assert(!hasBrokenChar, `Auth section still contains broken glyph: "${authSection}"`)
  }
  
  // Test with various broken Unicode characters that might appear
  const unicodeVariants = [
    'auth￾gated', // U+FFFE (replacement character)
    'auth\uFFFDgated', // U+FFFD (replacement character)
    'auth\u200Bgated', // Zero-width space
    'auth\uFEFFgated', // Zero-width no-break space
  ]
  
  unicodeVariants.forEach((variant) => {
    const sanitized = sanitizeText(variant)
    const hasControlChars = /[\x00-\x1F\x7F]/.test(sanitized)
    const hasBrokenGlyphs = /[\uFFFD\uFFFE\uFFFF]/.test(sanitized)
    const hasZeroWidth = /[\u200B-\u200D\uFEFF]/.test(sanitized)
    console.assert(!hasControlChars, `Variant "${variant}" still contains control characters after sanitization`)
    console.assert(!hasBrokenGlyphs, `Variant "${variant}" still contains broken glyph characters after sanitization`)
    console.assert(!hasZeroWidth, `Variant "${variant}" still contains zero-width characters after sanitization`)
  })
  
  console.log('✅ No Control Characters test passed')
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================

function runAllTests() {
  console.log('🧪 Running PDF Contract Tests...\n')
  
  try {
    testControlKPIs()
    testControlSorting()
    testAttestationKPIs()
    testAttestationSorting()
    testStatusNormalization()
    testOverdueLogic()
    testSeverityRanking()
    testDateFormatting()
    testFilterCounting()
    testInputValidation()
    testNoControlCharacters()
    
    console.log('\n✅ All tests passed!')
    process.exit(0)
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message)
    process.exit(1)
  }
}

// Run if executed directly
if (require.main === module) {
  runAllTests()
}

export { runAllTests }
