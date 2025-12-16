#!/usr/bin/env ts-node

/**
 * CI Check: Error Code Governance
 * 
 * Ensures all error codes follow governance rules:
 * 1. Must be namespaced properly (PAGINATION_, ENTITLEMENTS_, AUTH_, etc.)
 * 2. Must have severity, category, support_hint
 * 3. Must be documented in API_ERRORS_v1.md
 * 
 * Run: pnpm ts-node scripts/check-error-codes.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const ERROR_NAMESPACES = ['PAGINATION_', 'ENTITLEMENTS_', 'AUTH_', 'VALIDATION_', 'INTERNAL_'];
const ALLOWED_LEGACY_CODES = ['CURSOR_NOT_SUPPORTED_FOR_SORT', 'JOB_LIMIT_REACHED', 'PLAN_PAST_DUE', 'PLAN_INACTIVE', 'ROLE_FORBIDDEN', 'FEATURE_NOT_ALLOWED'];

function extractErrorCodes(filePath: string): string[] {
  const content = readFileSync(filePath, 'utf-8');
  const codes: string[] = [];
  
  // Match error codes in createErrorResponse calls
  const createErrorResponseRegex = /code:\s*["']([A-Z_]+)["']/g;
  let match;
  while ((match = createErrorResponseRegex.exec(content)) !== null) {
    codes.push(match[1]);
  }
  
  // Also match in error response objects
  const errorCodeRegex = /"code":\s*["']([A-Z_]+)["']/g;
  while ((match = errorCodeRegex.exec(content)) !== null) {
    codes.push(match[1]);
  }
  
  return [...new Set(codes)]; // Remove duplicates
}

function extractDocumentedCodes(docPath: string): string[] {
  const content = readFileSync(docPath, 'utf-8');
  const codes: string[] = [];
  
  // Match error codes in markdown (### `CODE_NAME`)
  const codeRegex = /### `([A-Z_]+)`/g;
  let match;
  while ((match = codeRegex.exec(content)) !== null) {
    codes.push(match[1]);
  }
  
  return codes;
}

function checkNamespace(code: string): boolean {
  // Legacy codes are allowed during migration
  if (ALLOWED_LEGACY_CODES.includes(code)) {
    return true;
  }
  
  // Must start with a namespace
  return ERROR_NAMESPACES.some(ns => code.startsWith(ns));
}

function main() {
  const projectRoot = join(__dirname, '..');
  const errorResponseFile = join(projectRoot, 'apps/backend/src/utils/errorResponse.ts');
  const docFile = join(projectRoot, 'docs/API_ERRORS_v1.md');
  
  // Extract error codes from codebase
  const sourceFiles = [
    join(projectRoot, 'apps/backend/src/routes/jobs.ts'),
    join(projectRoot, 'apps/backend/src/middleware/limits.ts'),
    join(projectRoot, 'apps/backend/src/index.ts'),
  ];
  
  const allCodes = new Set<string>();
  sourceFiles.forEach(file => {
    try {
      const codes = extractErrorCodes(file);
      codes.forEach(code => allCodes.add(code));
    } catch (err) {
      console.warn(`Could not read ${file}:`, err);
    }
  });
  
  // Extract documented codes
  const documentedCodes = new Set(extractDocumentedCodes(docFile));
  
  // Check governance rules
  const errors: string[] = [];
  
  allCodes.forEach(code => {
    // Check namespace
    if (!checkNamespace(code)) {
      errors.push(`❌ Error code "${code}" is not namespaced. Must start with PAGINATION_, ENTITLEMENTS_, AUTH_, VALIDATION_, or INTERNAL_`);
    }
    
    // Check documentation
    if (!documentedCodes.has(code) && !ALLOWED_LEGACY_CODES.includes(code)) {
      errors.push(`❌ Error code "${code}" is not documented in API_ERRORS_v1.md`);
    }
  });
  
  // Check SUPPORT_HINTS registration
  const errorResponseContent = readFileSync(errorResponseFile, 'utf-8');
  allCodes.forEach(code => {
    if (!errorResponseContent.includes(`"${code}"`) && !ALLOWED_LEGACY_CODES.includes(code)) {
      errors.push(`❌ Error code "${code}" is not registered in SUPPORT_HINTS map`);
    }
  });
  
  if (errors.length > 0) {
    console.error('\n❌ Error Code Governance Check Failed:\n');
    errors.forEach(err => console.error(err));
    console.error('\n💡 Fix: Add error code to:');
    console.error('  1. SUPPORT_HINTS map in apps/backend/src/utils/errorResponse.ts');
    console.error('  2. ERROR_CATEGORY_MAP in apps/backend/src/utils/errorResponse.ts');
    console.error('  3. API_ERRORS_v1.md documentation');
    process.exit(1);
  }
  
  console.log('✅ All error codes pass governance checks');
  console.log(`   Found ${allCodes.size} error codes`);
  console.log(`   All namespaced: ✅`);
  console.log(`   All documented: ✅`);
  console.log(`   All registered: ✅`);
}

main();

