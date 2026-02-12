"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderSignaturesAndCompliance = renderSignaturesAndCompliance;
const styles_1 = require("../styles");
const helpers_1 = require("../helpers");
const utils_1 = require("../utils");
const signatureHelpers_1 = require("../../../../../../lib/utils/pdf/signatureHelpers");
const signatureValidation_1 = require("../../../../../../lib/utils/signatureValidation");
const ROLE_LABELS = {
    prepared_by: 'Prepared By',
    reviewed_by: 'Reviewed By',
    approved_by: 'Approved By',
    other: 'Signature',
};
/** Required roles in display order; placeholders shown for missing roles */
const REQUIRED_ROLES = ['prepared_by', 'reviewed_by', 'approved_by'];
/**
 * Renders Signatures & Compliance section.
 * When signatures array is provided, maps by role and renders each signature's SVG path(s),
 * signer name/title, signed_at, and signature_hash. Placeholders only for missing roles.
 */
function renderSignaturesAndCompliance(doc, pageWidth, pageHeight, margin, safeAddPage, estimatedTotalPages, signatures) {
    safeAddPage(estimatedTotalPages);
    (0, helpers_1.addSectionHeader)(doc, 'Signatures & Compliance');
    doc
        .fillColor(styles_1.STYLES.colors.primaryText)
        .fontSize(styles_1.STYLES.sizes.h3)
        .font(styles_1.STYLES.fonts.header)
        .text('Crew Signatures', { align: 'left' });
    doc.moveDown(0.5);
    const sigBoxY = doc.y;
    const sigBoxHeight = 100;
    const sigBoxWidth = (pageWidth - margin * 2 - 20) / 2;
    const sigSpacing = 20;
    let currentPageStartY = sigBoxY;
    let rowOnCurrentPage = 0;
    // Map signatures by role; use fixed slots for required roles, placeholders for missing
    const signaturesByRole = new Map();
    if (signatures?.length) {
        for (const s of signatures) {
            if (s?.signature_role)
                signaturesByRole.set(s.signature_role, s);
        }
    }
    const slots = REQUIRED_ROLES.map((role) => ({ role, sig: signaturesByRole.get(role) }));
    // Append any signatures with role='other' (or additional signatures per role)
    if (signatures?.length) {
        for (const s of signatures) {
            if (s?.signature_role === 'other') {
                slots.push({ role: 'other', sig: s });
            }
        }
    }
    const count = Math.max(slots.length, 4);
    for (let i = 0; i < count; i++) {
        const slot = slots[i];
        const sig = slot?.sig;
        const role = slot?.role ?? 'other';
        const col = i % 2;
        const sigY = currentPageStartY + rowOnCurrentPage * (sigBoxHeight + sigSpacing);
        const sigX = margin + col * (sigBoxWidth + sigSpacing);
        const drawBox = (x, y) => {
            doc
                .rect(x, y, sigBoxWidth, sigBoxHeight)
                .fill(styles_1.STYLES.colors.sectionBg)
                .stroke(styles_1.STYLES.colors.borderGray)
                .lineWidth(1.5);
            doc
                .strokeColor(styles_1.STYLES.colors.secondaryText)
                .lineWidth(1)
                .dash(3, { space: 2 })
                .moveTo(x + 15, y + 20)
                .lineTo(x + sigBoxWidth - 15, y + 20)
                .stroke()
                .undash();
            if (sig) {
                const roleLabel = ROLE_LABELS[role] ?? role;
                const dateStr = (0, utils_1.formatDate)(sig.signed_at);
                const hashStr = sig.signature_hash
                    ? `${sig.signature_hash.substring(0, 12)}…${sig.signature_hash.substring(sig.signature_hash.length - 8)}`
                    : '';
                doc
                    .fillColor(styles_1.STYLES.colors.secondaryText)
                    .fontSize(styles_1.STYLES.sizes.caption)
                    .font(styles_1.STYLES.fonts.light)
                    .text(roleLabel, x + 15, y + 25);
                doc
                    .fillColor(styles_1.STYLES.colors.primaryText)
                    .fontSize(styles_1.STYLES.sizes.body)
                    .font(styles_1.STYLES.fonts.body)
                    .text(sig.signer_name, x + 15, y + 40, { width: sigBoxWidth - 30 })
                    .text(sig.signer_title, x + 15, y + 54, { width: sigBoxWidth - 30 });
                // Render actual signature SVG path(s) in place of placeholder
                if (sig.signature_svg) {
                    // Validate signature before rendering
                    const validation = (0, signatureValidation_1.validateSignatureSvg)(sig.signature_svg);
                    if (validation.valid) {
                        const pathBoxX = x + 15;
                        const pathBoxY = y + 56;
                        const pathBoxW = sigBoxWidth - 30;
                        const pathBoxH = 22;
                        (0, signatureHelpers_1.drawSignatureSvgPath)(doc, sig.signature_svg, pathBoxX, pathBoxY, pathBoxW, pathBoxH, styles_1.STYLES.colors.primaryText, 1);
                    }
                    // If invalid, signature box is rendered without SVG path (placeholder behavior)
                }
                doc
                    .fillColor(styles_1.STYLES.colors.secondaryText)
                    .fontSize(styles_1.STYLES.sizes.caption)
                    .font(styles_1.STYLES.fonts.light)
                    .text(`Signed: ${dateStr}`, x + 15, y + 80, { width: sigBoxWidth - 30 });
                if (hashStr) {
                    doc
                        .fillColor(styles_1.STYLES.colors.secondaryText)
                        .fontSize(8)
                        .font(styles_1.STYLES.fonts.light)
                        .text(`Hash: ${hashStr}`, x + 15, y + 90, { width: sigBoxWidth - 30 });
                }
            }
            else {
                doc
                    .fillColor(styles_1.STYLES.colors.secondaryText)
                    .fontSize(styles_1.STYLES.sizes.caption)
                    .font(styles_1.STYLES.fonts.light)
                    .text(ROLE_LABELS[role] ?? 'Signature', x + 15, y + 25)
                    .fillColor(styles_1.STYLES.colors.primaryText)
                    .fontSize(styles_1.STYLES.sizes.body)
                    .font(styles_1.STYLES.fonts.body)
                    .text('Printed Name: _________________', x + 15, y + 50, { width: sigBoxWidth - 30 })
                    .text('Crew Role: _________________', x + 15, y + 70, { width: sigBoxWidth - 30 })
                    .fillColor(styles_1.STYLES.colors.secondaryText)
                    .fontSize(styles_1.STYLES.sizes.caption)
                    .font(styles_1.STYLES.fonts.light)
                    .text('Date: _________________', x + 15, y + 85);
            }
        };
        if (sigY + sigBoxHeight > pageHeight - 200) {
            safeAddPage(estimatedTotalPages);
            currentPageStartY = styles_1.STYLES.spacing.sectionTop + 40;
            rowOnCurrentPage = 0;
            const newSigY = currentPageStartY;
            const newSigX = margin + col * (sigBoxWidth + sigSpacing);
            drawBox(newSigX, newSigY);
            doc.y = newSigY + sigBoxHeight;
        }
        else {
            drawBox(sigX, sigY);
            doc.y = sigY + sigBoxHeight;
        }
        if (col === 1) {
            rowOnCurrentPage++;
        }
    }
    doc.y = doc.y + 40;
    const complianceY = doc.y;
    doc
        .fillColor(styles_1.STYLES.colors.primaryText)
        .fontSize(styles_1.STYLES.sizes.h3)
        .font(styles_1.STYLES.fonts.header)
        .text('Compliance Statement', margin, complianceY);
    const complianceText = 'This report was generated through Riskmate and includes all safety, hazard, and control ' +
        'documentation submitted by the assigned crew. All data is timestamped and stored securely. ' +
        'This documentation serves as evidence of compliance with safety protocols and regulatory requirements.';
    doc
        .fillColor(styles_1.STYLES.colors.secondaryText)
        .fontSize(styles_1.STYLES.sizes.body)
        .font(styles_1.STYLES.fonts.light)
        .text(complianceText, margin, complianceY + 24, {
        width: pageWidth - margin * 2,
        lineGap: 4,
    });
}
//# sourceMappingURL=signatures.js.map