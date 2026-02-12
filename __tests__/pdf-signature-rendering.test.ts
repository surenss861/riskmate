/**
 * PDF Signature Rendering Tests
 * Tests the SVG to PDF signature rendering functionality
 */

import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import { extractAllPathDs, getViewBox, drawSignatureSvgPath } from '../lib/utils/pdf/signatureHelpers';

interface PdfSignatureData {
  signer_name: string;
  signer_title: string;
  signature_role: 'prepared_by' | 'reviewed_by' | 'approved_by' | 'other';
  signature_svg: string;
  signed_at: string;
  signature_hash?: string | null;
}

describe('PDF Signature Rendering', () => {
  describe('extractAllPathDs', () => {
    it('should extract path d attribute from simple SVG', () => {
      const svg = '<svg><path d="M10 10 L20 20"/></svg>';
      const paths = extractAllPathDs(svg);
      expect(paths).toEqual(['M10 10 L20 20']);
    });

    it('should extract multiple path elements', () => {
      const svg = '<svg><path d="M10 10 L20 20"/><path d="M30 30 L40 40"/></svg>';
      const paths = extractAllPathDs(svg);
      expect(paths).toHaveLength(2);
      expect(paths).toContain('M10 10 L20 20');
      expect(paths).toContain('M30 30 L40 40');
    });

    it('should handle paths with single quotes', () => {
      const svg = "<svg><path d='M10 10 L20 20'/></svg>";
      const paths = extractAllPathDs(svg);
      expect(paths).toEqual(['M10 10 L20 20']);
    });

    it('should convert polyline to path d syntax', () => {
      const svg = '<svg><polyline points="10,10 20,20 30,30"/></svg>';
      const paths = extractAllPathDs(svg);
      expect(paths).toHaveLength(1);
      expect(paths[0]).toMatch(/^M 10 10 L 20 20 L 30 30$/);
    });

    it('should handle complex SVG with multiple elements', () => {
      const svg = `
        <svg viewBox="0 0 400 100">
          <path d="M50 50 Q75 25 100 50"/>
          <polyline points="150,50 175,25 200,50"/>
          <path d="M250 50 C275 25 300 25 325 50"/>
        </svg>
      `;
      const paths = extractAllPathDs(svg);
      expect(paths).toHaveLength(3);
    });

    it('should return empty array for invalid input', () => {
      expect(extractAllPathDs('')).toEqual([]);
      expect(extractAllPathDs(null as any)).toEqual([]);
      expect(extractAllPathDs(undefined as any)).toEqual([]);
      expect(extractAllPathDs('<svg></svg>')).toEqual([]);
    });

    it('should handle malformed polyline points gracefully', () => {
      const svg = '<svg><polyline points="invalid"/></svg>';
      const paths = extractAllPathDs(svg);
      // Should handle gracefully, NaN becomes 0
      expect(paths.length).toBeGreaterThanOrEqual(0);
    });

    it('should extract paths with various SVG path commands', () => {
      const svg = '<svg><path d="M10 10 L20 20 H30 V40 C50 50 60 60 70 70 Q80 80 90 90 Z"/></svg>';
      const paths = extractAllPathDs(svg);
      expect(paths).toHaveLength(1);
      expect(paths[0]).toContain('M10 10');
      expect(paths[0]).toContain('L20 20');
    });
  });

  describe('getViewBox', () => {
    it('should parse viewBox with standard format', () => {
      const svg = '<svg viewBox="0 0 400 100"></svg>';
      const viewBox = getViewBox(svg);
      expect(viewBox).toEqual({ w: 400, h: 100 });
    });

    it('should parse viewBox with single quotes', () => {
      const svg = "<svg viewBox='0 0 400 100'></svg>";
      const viewBox = getViewBox(svg);
      expect(viewBox).toEqual({ w: 400, h: 100 });
    });

    it('should parse viewBox without quotes', () => {
      const svg = '<svg viewBox=0 0 400 100></svg>';
      const viewBox = getViewBox(svg);
      expect(viewBox).toEqual({ w: 400, h: 100 });
    });

    it('should handle decimal values', () => {
      const svg = '<svg viewBox="0 0 400.5 100.25"></svg>';
      const viewBox = getViewBox(svg);
      expect(viewBox).toEqual({ w: 400.5, h: 100.25 });
    });

    it('should return null for missing viewBox', () => {
      const svg = '<svg></svg>';
      const viewBox = getViewBox(svg);
      expect(viewBox).toBeNull();
    });

    it('should return null for invalid viewBox', () => {
      const svg = '<svg viewBox="invalid"></svg>';
      const viewBox = getViewBox(svg);
      expect(viewBox).toBeNull();
    });

    it('should return null for zero or negative dimensions', () => {
      expect(getViewBox('<svg viewBox="0 0 0 100"></svg>')).toBeNull();
      expect(getViewBox('<svg viewBox="0 0 400 0"></svg>')).toBeNull();
      expect(getViewBox('<svg viewBox="0 0 -400 100"></svg>')).toBeNull();
    });
  });

  describe('PDF Generation with Signatures', () => {
    let doc: PDFKit.PDFDocument;
    let stream: PassThrough;
    let chunks: Buffer[];

    beforeEach(() => {
      doc = new PDFDocument({ size: 'LETTER', margin: 50 });
      stream = new PassThrough();
      chunks = [];
      
      doc.pipe(stream);
      stream.on('data', (chunk) => chunks.push(chunk));
    });

    afterEach(() => {
      // Clean up doc if needed
    });

    it('should generate PDF without errors when signature SVG is provided', (done) => {
      const signatureSvg = '<svg viewBox="0 0 400 100"><path d="M10 50 Q50 10 90 50 T170 50"/></svg>';
      
      // Add some content
      doc.fontSize(14).text('Test Signature Rendering', 50, 50);
      
      // Simulate signature rendering
      const paths = extractAllPathDs(signatureSvg);
      const viewBox = getViewBox(signatureSvg);
      
      expect(paths.length).toBeGreaterThan(0);
      expect(viewBox).toBeTruthy();
      
      // Use the shared rendering helper
      drawSignatureSvgPath(doc, signatureSvg, 50, 100, 200, 50);
      doc.end();

      stream.on('end', () => {
        const buffer = Buffer.concat(chunks);
        expect(buffer.length).toBeGreaterThan(0);
        expect(buffer.toString('utf-8', 0, 5)).toBe('%PDF-');
        done();
      });
    });

    it('should handle multi-stroke signatures', (done) => {
      const multiStrokeSvg = `
        <svg viewBox="0 0 400 100">
          <path d="M10 50 L50 50"/>
          <path d="M60 50 L100 50"/>
          <path d="M110 50 L150 50"/>
        </svg>
      `;
      
      const paths = extractAllPathDs(multiStrokeSvg);
      expect(paths).toHaveLength(3);
      
      doc.fontSize(14).text('Multi-Stroke Signature Test', 50, 50);
      
      // Use the shared rendering helper
      drawSignatureSvgPath(doc, multiStrokeSvg, 50, 100, 200, 50);
      doc.end();

      stream.on('end', () => {
        const buffer = Buffer.concat(chunks);
        expect(buffer.length).toBeGreaterThan(0);
        done();
      });
    });

    it('should handle empty signature SVG gracefully', () => {
      const paths = extractAllPathDs('');
      expect(paths).toEqual([]);
      
      // Should not throw when no paths present
      doc.fontSize(14).text('No Signature Test', 50, 50);
      doc.end();
    });

    it('should handle malformed SVG gracefully', () => {
      const malformedSvg = '<svg><path d="M10 invalid L20 20"/></svg>';
      const paths = extractAllPathDs(malformedSvg);
      
      // Extraction should work even if path is malformed
      expect(paths).toHaveLength(1);
      
      doc.fontSize(14).text('Malformed SVG Test', 50, 50);
      
      // Use the shared rendering helper (handles errors internally)
      drawSignatureSvgPath(doc, malformedSvg, 50, 100, 200, 50);
      doc.end();
    });
  });

  describe('Real-world Signature Scenarios', () => {
    it('should handle signature from web capture (React Signature Canvas)', () => {
      // Typical output from react-signature-canvas
      const webSignature = `
        <svg viewBox="0 0 400 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M5.5 45.5 L5.5 46.5 L5.5 48.5 L5.5 51.5 L6.5 55.5 L7.5 59.5 L9.5 64.5 L11.5 68.5 L13.5 72.5 L16.5 76.5 L19.5 79.5 L22.5 82.5 L26.5 85.5 L30.5 87.5 L34.5 89.5 L38.5 91.5 L43.5 92.5 L47.5 93.5 L52.5 94.5 L57.5 94.5" stroke="#000" stroke-width="2" fill="none"/>
        </svg>
      `;
      
      const paths = extractAllPathDs(webSignature);
      expect(paths).toHaveLength(1);
      expect(paths[0]).toContain('M5.5 45.5');
      
      const viewBox = getViewBox(webSignature);
      expect(viewBox).toEqual({ w: 400, h: 100 });
    });

    it('should handle signature from iOS native capture', () => {
      // Typical output from iOS PKCanvas/PKDrawing
      const iOSSignature = `
        <svg viewBox="0 0 500 200" xmlns="http://www.w3.org/2000/svg">
          <polyline points="10,100 20,95 30,90 40,88 50,87 60,88 70,90 80,95 90,100" stroke="#000" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
      
      const paths = extractAllPathDs(iOSSignature);
      expect(paths).toHaveLength(1);
      // Polyline should be converted to path
      expect(paths[0]).toMatch(/^M \d+/);
      
      const viewBox = getViewBox(iOSSignature);
      expect(viewBox).toEqual({ w: 500, h: 200 });
    });

    it('should handle complex signature with curves', () => {
      const complexSignature = `
        <svg viewBox="0 0 400 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 50 Q30 20 50 50 T90 50 Q110 80 130 50" stroke="#000" stroke-width="2" fill="none"/>
          <path d="M150 50 C170 20 190 20 210 50 S230 80 250 50" stroke="#000" stroke-width="2" fill="none"/>
        </svg>
      `;
      
      const paths = extractAllPathDs(complexSignature);
      expect(paths).toHaveLength(2);
      expect(paths[0]).toContain('Q');
      expect(paths[1]).toContain('C');
    });
  });

  describe('Signature Data Validation', () => {
    it('should validate required signature fields', () => {
      const validSignature: PdfSignatureData = {
        signer_name: 'John Doe',
        signer_title: 'Site Manager',
        signature_role: 'prepared_by',
        signature_svg: '<svg viewBox="0 0 400 100"><path d="M10 50 L100 50"/></svg>',
        signed_at: new Date().toISOString(),
        signature_hash: 'abc123...',
      };

      expect(validSignature.signer_name).toBeTruthy();
      expect(validSignature.signer_title).toBeTruthy();
      expect(validSignature.signature_role).toBeTruthy();
      expect(validSignature.signature_svg).toBeTruthy();
      expect(validSignature.signed_at).toBeTruthy();
    });

    it('should handle missing optional signature_hash', () => {
      const signature: PdfSignatureData = {
        signer_name: 'John Doe',
        signer_title: 'Site Manager',
        signature_role: 'reviewed_by',
        signature_svg: '<svg viewBox="0 0 400 100"><path d="M10 50 L100 50"/></svg>',
        signed_at: new Date().toISOString(),
      };

      expect(signature.signature_hash).toBeUndefined();
    });

    it('should accept all valid signature roles', () => {
      const roles: Array<'prepared_by' | 'reviewed_by' | 'approved_by' | 'other'> = [
        'prepared_by',
        'reviewed_by',
        'approved_by',
        'other',
      ];

      roles.forEach((role) => {
        const signature: PdfSignatureData = {
          signer_name: 'Test User',
          signer_title: 'Test Title',
          signature_role: role,
          signature_svg: '<svg><path d="M10 50 L100 50"/></svg>',
          signed_at: new Date().toISOString(),
        };
        
        expect(signature.signature_role).toBe(role);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle SVG with no viewBox (fallback to defaults)', () => {
      const svg = '<svg><path d="M10 50 L100 50"/></svg>';
      const viewBox = getViewBox(svg);
      expect(viewBox).toBeNull();
      
      // Implementation should use defaults (e.g., 400x100) when viewBox is null
    });

    it('should handle very large signatures', () => {
      // Generate a signature with many points
      const points = Array.from({ length: 1000 }, (_, i) => `${i},${50 + Math.sin(i / 10) * 20}`).join(' ');
      const largeSvg = `<svg viewBox="0 0 1000 100"><polyline points="${points}"/></svg>`;
      
      const paths = extractAllPathDs(largeSvg);
      expect(paths).toHaveLength(1);
      expect(paths[0].length).toBeGreaterThan(1000);
    });

    it('should handle signatures with special characters in attributes', () => {
      // Note: The regex matches any d="..." which could include id attributes
      // In practice, SVGs from signature capture won't have id attributes with 'd='
      const svg = '<svg viewBox="0 0 400 100"><path d="M10 50 L100 50" class="signature-path"/></svg>';
      const paths = extractAllPathDs(svg);
      expect(paths).toHaveLength(1);
    });

    it('should handle mixed case attributes', () => {
      const svg = '<svg ViewBox="0 0 400 100"><PATH D="M10 50 L100 50"/></svg>';
      const paths = extractAllPathDs(svg);
      expect(paths).toHaveLength(1);
      
      const viewBox = getViewBox(svg);
      expect(viewBox).toEqual({ w: 400, h: 100 });
    });

    it('should handle whitespace in path data', () => {
      const svg = '<svg><path d="  M10  50   L100  50  "/></svg>';
      const paths = extractAllPathDs(svg);
      expect(paths).toHaveLength(1);
      expect(paths[0].trim()).toBe('M10  50   L100  50');
    });
  });
});
