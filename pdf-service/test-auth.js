#!/usr/bin/env node
/**
 * Test script to verify PDF service authentication and basic functionality
 * Usage: node test-auth.js <secret> <test-url>
 */

const crypto = require('crypto')

const SECRET = process.argv[2] || '151bf8598584fbfe2dd4753d1fa56ec1939af8dc0efde65a83df03a357e1e0bf'
const SERVICE_URL = process.env.PDF_SERVICE_URL || 'https://pdf-service-dawn-silence-4921.fly.dev'
const TEST_URL = process.argv[3] || 'https://example.com'

function generateToken(secret, requestId, url) {
  const timestamp = Date.now().toString()
  const message = `${requestId}:${url}:${timestamp}`
  const hmac = crypto.createHmac('sha256', secret).update(message).digest('hex')
  return `${timestamp}:${hmac}`
}

async function testHealth() {
  console.log('Testing health endpoint...')
  const response = await fetch(`${SERVICE_URL}/health`)
  const data = await response.json()
  console.log('✓ Health check:', data)
  return response.ok
}

async function testAuth() {
  console.log('\nTesting authentication...')
  const requestId = 'test-' + Date.now()
  const token = generateToken(SECRET, requestId, TEST_URL)
  
  console.log(`Request ID: ${requestId}`)
  console.log(`Token format: ${token.substring(0, 30)}...`)
  
  try {
    const response = await fetch(`${SERVICE_URL}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        url: TEST_URL,
        requestId,
      }),
    })
    
    if (response.status === 401) {
      console.error('✗ Authentication failed (401)')
      const text = await response.text()
      console.error('Response:', text)
      return false
    }
    
    if (!response.ok) {
      console.error(`✗ Request failed (${response.status})`)
      const text = await response.text()
      console.error('Response:', text.substring(0, 500))
      return false
    }
    
    const pdfBuffer = await response.arrayBuffer()
    console.log(`✓ Authentication successful!`)
    console.log(`✓ PDF generated: ${pdfBuffer.byteLength} bytes`)
    return true
  } catch (error) {
    console.error('✗ Request error:', error.message)
    return false
  }
}

async function main() {
  console.log(`PDF Service Test`)
  console.log(`Service URL: ${SERVICE_URL}`)
  console.log(`Test URL: ${TEST_URL}`)
  console.log(`Secret: ${SECRET.substring(0, 16)}...`)
  console.log('')
  
  const healthOk = await testHealth()
  if (!healthOk) {
    console.error('\n✗ Health check failed')
    process.exit(1)
  }
  
  const authOk = await testAuth()
  if (!authOk) {
    console.error('\n✗ Authentication test failed')
    process.exit(1)
  }
  
  console.log('\n✓ All tests passed!')
}

main().catch(console.error)

