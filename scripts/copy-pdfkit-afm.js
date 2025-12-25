// scripts/copy-pdfkit-afm.js
// Copies PDFKit font metric files (.afm) to the Next.js build output
// This is required because PDFKit expects these files to exist at runtime
// in serverless environments like Vercel, but Next.js doesn't bundle them by default

const fs = require('fs');
const path = require('path');

function ensureDir(p) {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
}

function copyDir(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) {
    console.warn(`[pdfkit] Source directory not found: ${srcDir}`);
    return;
  }

  ensureDir(destDir);
  
  let copiedCount = 0;
  const files = fs.readdirSync(srcDir);
  
  for (const file of files) {
    if (!file.endsWith('.afm')) continue;
    
    const srcFile = path.join(srcDir, file);
    const destFile = path.join(destDir, file);
    
    fs.copyFileSync(srcFile, destFile);
    copiedCount++;
  }
  
  if (copiedCount > 0) {
    console.log(`[pdfkit] Copied ${copiedCount} AFM files → ${destDir}`);
  }
}

function main() {
  const projectRoot = process.cwd();
  const srcDir = path.join(projectRoot, 'node_modules', 'pdfkit', 'js', 'data');

  if (!fs.existsSync(srcDir)) {
    console.warn('[pdfkit] Source AFM directory not found:', srcDir);
    console.warn('[pdfkit] Skipping PDFKit font file copy (PDF generation may fail)');
    process.exit(0);
  }

  // PDFKit in Next.js can land in either of these depending on bundling strategy
  // In Vercel serverless, it's typically in .next/server/chunks/data
  const targets = [
    path.join(projectRoot, '.next', 'server', 'chunks', 'data'),
    path.join(projectRoot, '.next', 'server', 'vendor-chunks', 'data'),
    // Also check for standalone output (used in some Next.js configs)
    path.join(projectRoot, '.next', 'standalone', '.next', 'server', 'chunks', 'data'),
  ];

  let anyCopied = false;
  for (const target of targets) {
    // Only try to copy if .next directory exists (after build)
    if (fs.existsSync(path.join(projectRoot, '.next'))) {
      copyDir(srcDir, target);
      anyCopied = true;
    }
  }

  if (!anyCopied && fs.existsSync(path.join(projectRoot, '.next'))) {
    console.warn('[pdfkit] No AFM files copied. Check that PDFKit is installed correctly.');
  } else if (!fs.existsSync(path.join(projectRoot, '.next'))) {
    console.log('[pdfkit] .next directory not found (pre-build), skipping copy');
    console.log('[pdfkit] AFM files will be copied during postbuild after Next.js build completes');
  }
}

main();

