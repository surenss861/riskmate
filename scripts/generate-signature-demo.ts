#!/usr/bin/env ts-node

/**
 * Generate Signature Demo PDFs
 * Creates sample PDFs showcasing signature rendering capabilities
 * 
 * Usage:
 *   npx ts-node scripts/generate-signature-demo.ts
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(__dirname, '../demo-output');

// Sample signatures with different styles
const SAMPLE_SIGNATURES = [
  {
    name: 'Simple Line Signature',
    signer_name: 'John Anderson',
    signer_title: 'Site Manager',
    signature_role: 'prepared_by',
    signature_svg: '<svg viewBox="0 0 400 100"><path d="M10 50 Q50 20 100 50 Q150 80 200 50 Q250 20 300 50 L350 50"/></svg>',
  },
  {
    name: 'Complex Multi-Stroke',
    signer_name: 'Sarah Chen',
    signer_title: 'Safety Officer',
    signature_role: 'reviewed_by',
    signature_svg: `<svg viewBox="0 0 400 100">
      <path d="M10 30 Q30 10 50 30 T90 30"/>
      <path d="M100 30 L140 70"/>
      <path d="M140 30 L100 70"/>
      <path d="M150 50 Q170 30 190 50 T230 50"/>
      <path d="M240 30 L240 70 L280 70 L280 30"/>
      <path d="M290 30 Q310 10 330 30 T370 30"/>
    </svg>`,
  },
  {
    name: 'Polyline Signature',
    signer_name: 'Michael Rodriguez',
    signer_title: 'Project Lead',
    signature_role: 'approved_by',
    signature_svg: '<svg viewBox="0 0 400 100"><polyline points="10,50 30,30 50,60 70,25 90,65 110,30 130,60 150,35 170,55 190,40 210,60 230,35 250,55 270,45"/></svg>',
  },
  {
    name: 'Cursive Style',
    signer_name: 'Emily Watson',
    signer_title: 'Quality Assurance',
    signature_role: 'other',
    signature_svg: '<svg viewBox="0 0 400 100"><path d="M10 70 Q20 30 40 50 Q60 70 80 50 Q100 30 120 50 Q140 70 160 60 Q180 50 200 55 Q220 60 240 50 Q260 40 280 45 Q300 50 320 45 L350 45"/></svg>',
  },
];

// Signature rendering utilities (same as in implementation)
function extractAllPathDs(svg: string): string[] {
  if (!svg || typeof svg !== 'string') return [];
  const result: string[] = [];
  
  const pathRegex = /d\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = pathRegex.exec(svg)) !== null) {
    const d = match[1].trim();
    if (d) result.push(d);
  }
  
  const polylineRegex = /<polyline[^>]*points\s*=\s*["']([^"']+)["']/gi;
  while ((match = polylineRegex.exec(svg)) !== null) {
    const pointsStr = match[1].trim();
    const points = pointsStr.split(/\s+/).map((p) => {
      const [x, y] = p.split(',').map(Number);
      return { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0 };
    });
    if (points.length >= 2) {
      const d = 'M ' + points.map((pt, i) => (i === 0 ? `${pt.x} ${pt.y}` : `L ${pt.x} ${pt.y}`)).join(' ');
      result.push(d);
    }
  }
  
  return result;
}

function getViewBox(svg: string): { w: number; h: number } | null {
  const match = svg.match(/viewBox\s*=\s*["']?\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)["']?/i);
  if (!match) return null;
  const w = parseFloat(match[1]);
  const h = parseFloat(match[2]);
  return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? { w, h } : null;
}

function drawSignatureSvgPath(
  doc: PDFKit.PDFDocument,
  signatureSvg: string,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number
): void {
  const paths = extractAllPathDs(signatureSvg);
  if (paths.length === 0) return;

  const viewBox = getViewBox(signatureSvg);
  const srcW = viewBox?.w ?? 400;
  const srcH = viewBox?.h ?? 100;
  const pad = 2;
  const scaleX = (boxW - pad * 2) / srcW;
  const scaleY = (boxH - pad * 2) / srcH;
  const scale = Math.min(scaleX, scaleY, 1.2);
  const offsetX = boxX + pad + (boxW - pad * 2 - srcW * scale) / 2;
  const offsetY = boxY + pad + (boxH - pad * 2 - srcH * scale) / 2;

  doc.save();
  doc.translate(offsetX, offsetY);
  doc.scale(scale);
  doc.strokeColor('#000000').lineWidth(1);
  
  for (const pathD of paths) {
    try {
      doc.path(pathD).stroke();
    } catch (e) {
      console.warn(`Failed to render path: ${pathD}`);
    }
  }
  
  doc.restore();
}

function generateShowcasePDF() {
  const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
  const outputPath = path.join(OUTPUT_DIR, 'signature-showcase.pdf');
  const writeStream = fs.createWriteStream(outputPath);
  
  doc.pipe(writeStream);

  // Title Page
  doc
    .fontSize(32)
    .font('Helvetica-Bold')
    .text('Signature Rendering Showcase', { align: 'center' });
  
  doc.moveDown(1);
  
  doc
    .fontSize(14)
    .font('Helvetica')
    .text('Demonstrating SVG to PDF signature conversion', { align: 'center' })
    .text('RiskMate Platform', { align: 'center' });
  
  doc.moveDown(2);

  doc
    .fontSize(10)
    .font('Helvetica-Oblique')
    .text('This document showcases different signature styles and their rendering in PDF format.', {
      align: 'center',
      width: 400,
    });

  doc.addPage();

  // Signature Showcase
  doc
    .fontSize(24)
    .font('Helvetica-Bold')
    .text('Signature Examples');
  
  doc.moveDown(1);

  const boxWidth = 450;
  const boxHeight = 120;
  const spacing = 30;

  SAMPLE_SIGNATURES.forEach((sig, index) => {
    if (index > 0 && doc.y + boxHeight + 50 > doc.page.height - 100) {
      doc.addPage();
    }

    const startY = doc.y;

    // Signature type label
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text(sig.name);
    
    doc.moveDown(0.3);

    const boxY = doc.y;
    const boxX = 80;

    // Draw signature box
    doc
      .rect(boxX, boxY, boxWidth, boxHeight)
      .fillAndStroke('#f9f9f9', '#cccccc')
      .lineWidth(1);

    // Role label
    const roleLabel = sig.signature_role.replace(/_/g, ' ').toUpperCase();
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#666666')
      .text(roleLabel, boxX + 15, boxY + 10);

    // Signer info
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text(sig.signer_name, boxX + 15, boxY + 25);
    
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#333333')
      .text(sig.signer_title, boxX + 15, boxY + 42);

    // Signature line
    doc
      .strokeColor('#cccccc')
      .lineWidth(0.5)
      .moveTo(boxX + 15, boxY + 65)
      .lineTo(boxX + boxWidth - 15, boxY + 65)
      .stroke();

    // Render signature
    const sigBoxX = boxX + 15;
    const sigBoxY = boxY + 68;
    const sigBoxW = boxWidth - 30;
    const sigBoxH = 35;

    drawSignatureSvgPath(doc, sig.signature_svg, sigBoxX, sigBoxY, sigBoxW, sigBoxH);

    // Timestamp
    const now = new Date();
    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#666666')
      .text(`Signed: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`, boxX + 15, boxY + 105);

    doc.y = boxY + boxHeight + spacing;
  });

  // Technical Details Page
  doc.addPage();

  doc
    .fontSize(24)
    .font('Helvetica-Bold')
    .fillColor('#000000')
    .text('Technical Details');
  
  doc.moveDown(1);

  const technicalDetails = [
    {
      title: 'SVG Path Extraction',
      description: 'Extracts <path> elements and converts <polyline> elements to path syntax. Supports multiple strokes for complex signatures.',
    },
    {
      title: 'ViewBox Parsing',
      description: 'Parses SVG viewBox attribute for accurate scaling. Falls back to 400×100 default dimensions if viewBox is missing.',
    },
    {
      title: 'Aspect Ratio Preservation',
      description: 'Automatically scales signatures to fit within bounding boxes while maintaining original aspect ratio.',
    },
    {
      title: 'Vector Rendering',
      description: 'Uses PDFKit\'s native .path() method for crisp, resolution-independent signatures that scale perfectly when printed.',
    },
    {
      title: 'Multi-Stroke Support',
      description: 'Handles signatures with multiple strokes, ensuring complex signatures render completely and accurately.',
    },
  ];

  technicalDetails.forEach((detail) => {
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text(detail.title);
    
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#333333')
      .text(detail.description, {
        width: 500,
        lineGap: 3,
      });
    
    doc.moveDown(1.5);
  });

  // Footer
  doc
    .fontSize(8)
    .font('Helvetica-Oblique')
    .fillColor('#999999')
    .text(
      `Generated: ${new Date().toLocaleString()} | RiskMate Platform v1.0`,
      50,
      doc.page.height - 50,
      { align: 'center' }
    );

  doc.end();

  return new Promise<string>((resolve, reject) => {
    writeStream.on('finish', () => resolve(outputPath));
    writeStream.on('error', reject);
  });
}

function generateComparisonPDF() {
  const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
  const outputPath = path.join(OUTPUT_DIR, 'signature-comparison.pdf');
  const writeStream = fs.createWriteStream(outputPath);
  
  doc.pipe(writeStream);

  doc
    .fontSize(28)
    .font('Helvetica-Bold')
    .text('Signature Format Comparison', { align: 'center' });
  
  doc.moveDown(2);

  const formats = [
    {
      name: 'Simple Path',
      svg: '<svg viewBox="0 0 400 100"><path d="M10 50 L390 50"/></svg>',
      description: 'Single straight line using basic path commands',
    },
    {
      name: 'Quadratic Bezier',
      svg: '<svg viewBox="0 0 400 100"><path d="M10 50 Q100 10 200 50 T390 50"/></svg>',
      description: 'Smooth curves using quadratic bezier (Q) and smooth continuation (T)',
    },
    {
      name: 'Cubic Bezier',
      svg: '<svg viewBox="0 0 400 100"><path d="M10 50 C50 10 100 90 150 50 S250 10 300 50"/></svg>',
      description: 'Complex curves using cubic bezier (C) and smooth cubic (S)',
    },
    {
      name: 'Polyline',
      svg: '<svg viewBox="0 0 400 100"><polyline points="10,50 50,30 100,70 150,30 200,70 250,30 300,70 350,50"/></svg>',
      description: 'Multiple connected line segments (automatically converted to path)',
    },
    {
      name: 'Multi-Stroke',
      svg: '<svg viewBox="0 0 400 100"><path d="M10 30 L100 30"/><path d="M10 50 L100 50"/><path d="M10 70 L100 70"/></svg>',
      description: 'Multiple separate paths rendered together',
    },
  ];

  formats.forEach((format, index) => {
    if (index > 0) {
      doc.moveDown(2);
    }

    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text(`${index + 1}. ${format.name}`);
    
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#666666')
      .text(format.description);
    
    doc.moveDown(0.5);

    // Render signature
    const boxY = doc.y;
    const boxX = 80;
    const boxW = 400;
    const boxH = 60;

    doc
      .rect(boxX, boxY, boxW, boxH)
      .stroke('#dddddd')
      .lineWidth(0.5);

    drawSignatureSvgPath(doc, format.svg, boxX, boxY, boxW, boxH);

    doc.y = boxY + boxH + 5;

    // Show SVG code
    doc
      .fontSize(7)
      .font('Courier')
      .fillColor('#666666')
      .text(format.svg, boxX, doc.y, {
        width: boxW,
        lineGap: 1,
      });
    
    doc.moveDown(1);
  });

  doc.end();

  return new Promise<string>((resolve, reject) => {
    writeStream.on('finish', () => resolve(outputPath));
    writeStream.on('error', reject);
  });
}

async function main() {
  console.log('🎨 Generating Signature Demo PDFs...\n');

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  try {
    // Generate showcase PDF
    console.log('📄 Generating showcase PDF...');
    const showcasePath = await generateShowcasePDF();
    const showcaseStats = fs.statSync(showcasePath);
    console.log(`   ✓ Created: ${showcasePath}`);
    console.log(`   Size: ${(showcaseStats.size / 1024).toFixed(2)} KB\n`);

    // Generate comparison PDF
    console.log('📄 Generating comparison PDF...');
    const comparisonPath = await generateComparisonPDF();
    const comparisonStats = fs.statSync(comparisonPath);
    console.log(`   ✓ Created: ${comparisonPath}`);
    console.log(`   Size: ${(comparisonStats.size / 1024).toFixed(2)} KB\n`);

    console.log('✨ Done! Demo PDFs generated successfully.\n');
    console.log('📁 Output directory:', OUTPUT_DIR);
  } catch (error) {
    console.error('❌ Error generating PDFs:', error);
    process.exit(1);
  }
}

main();
