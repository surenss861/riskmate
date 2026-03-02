#!/usr/bin/env node
/**
 * CI check: verify lib/webhooks/eventTypes.ts WEBHOOK_EVENT_TYPES and
 * apps/backend/src/workers/webhookDelivery.ts ALLOWED_WEBHOOK_EVENT_TYPES
 * stay in sync. Prevents mismatches that would cause invalid event type errors
 * or silent allowlist gaps.
 */
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')

function extractEventTypesFromArray(content, arrayName) {
  const re = new RegExp(`${arrayName}[^=]*=\\s*\\[([\\s\\S]*?)\\]\\s*(?:as const)?`, 'm')
  const m = content.match(re)
  if (!m) return []
  const block = m[1]
  const matches = block.matchAll(/'([a-z_]+\.[a-z_]+)'/g)
  const events = []
  for (const match of matches) events.push(match[1])
  return [...new Set(events)].sort()
}

const libPath = path.join(root, 'lib/webhooks/eventTypes.ts')
const backendPath = path.join(root, 'apps/backend/src/workers/webhookDelivery.ts')

const libContent = fs.readFileSync(libPath, 'utf8')
const backendContent = fs.readFileSync(backendPath, 'utf8')

const libEvents = extractEventTypesFromArray(libContent, 'WEBHOOK_EVENT_TYPES')
const backendEvents = extractEventTypesFromArray(backendContent, 'ALLOWED_WEBHOOK_EVENT_TYPES')

const libOnly = libEvents.filter((e) => !backendEvents.includes(e))
const backendOnly = backendEvents.filter((e) => !libEvents.includes(e))

if (libOnly.length > 0 || backendOnly.length > 0) {
  if (libOnly.length > 0) {
    console.error('In lib/webhooks/eventTypes.ts but not in backend ALLOWED_WEBHOOK_EVENT_TYPES:', libOnly.join(', '))
  }
  if (backendOnly.length > 0) {
    console.error('In backend ALLOWED_WEBHOOK_EVENT_TYPES but not in lib WEBHOOK_EVENT_TYPES:', backendOnly.join(', '))
  }
  process.exit(1)
}

console.log('Webhook event types in sync (lib vs backend)')
