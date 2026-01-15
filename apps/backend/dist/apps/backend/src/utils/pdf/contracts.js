"use strict";
/**
 * Formal PDF Generation Contracts
 * Defines inputs, business rules, and outputs for each proof pack PDF
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateLedgerExportInput = validateLedgerExportInput;
exports.validateControlsInput = validateControlsInput;
exports.validateAttestationsInput = validateAttestationsInput;
exports.validateEvidenceIndexInput = validateEvidenceIndexInput;
// ============================================================================
// CONTRACT VALIDATION
// ============================================================================
function validateLedgerExportInput(input) {
    const errors = [];
    if (!input.ledgerEvents || !Array.isArray(input.ledgerEvents)) {
        errors.push('ledgerEvents must be an array');
    }
    if (!input.packMetadata?.packId) {
        errors.push('packMetadata.packId is required');
    }
    return { valid: errors.length === 0, errors };
}
function validateControlsInput(input) {
    const errors = [];
    if (!input.controls || !Array.isArray(input.controls)) {
        errors.push('controls must be an array');
    }
    if (!input.packMetadata?.packId) {
        errors.push('packMetadata.packId is required');
    }
    return { valid: errors.length === 0, errors };
}
function validateAttestationsInput(input) {
    const errors = [];
    if (!input.attestations || !Array.isArray(input.attestations)) {
        errors.push('attestations must be an array');
    }
    if (!input.packMetadata?.packId) {
        errors.push('packMetadata.packId is required');
    }
    return { valid: errors.length === 0, errors };
}
function validateEvidenceIndexInput(input) {
    const errors = [];
    if (!input.payloadFiles || !Array.isArray(input.payloadFiles)) {
        errors.push('payloadFiles must be an array');
    }
    if (!input.packMetadata?.packId) {
        errors.push('packMetadata.packId is required');
    }
    return { valid: errors.length === 0, errors };
}
//# sourceMappingURL=contracts.js.map