/**
 * Lint test to enforce extractProxyError usage on fetch calls
 * 
 * This test scans for fetch() calls that check response.ok and ensures
 * they use extractProxyError for consistent error handling.
 * 
 * Goal: Prevent error handling drift and ensure all errors are debuggable.
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const SCAN_DIRECTORIES = ['app/operations', 'app/api']
const EXCLUDE_DIRECTORIES = ['node_modules', '.next', 'dist', 'build', '__tests__', '.git']
const EXCLUDE_FILES = ['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx']

// Patterns that indicate error handling
const ERROR_HANDLING_PATTERNS = [
  /if\s*\(\s*!response\.ok\s*\)/g,
  /if\s*\(\s*response\.ok\s*===\s*false\s*\)/g,
  /if\s*\(\s*response\.status\s*>\=\s*400\s*\)/g,
]

// Pattern that indicates extractProxyError usage
const EXTRACT_PROXY_ERROR_PATTERN = /extractProxyError\s*\(/g

// Pattern that indicates fetch calls
const FETCH_PATTERN = /fetch\s*\(/g

interface Violation {
  file: string
  line: number
  context: string
}

function getAllFiles(dir: string, fileList: string[] = []): string[] {
  const files = readdirSync(dir)

  files.forEach((file) => {
    const filePath = join(dir, file)
    const stat = statSync(filePath)

    if (stat.isDirectory()) {
      // Skip excluded directories
      if (!EXCLUDE_DIRECTORIES.some((excluded) => filePath.includes(excluded))) {
        getAllFiles(filePath, fileList)
      }
    } else if (stat.isFile()) {
      // Only include TypeScript/TSX files
      if (
        (file.endsWith('.ts') || file.endsWith('.tsx')) &&
        !EXCLUDE_FILES.some((excluded) => file.endsWith(excluded))
      ) {
        fileList.push(filePath)
      }
    }
  })

  return fileList
}

function checkFile(filePath: string): Violation[] {
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const violations: Violation[] = []

  // Check if file contains fetch calls
  if (!FETCH_PATTERN.test(content)) {
    return violations // No fetch calls, skip
  }

  // Check each line for error handling patterns
  lines.forEach((line, index) => {
    const lineNumber = index + 1

    // Check if this line has an error handling pattern
    const hasErrorHandling = ERROR_HANDLING_PATTERNS.some((pattern) => pattern.test(line))

    if (hasErrorHandling) {
      // Check if extractProxyError is used in the surrounding context (next 10 lines)
      const contextStart = Math.max(0, index)
      const contextEnd = Math.min(lines.length, index + 10)
      const context = lines.slice(contextStart, contextEnd).join('\n')

      // Reset regex state
      ERROR_HANDLING_PATTERNS.forEach((pattern) => {
        pattern.lastIndex = 0
      })
      EXTRACT_PROXY_ERROR_PATTERN.lastIndex = 0

      // Check if extractProxyError is used in context
      const usesExtractProxyError = EXTRACT_PROXY_ERROR_PATTERN.test(context)

      if (!usesExtractProxyError) {
        violations.push({
          file: filePath,
          line: lineNumber,
          context: line.trim(),
        })
      }
    }
  })

  return violations
}

describe('Error Handling Enforcement', () => {
  it('should use extractProxyError for all fetch error handling', () => {
    const violations: Violation[] = []

    SCAN_DIRECTORIES.forEach((dir) => {
      const files = getAllFiles(dir)
      files.forEach((file) => {
        const fileViolations = checkFile(file)
        violations.push(...fileViolations)
      })
    })

    if (violations.length > 0) {
      const violationMessages = violations.map(
        (v) => `  ${v.file}:${v.line}\n    ${v.context}`
      )

      fail(
        `Found ${violations.length} fetch error handling violation(s) that do not use extractProxyError:\n\n${violationMessages.join('\n\n')}\n\n` +
          `Fix: Replace manual error handling with extractProxyError helper:\n` +
          `  const { code, message, hint, errorId, requestId, statusCode } = await extractProxyError(response)\n` +
          `  logProxyError(errorId, code, endpoint, statusCode, requestId)`
      )
    }
  })
})

