/**
 * Signature SVG validation
 *
 * Validates signature SVG to prevent malicious or oversized inputs.
 */
export interface ValidationResult {
    valid: boolean;
    error?: string;
}
export declare function validateSignatureSvg(svg: string): ValidationResult;
//# sourceMappingURL=signatureValidation.d.ts.map