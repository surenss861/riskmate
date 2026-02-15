"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderSignaturesAndCompliance = renderSignaturesAndCompliance;
const styles_1 = require("../styles");
const sectionHeader_1 = require("../sectionHeader");
const formatDate_1 = require("../formatDate");
const signatureHelpers_1 = require("../signatureHelpers");
const signatureValidation_1 = require("../../signatureValidation");
const ROLE_LABELS = {
    prepared_by: 'Prepared By',
    reviewed_by: 'Reviewed By',
    approved_by: 'Approved By',
    other: 'Signature',
};
const REQUIRED_ROLES = [
    'prepared_by',
    'reviewed_by',
    'approved_by',
];
/**
 * Signatures & Compliance - shared implementation for web and backend PDF generators.
 * Renders layout, validation, SVG via drawSignatureSvgPath. Callers supply signatures
 * (e.g. from report_signatures for a run). Optional documentId shows "Prepared by Riskmate" / Document ID.
 */
function renderSignaturesAndCompliance(doc, pageWidth, pageHeight, margin, safeAddPage, signatures, options) {
    const addPage = () => {
        if (options?.estimatedTotalPages != null) {
            safeAddPage(options.estimatedTotalPages);
        }
        else {
            safeAddPage();
        }
    };
    addPage();
    (0, sectionHeader_1.addSectionHeader)(doc, 'Signatures & Compliance');
    if (options?.documentId != null) {
        doc
            .fillColor(styles_1.STYLES.colors.secondaryText)
            .fontSize(9)
            .font(styles_1.STYLES.fonts.body)
            .text('Prepared by Riskmate', margin, doc.y)
            .text(`Document ID: ${options.documentId.substring(0, 8).toUpperCase()}`, margin, doc.y + 12);
        doc.moveDown(2);
    }
    doc
        .fillColor(styles_1.STYLES.colors.primaryText)
        .fontSize(14)
        .font(styles_1.STYLES.fonts.header)
        .text('Crew Signatures', { align: 'left' });
    doc.moveDown(0.8);
    const sigBoxY = doc.y;
    const sigBoxHeight = 115;
    const sigBoxWidth = (pageWidth - margin * 2 - 20) / 2;
    const sigSpacing = 20;
    const sigsByRole = new Map();
    for (const sig of signatures) {
        sigsByRole.set(sig.signature_role, sig);
    }
    const slots = [];
    for (const role of REQUIRED_ROLES) {
        const sig = sigsByRole.get(role);
        if (sig)
            slots.push(sig);
        else
            slots.push({ role, placeholder: true });
    }
    for (const sig of signatures) {
        if (sig.signature_role === 'other')
            slots.push(sig);
    }
    const count = slots.length;
    let currentPageStartY = sigBoxY;
    let pageItemIndex = 0;
    for (let i = 0; i < count; i++) {
        const slot = slots[i];
        const sig = 'placeholder' in slot ? undefined : slot;
        const col = pageItemIndex % 2;
        const row = Math.floor(pageItemIndex / 2);
        const sigValidation = sig?.signature_svg ? (0, signatureValidation_1.validateSignatureSvg)(sig.signature_svg) : null;
        const sigY = currentPageStartY + row * (sigBoxHeight + sigSpacing);
        const sigX = margin + col * (sigBoxWidth + sigSpacing);
        const drawBox = (x, y) => {
            let boxFill = styles_1.STYLES.colors.sectionBg;
            let boxStroke = styles_1.STYLES.colors.borderGray;
            if (sigValidation && !sigValidation.valid) {
                boxFill = styles_1.STYLES.colors.accentLight;
                boxStroke = styles_1.STYLES.colors.riskCritical;
            }
            doc
                .rect(x, y, sigBoxWidth, sigBoxHeight)
                .fill(boxFill)
                .strokeColor(boxStroke)
                .lineWidth(1.5)
                .stroke();
            doc
                .strokeColor(styles_1.STYLES.colors.secondaryText)
                .lineWidth(1)
                .dash(3, { space: 2 })
                .moveTo(x + 15, y + 20)
                .lineTo(x + sigBoxWidth - 15, y + 20)
                .stroke()
                .undash();
            if (sig) {
                const roleLabel = ROLE_LABELS[sig.signature_role] ?? sig.signature_role;
                const dateStr = (0, formatDate_1.formatDate)(sig.signed_at);
                const hashStr = sig.signature_hash ?? '';
                const signatureValid = sigValidation?.valid ?? false;
                const signatureInvalid = sigValidation && !sigValidation.valid;
                doc
                    .fillColor(styles_1.STYLES.colors.secondaryText)
                    .fontSize(styles_1.STYLES.sizes.caption)
                    .font(styles_1.STYLES.fonts.light)
                    .text(roleLabel, x + 15, y + 25);
                doc
                    .fillColor(styles_1.STYLES.colors.primaryText)
                    .fontSize(styles_1.STYLES.sizes.body)
                    .font(styles_1.STYLES.fonts.body)
                    .text(sig.signer_name, x + 15, y + 38, { width: sigBoxWidth - 30 })
                    .text(sig.signer_title, x + 15, y + 52, { width: sigBoxWidth - 30 });
                if (sig.signature_svg && signatureValid) {
                    (0, signatureHelpers_1.drawSignatureSvgPath)(doc, sig.signature_svg, x + 15, y + 54, sigBoxWidth - 30, 16, styles_1.STYLES.colors.primaryText, 1);
                }
                if (signatureInvalid) {
                    doc
                        .fillColor(styles_1.STYLES.colors.riskCritical)
                        .fontSize(styles_1.STYLES.sizes.caption)
                        .font(styles_1.STYLES.fonts.body)
                        .text('Signature invalid or unavailable', x + 15, y + 54, { width: sigBoxWidth - 30 });
                }
                else {
                    doc
                        .fillColor(styles_1.STYLES.colors.primaryText)
                        .fontSize(styles_1.STYLES.sizes.body)
                        .font(styles_1.STYLES.fonts.body)
                        .text(`Signed: ${dateStr}`, x + 15, y + 72, { width: sigBoxWidth - 30 });
                    if (hashStr) {
                        doc
                            .fillColor(styles_1.STYLES.colors.secondaryText)
                            .fontSize(7)
                            .font(styles_1.STYLES.fonts.light)
                            .text(`Hash: ${hashStr}`, x + 15, y + 78, { width: sigBoxWidth - 30 });
                    }
                    if (signatureValid) {
                        const afterHashY = hashStr ? doc.y + 4 : y + 78;
                        doc
                            .fillColor(styles_1.STYLES.colors.secondaryText)
                            .fontSize(8)
                            .font(styles_1.STYLES.fonts.light)
                            .text('Signature captured (SVG on file)', x + 15, afterHashY, { width: sigBoxWidth - 30 });
                    }
                }
            }
            else {
                const placeholderSlot = slots[i];
                const roleLabel = 'placeholder' in placeholderSlot && placeholderSlot.role
                    ? ROLE_LABELS[placeholderSlot.role] ?? 'Signature'
                    : 'Signature';
                doc
                    .fillColor(styles_1.STYLES.colors.secondaryText)
                    .fontSize(styles_1.STYLES.sizes.caption)
                    .font(styles_1.STYLES.fonts.light)
                    .text(roleLabel, x + 15, y + 25)
                    .fillColor(styles_1.STYLES.colors.primaryText)
                    .fontSize(styles_1.STYLES.sizes.body)
                    .font(styles_1.STYLES.fonts.body)
                    .text('Printed Name: _________________', x + 15, y + 45, { width: sigBoxWidth - 30 })
                    .text('Crew Role: _________________', x + 15, y + 65, { width: sigBoxWidth - 30 })
                    .fillColor(styles_1.STYLES.colors.secondaryText)
                    .fontSize(styles_1.STYLES.sizes.caption)
                    .font(styles_1.STYLES.fonts.light)
                    .text('Date: _________________', x + 15, y + 80);
            }
        };
        if (sigY + sigBoxHeight > pageHeight - 200) {
            addPage();
            currentPageStartY = styles_1.STYLES.spacing.sectionTop + 40;
            pageItemIndex = 0;
            const newCol = 0;
            const newRow = 0;
            const newSigY = currentPageStartY + newRow * (sigBoxHeight + sigSpacing);
            const newSigX = margin + newCol * (sigBoxWidth + sigSpacing);
            drawBox(newSigX, newSigY);
            doc.y = newSigY + sigBoxHeight;
        }
        else {
            drawBox(sigX, sigY);
            doc.y = sigY + sigBoxHeight;
        }
        pageItemIndex++;
    }
    doc.y = doc.y + 30;
    const complianceText = 'This report was generated through Riskmate and includes all safety, hazard, and control ' +
        'documentation submitted by the assigned crew. All data is timestamped and stored securely. ' +
        'This documentation serves as evidence of compliance with safety protocols and regulatory requirements.';
    doc
        .font(styles_1.STYLES.fonts.body)
        .fontSize(styles_1.STYLES.sizes.body);
    const complianceTextHeight = doc.heightOfString(complianceText, {
        width: pageWidth - margin * 2 - 32,
        lineGap: 4,
    });
    const calloutHeight = complianceTextHeight + 24;
    const headingAndSpacingHeight = 14 * styles_1.STYLES.spacing.lineHeight + 0.8 * 14 * styles_1.STYLES.spacing.lineHeight;
    const padding = 24;
    if (doc.y + headingAndSpacingHeight + calloutHeight + padding > pageHeight - margin) {
        addPage();
        doc.y = margin;
    }
    const complianceY = doc.y;
    doc
        .fillColor(styles_1.STYLES.colors.primaryText)
        .fontSize(14)
        .font(styles_1.STYLES.fonts.header)
        .text('Compliance Statement', margin, complianceY);
    doc.moveDown(0.8);
    const calloutY = doc.y;
    const calloutWidth = pageWidth - margin * 2;
    doc
        .roundedRect(margin, calloutY, calloutWidth, calloutHeight, 6)
        .fill(styles_1.STYLES.colors.lightGrayBg)
        .stroke(styles_1.STYLES.colors.borderGray)
        .lineWidth(1.5);
    doc
        .fillColor(styles_1.STYLES.colors.secondaryText)
        .fontSize(styles_1.STYLES.sizes.body)
        .font(styles_1.STYLES.fonts.body)
        .text(complianceText, margin + 16, calloutY + 12, {
        width: calloutWidth - 32,
        lineGap: 4,
    });
}
//# sourceMappingURL=signatures.js.map