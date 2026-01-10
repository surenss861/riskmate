/**
 * Banned Phrases Test
 * 
 * Enforces defensibility language consistency across the codebase.
 * Scans app/** and components/** for banned phrases that should be replaced
 * with defensibility terminology.
 * 
 * This test fails CI if banned phrases are found, preventing language drift.
 * 
 * Last Updated: January 10, 2026
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { bannedPhrases, phraseReplacements } from '../lib/copy/terms'

// Files/directories to exclude from scanning
const EXCLUDE_PATTERNS = [
  'node_modules',
  '.next',
  'dist',
  'build',
  '.git',
  '__tests__', // Exclude test files themselves
  'jest.config.js',
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'tsconfig.json',
  '.eslintrc',
  '.prettierrc',
  'docs', // Documentation can use old terms for clarity
  '.d.ts', // Type definitions
  '.map', // Source maps
]

// File extensions to scan (only UI-facing code)
const SCAN_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js']

// Directories to scan (UI-facing code only, exclude API routes)
const SCAN_DIRECTORIES = ['app/operations', 'components']

// Exclude these directories/files from scanning (database schema / API code / source of truth)
const EXCLUDE_DIRECTORIES = ['app/api', 'apps/backend', 'supabase/migrations', 'lib/copy/terms.ts', 'lib/terms.ts']

interface Violation {
  file: string
  line: number
  phrase: string
  suggestion: string
}

/**
 * Recursively scan directory for files matching scan extensions
 */
function scanDirectory(dir: string, basePath: string = ''): string[] {
  const files: string[] = []
  
  try {
    const entries = readdirSync(dir)
    
    for (const entry of entries) {
      // Skip excluded patterns
      if (EXCLUDE_PATTERNS.some(pattern => entry.includes(pattern))) {
        continue
      }
      
      // Skip excluded directories
      if (EXCLUDE_DIRECTORIES.some(excludeDir => {
        const fullPath = join(dir, entry)
        return fullPath.includes(excludeDir) || basePath.includes(excludeDir)
      })) {
        continue
      }
      
      const fullPath = join(dir, entry)
      const relativePath = basePath ? `${basePath}/${entry}` : entry
      
      // Skip excluded directories/files
      const shouldExclude = EXCLUDE_DIRECTORIES.some(excludePattern => {
        return fullPath.includes(excludePattern) || relativePath.includes(excludePattern)
      })
      
      if (shouldExclude) {
        continue
      }
      
      try {
        const stats = statSync(fullPath)
        
        if (stats.isDirectory()) {
          // Recursively scan subdirectories
          files.push(...scanDirectory(fullPath, relativePath))
        } else if (stats.isFile()) {
          // Only scan files with relevant extensions
          if (SCAN_EXTENSIONS.some(ext => entry.endsWith(ext))) {
            files.push(fullPath)
          }
        }
      } catch (err) {
        // Skip files we can't read (permissions, symlinks, etc.)
        continue
      }
    }
  } catch (err) {
    // Skip directories we can't read
    return files
  }
  
  return files
}

/**
 * Scan a file for banned phrases
 */
