#!/usr/bin/env node
/**
 * CI check: verify lib/utils/webhookSigning.ts and lib/utils/webhookUrl.ts stay in sync
 * with apps/backend/src/utils/webhookSigning.ts and apps/backend/src/utils/webhookUrl.ts.
 * Only the "Canonical source" comment line may differ between each pair.
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

const pairs = [
  ['lib/utils/webhookSigning.ts', 'apps/backend/src/utils/webhookSigning.ts'],
  ['lib/utils/webhookUrl.ts', 'apps/backend/src/utils/webhookUrl.ts'],
]

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
if (failed) process.exit(1)
console.log('Webhook utils in sync (lib vs backend)')
