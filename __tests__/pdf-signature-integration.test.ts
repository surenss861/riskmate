/**
 * PDF Signature Integration Tests
 * End-to-end tests for signature rendering in actual PDFs
 */

import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import fs from 'fs';
import path from 'path';

describe('PDF Signature Integration', () => {
  const outputDir = path.join(__dirname, '../test-output');

  beforeAll(() => {
    // Create output directory for test PDFs
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  });

  it('should generate a complete PDF with multiple signatures', async () => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
    const outputPath = path.join(outputDir, 'signature-test-complete.pdf');
    const writeStream = fs.createWriteStream(outputPath);
    
    doc.pipe(writeStream);

    // Add header
    doc
      .fontSize(24)
      .font('Helvetica-Bold')
      .text('Test Report with Signatures', { align: 'center' });
    
    doc.moveDown(2);

    // Add some content
    doc
      .fontSize(12)
      .font('Helvetica')
      .text('This is a test report demonstrating signature rendering in PDFs.');
    
    doc.moveDown(2);

    // Add signatures section
    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .text('Signatures & Compliance');
    
    doc.moveDown(1);

    // Mock signatures from different sources
    const signatures = [
      {
        signer_name: 'John Doe',
        signer_title: 'Site Manager',
        signature_role: 'prepared_by',
        signature_svg: '<svg viewBox="0 0 400 100"><path d="M10 50 Q50 10 90 50 T170 50"/></svg>',
        signed_at: new Date().toISOString(),
        signature_hash: 'a1b2c3d4e5f6...',
      },
      {
        signer_name: 'Jane Smith',
        signer_title: 'Safety Officer',
        signature_role: 'reviewed_by',
        signature_svg: '<svg viewBox="0 0 400 100"><polyline points="10,50 30,30 50,50 70,30 90,50 110,30 130,50"/></svg>',
        signed_at: new Date().toISOString(),
        signature_hash: 'f6e5d4c3b2a1...',
      },
    ];

    const startY = doc.y;
    const boxWidth = 250;
    const boxHeight = 100;
    const spacing = 20;

    signatures.forEach((sig, index) => {
      const boxY = startY + index * (boxHeight + spacing);
      const boxX = 50;

      // Draw signature box
      doc
        .rect(boxX, boxY, boxWidth, boxHeight)
        .stroke('#cccccc');

      // Add signer info
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(sig.signature_role.replace('_', ' ').toUpperCase(), boxX + 10, boxY + 10);
      
      doc
        .fontSize(12)
        .font('Helvetica')
        .text(sig.signer_name, boxX + 10, boxY + 25)
        .text(sig.signer_title, boxX + 10, boxY + 40);

      // Render signature SVG
      const extractAllPathDs = (svg: string): string[] => {
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
      };

      const getViewBox = (svg: string): { w: number; h: number } | null => {
        const match = svg.match(/viewBox\s*=\s*["']?\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)["']?/i);
        if (!match) return null;
        const w = parseFloat(match[1]);
        const h = parseFloat(match[2]);
        return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? { w, h } : null;
      };

      const paths = extractAllPathDs(sig.signature_svg);
      const viewBox = getViewBox(sig.signature_svg);
      
      if (paths.length > 0) {
        const srcW = viewBox?.w ?? 400;
        const srcH = viewBox?.h ?? 100;
        const pathBoxX = boxX + 10;
        const pathBoxY = boxY + 55;
        const pathBoxW = boxWidth - 20;
        const pathBoxH = 25;
        
        const pad = 2;
        const scaleX = (pathBoxW - pad * 2) / srcW;
        const scaleY = (pathBoxH - pad * 2) / srcH;
        const scale = Math.min(scaleX, scaleY, 1.2);
        const offsetX = pathBoxX + pad + (pathBoxW - pad * 2 - srcW * scale) / 2;
        const offsetY = pathBoxY + pad + (pathBoxH - pad * 2 - srcH * scale) / 2;

        doc.save();
        doc.translate(offsetX, offsetY);
        doc.scale(scale);
        doc.strokeColor('#000000').lineWidth(1);
        
        for (const pathD of paths) {
          try {
            doc.path(pathD).stroke();
          } catch (e) {
            // Skip malformed paths
          }
        }
        
        doc.restore();
      }

      // Add timestamp and hash
      doc
        .fontSize(8)
        .font('Helvetica')
        .text(`Signed: ${new Date(sig.signed_at).toLocaleDateString()}`, boxX + 10, boxY + 82)
        .text(`Hash: ${sig.signature_hash}`, boxX + 10, boxY + 91);
    });

    doc.end();

    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    // Verify the PDF was created and has content
    const stats = fs.statSync(outputPath);
    expect(stats.size).toBeGreaterThan(1000); // PDF should be at least 1KB
    
    // Read the PDF and verify it's valid
    const pdfBuffer = fs.readFileSync(outputPath);
    expect(pdfBuffer.toString('utf-8', 0, 5)).toBe('%PDF-');
    
    console.log(`✓ Test PDF generated: ${outputPath}`);
    console.log(`  Size: ${(stats.size / 1024).toFixed(2)} KB`);
  });

  it('should handle signatures with different SVG formats', async () => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
    const outputPath = path.join(outputDir, 'signature-test-formats.pdf');
    const writeStream = fs.createWriteStream(outputPath);
    
    doc.pipe(writeStream);

    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .text('Signature Format Test', { align: 'center' });
    
    doc.moveDown(2);

    const testCases = [
      {
        name: 'Simple Path',
        svg: '<svg viewBox="0 0 400 100"><path d="M10 50 L390 50"/></svg>',
      },
      {
        name: 'Quadratic Bezier',
        svg: '<svg viewBox="0 0 400 100"><path d="M10 50 Q100 10 200 50 T390 50"/></svg>',
      },
      {
        name: 'Cubic Bezier',
        svg: '<svg viewBox="0 0 400 100"><path d="M10 50 C50 10 100 90 150 50 S250 10 300 50"/></svg>',
      },
      {
        name: 'Polyline',
        svg: '<svg viewBox="0 0 400 100"><polyline points="10,50 50,30 100,70 150,30 200,70 250,30 300,70 350,50"/></svg>',
      },
      {
        name: 'Multi-Stroke',
        svg: '<svg viewBox="0 0 400 100"><path d="M10 30 L100 30"/><path d="M10 50 L100 50"/><path d="M10 70 L100 70"/></svg>',
      },
    ];

    testCases.forEach((testCase, index) => {
      const y = doc.y + (index > 0 ? 20 : 0);
      
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(testCase.name, 50, y);
      
      // Extract and render signature
      const extractAllPathDs = (svg: string): string[] => {
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
      };

      const paths = extractAllPathDs(testCase.svg);
      
      if (paths.length > 0) {
        doc.save();
        doc.translate(200, y - 5);
        doc.scale(0.5);
        doc.strokeColor('#000000').lineWidth(2);
        
        for (const pathD of paths) {
          try {
            doc.path(pathD).stroke();
          } catch (e) {
            // Skip malformed paths
          }
        }
        
        doc.restore();
      }
      
      doc.y = y + 30;
    });

    doc.end();

    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    const stats = fs.statSync(outputPath);
    expect(stats.size).toBeGreaterThan(1000);
    
    console.log(`✓ Format test PDF generated: ${outputPath}`);
    console.log(`  Size: ${(stats.size / 1024).toFixed(2)} KB`);
  });

  afterAll(() => {
    // Optional: Clean up test output files
    // Uncomment if you want to remove test files after tests
    // if (fs.existsSync(outputDir)) {
    //   fs.rmSync(outputDir, { recursive: true, force: true });
    // }
  });
});
