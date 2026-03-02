#!/usr/bin/env node
/**
 * CI check: verify lib/utils/webhookSigning.ts, lib/utils/webhookUrl.ts, and lib/webhooks/payloads.ts
 * stay in sync with apps/backend/src/utils/*. Only the "Canonical source" comment line may differ
 * between each pair. Payloads are compared by content parity (backend is self-contained, not re-export).
 */
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')

function normalize(content) {
  return content
    .split('\n')
    .filter((line) => !/Canonical source|CI checks identity/.test(line))
    .join('\n')
}

// Extract function body (from opening { to matching }) for content-parity comparison.
function extractFunctionBody(content, name) {
  const re = new RegExp(
    `(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\([^)]*\\)\\s*[^{]*\\{`,
    's'
  )
  const match = content.match(re)
  if (!match) return null
  let start = match.index + match[0].length - 1
  let depth = 1
  let i = start + 1
  while (i < content.length && depth) {
    const c = content[i]
    if (c === '{') depth++
    else if (c === '}') depth--
    i++
  }
  return content.slice(start, i - 1)
}

function normalizeCodeBlock(block) {
  return block
    .replace(/\s+/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\s+as\s+unknown\s+as\s+Record\s*<\s*string\s*,\s*unknown\s*>/g, '')
    .replace(/\s+as\s+[^;,)\s]+(?=\s*[;,)\]}])/g, '')
    .replace(/\s+as\s+[a-zA-Z][a-zA-Z0-9]*\b/g, '')
    .replace(/:\s*(?:ReportGeneratedObject|EvidenceUploadedObject|SignatureAddedObject|Record\s*<\s*string\s*,\s*unknown\s*>)\s*=/g, ' =')
    .trim()
}

const PAYLOAD_FUNCTIONS = [
  'buildReportGeneratedObject',
  'buildEvidenceUploadedObject',
  'buildSignatureAddedObject',
  'buildWebhookEventObject',
]

function payloadsContentParity(libContent, backendContent) {
  for (const name of PAYLOAD_FUNCTIONS) {
    const libBody = extractFunctionBody(libContent, name)
    const backBody = extractFunctionBody(backendContent, name)
    if (!libBody || !backBody) {
      return { ok: false, reason: `missing function ${name} in one or both files` }
    }
    const normLib = normalizeCodeBlock(libBody)
    const normBack = normalizeCodeBlock(backBody)
    if (normLib !== normBack) {
      return { ok: false, reason: `function ${name} body differs` }
    }
  }
  return { ok: true }
}

const pairs = [
  ['lib/utils/webhookSigning.ts', 'apps/backend/src/utils/webhookSigning.ts'],
  ['lib/utils/webhookUrl.ts', 'apps/backend/src/utils/webhookUrl.ts'],
]

const payloadPair = ['lib/webhooks/payloads.ts', 'apps/backend/src/utils/webhookPayloads.ts']

let failed = false
for (const [a, b] of pairs) {
  const pathA = path.join(root, a)
  const pathB = path.join(root, b)
  const contentA = normalize(fs.readFileSync(pathA, 'utf8'))
  const contentB = normalize(fs.readFileSync(pathB, 'utf8'))
  if (contentA !== contentB) {
    console.error(`Mismatch: ${a} vs ${b} (content differs after removing canonical comment)`)
    failed = true
  }
}

const [payloadLib, payloadBackend] = payloadPair
const pathPayloadLib = path.join(root, payloadLib)
const pathPayloadBackend = path.join(root, payloadBackend)
const contentPayloadLib = fs.readFileSync(pathPayloadLib, 'utf8')
const contentPayloadBackend = fs.readFileSync(pathPayloadBackend, 'utf8')
const parity = payloadsContentParity(contentPayloadLib, contentPayloadBackend)
if (!parity.ok) {
  console.error(`Mismatch: ${payloadLib} vs ${payloadBackend} (${parity.reason})`)
  failed = true
}

if (failed) process.exit(1)
console.log('Webhook utils in sync (lib vs backend)')
