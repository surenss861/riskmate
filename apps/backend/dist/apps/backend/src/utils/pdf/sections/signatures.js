"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderSignaturesAndCompliance = renderSignaturesAndCompliance;
const styles_1 = require("../styles");
const helpers_1 = require("../helpers");
function renderSignaturesAndCompliance(doc, pageWidth, pageHeight, margin, safeAddPage, estimatedTotalPages) {
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
    for (let i = 0; i < 4; i++) {
        const row = Math.floor(i / 2);
        const col = i % 2;
        const sigY = sigBoxY + row * (sigBoxHeight + sigSpacing);
        const sigX = margin + col * (sigBoxWidth + sigSpacing);
        if (sigY + sigBoxHeight > pageHeight - 200) {
            safeAddPage(estimatedTotalPages);
            const newY = styles_1.STYLES.spacing.sectionTop + 40;
            const adjustedRow = Math.floor(i / 2);
            const adjustedY = newY + adjustedRow * (sigBoxHeight + sigSpacing);
            const adjustedX = margin + col * (sigBoxWidth + sigSpacing);
            doc
                .rect(adjustedX, adjustedY, sigBoxWidth, sigBoxHeight)
                .fill(styles_1.STYLES.colors.sectionBg)
                .stroke(styles_1.STYLES.colors.borderGray)
                .lineWidth(1.5);
            doc
                .strokeColor(styles_1.STYLES.colors.secondaryText)
                .lineWidth(1)
                .dash(3, { space: 2 })
                .moveTo(adjustedX + 15, adjustedY + 20)
                .lineTo(adjustedX + sigBoxWidth - 15, adjustedY + 20)
                .stroke()
                .undash();
            doc
                .fillColor(styles_1.STYLES.colors.secondaryText)
                .fontSize(styles_1.STYLES.sizes.caption)
                .font(styles_1.STYLES.fonts.light)
                .text('Signature', adjustedX + 15, adjustedY + 25)
                .fillColor(styles_1.STYLES.colors.primaryText)
                .fontSize(styles_1.STYLES.sizes.body)
                .font(styles_1.STYLES.fonts.body)
                .text('Printed Name: _________________', adjustedX + 15, adjustedY + 50, {
                width: sigBoxWidth - 30,
            })
                .text('Crew Role: _________________', adjustedX + 15, adjustedY + 70, {
                width: sigBoxWidth - 30,
            })
                .fillColor(styles_1.STYLES.colors.secondaryText)
                .fontSize(styles_1.STYLES.sizes.caption)
                .font(styles_1.STYLES.fonts.light)
                .text('Date: _________________', adjustedX + 15, adjustedY + 85);
        }
        else {
            doc
                .rect(sigX, sigY, sigBoxWidth, sigBoxHeight)
                .fill(styles_1.STYLES.colors.sectionBg)
                .stroke(styles_1.STYLES.colors.borderGray)
                .lineWidth(1.5);
            doc
                .strokeColor(styles_1.STYLES.colors.secondaryText)
                .lineWidth(1)
                .dash(3, { space: 2 })
                .moveTo(sigX + 15, sigY + 20)
                .lineTo(sigX + sigBoxWidth - 15, sigY + 20)
                .stroke()
                .undash();
            doc
                .fillColor(styles_1.STYLES.colors.secondaryText)
                .fontSize(styles_1.STYLES.sizes.caption)
                .font(styles_1.STYLES.fonts.light)
                .text('Signature', sigX + 15, sigY + 25)
                .fillColor(styles_1.STYLES.colors.primaryText)
                .fontSize(styles_1.STYLES.sizes.body)
                .font(styles_1.STYLES.fonts.body)
                .text('Printed Name: _________________', sigX + 15, sigY + 50, {
                width: sigBoxWidth - 30,
            })
                .text('Crew Role: _________________', sigX + 15, sigY + 70, {
                width: sigBoxWidth - 30,
            })
                .fillColor(styles_1.STYLES.colors.secondaryText)
                .fontSize(styles_1.STYLES.sizes.caption)
                .font(styles_1.STYLES.fonts.light)
                .text('Date: _________________', sigX + 15, sigY + 85);
        }
    }
    doc.y = sigBoxY + 2 * (sigBoxHeight + sigSpacing) + 40;
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