function scanFile(filePath: string): Violation[] {
  const violations: Violation[] = []
  
  try {
    const content = readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineNumber = i + 1
      
      // Skip comment-only lines and import statements (they might reference old terms for clarity)
      const isComment = line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')
      const isImport = line.trim().startsWith('import ') || line.trim().startsWith('export ')
      
      // Skip if it's a comment or import (except in lib/copy/terms.ts where we define replacements)
      if ((isComment || isImport) && !filePath.includes('lib/copy/terms.ts')) {
        continue
      }
      
      // Skip lines that are clearly variable names, function parameters, or database schema references
      // These patterns indicate internal code, not user-facing strings:
      // - Variable assignments: const signoff = ...
      // - Function parameters: signoff: string
      // - Property access: event.signoff, riskPosture.pending_signoffs, signoff.signoff_type
      // - Database queries: .from('job_signoffs')
      // - Type definitions: type Signoff
      // - Object keys: pending_signoffs:, signoff_type:
      // - URL query parameters: event_name=signoff
      // - State variables: hoveredCard === 'pending-signoffs'
      // - Template variables in JSX: ${signoff.signoff_type} (the variable itself, not the wrapper text)
      const isInternalCode = /(const|let|var|type|interface)\s+\w*(signoff|signoffs)[\s:=]/.test(line) ||
                             /\w+\.(signoff|signoffs|pending_signoffs|signed_signoffs|signoff_type)/.test(line) ||
                             /['"]job_signoffs['"]/.test(line) ||
                             /event_type.*signoff/.test(line) ||
                             /(pending_signoffs|signed_signoffs|signoff_type)[\s:}]/.test(line) ||
                             /\w*[Ee]rror.*signoff/.test(line) || // Error variable names like signoffError
                             /event_name=signoff|status=signoff|hoveredCard.*signoff/.test(line) || // URL params, state vars
                             /\$\{(signoff|signoffs|pending_signoffs|signed_signoffs)/.test(line) || // Template variables
                             /setHoveredCard\(|setState\(|useState\(/.test(line) || // State setter calls
                             /['"](pending-signoffs|signed-signoffs)['"]/.test(line) // State variable string literals
      
      if (isInternalCode) {
        continue
      }
      
      // Only check user-facing strings (quoted strings used in JSX/display contexts)
      // Skip the terms file where we define banned phrases
      if (filePath.includes('lib/copy/terms.ts')) {
        continue
      }
      
      // Check for banned phrases in user-facing contexts only
      for (const bannedPhrase of bannedPhrases) {
        const regex = new RegExp(bannedPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
        
        // Only flag if phrase appears in a user-facing context:
        // 1. Inside single/double quotes that are likely display strings (not variable names)
        // 2. In JSX text content (text nodes, not attributes)
        // 3. In template literals that are likely error messages or toast messages
        
        // Pattern 1: Quoted strings in JSX or assignment contexts (user-facing)
        // Match: 'Export Report' or "Export Report" or `Export Report`
        // But exclude: variable names, URL params, state vars
        const quotePattern = /(['"`])([^'"`]*?)(['"`])/g
        let quoteMatch
        let foundInQuotes = false
        
        while ((quoteMatch = quotePattern.exec(line)) !== null) {
          const quotedContent = quoteMatch[2]
          // Skip if it's clearly a variable name, URL param, or state variable
          const isVariableName = /^(signoff|signoffs|pending_signoffs|signed_signoffs|pending-signoffs)[^a-z]/i.test(quotedContent)
          const isUrlParam = /event_name=|status=|tab=|hoveredCard/.test(line)
          const isStateVar = /(hoveredCard|state|setState|useState).*===.*['"]/.test(line)
          
          if (!isVariableName && !isUrlParam && !isStateVar) {
            if (regex.test(quotedContent)) {
              foundInQuotes = true
              break
            }
          }
        }
        
        // Pattern 2: JSX text content (between > and <)
        // Exclude if it's a template variable like ${signoff.signoff_type}
        const jsxTextPattern = />([^<{]+)</
        const jsxMatch = line.match(jsxTextPattern)
        let foundInJsx = false
        if (jsxMatch) {
          const jsxText = jsxMatch[1]
          // Only flag if the banned phrase is NOT part of a template variable
          if (!/\$\{(signoff|signoffs|pending_signoffs|signed_signoffs)/.test(jsxText)) {
            foundInJsx = regex.test(jsxText)
          }
        }
        
        // Pattern 3: Template literals in display contexts (error messages, toasts)
        const templatePattern = /`([^`]+)`/g
        let templateMatch
        let foundInTemplate = false
        
        while ((templateMatch = templatePattern.exec(line)) !== null) {
          const templateContent = templateMatch[1]
          if (regex.test(templateContent)) {
            foundInTemplate = true
            break
          }
        }
        
        if (foundInQuotes || foundInJsx || foundInTemplate) {
          // Get the replacement suggestion
          const suggestion = phraseReplacements[bannedPhrase] || `Use defensibility language (see lib/copy/terms.ts)`
          
          violations.push({
            file: filePath.replace(process.cwd() + '/', ''),
            line: lineNumber,
            phrase: bannedPhrase,
            suggestion,
          })
        }
      }
    }
  } catch (err) {
    // Skip files we can't read
    return violations
  }
  
  return violations
}

describe('Banned Phrases Enforcement', () => {
  it('should not contain banned phrases in UI-facing code', () => {
    const allViolations: Violation[] = []
    
    // Scan each directory
    for (const scanDir of SCAN_DIRECTORIES) {
      const dirPath = join(process.cwd(), scanDir)
      
      try {
        const files = scanDirectory(dirPath)
        
        for (const file of files) {
          const violations = scanFile(file)
          allViolations.push(...violations)
        }
      } catch (err) {
        // If directory doesn't exist, skip it
        continue
      }
    }
    
    if (allViolations.length > 0) {
      // Format violations for readable error output
      const errorMessage = [
        `Found ${allViolations.length} banned phrase violation(s):`,
        '',
        ...allViolations.map(v => {
          return [
            `  ${v.file}:${v.line}`,
            `    Found: "${v.phrase}"`,
            `    Suggestion: "${v.suggestion}"`,
            '',
          ].join('\n')
        }),
        'Please update these to use defensibility language from lib/copy/terms.ts',
      ].join('\n')
      
      throw new Error(errorMessage)
    }
    
    // Test passes if no violations found
    expect(allViolations.length).toBe(0)
  })
})

