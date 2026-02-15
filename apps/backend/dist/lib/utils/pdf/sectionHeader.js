"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addSectionHeader = addSectionHeader;
const styles_1 = require("./styles");
/**
 * Section header (used during content rendering).
 * Kept in a separate module with no @/ deps so shared sections can be used by backend.
 */
function addSectionHeader(doc, title, prefix) {
    const margin = styles_1.STYLES.spacing.pageMargin;
    doc.y = styles_1.STYLES.spacing.sectionTop;
    const titleText = prefix ? `${prefix} ${title}` : title;
    doc
        .fillColor(styles_1.STYLES.colors.primaryText)
        .fontSize(styles_1.STYLES.sizes.h2)
        .font(styles_1.STYLES.fonts.header)
        .text(titleText, { align: 'left' });
    const underlineY = doc.y - 4;
    doc
        .strokeColor(styles_1.STYLES.colors.accent)
        .lineWidth(2)
        .moveTo(margin, underlineY)
        .lineTo(margin + 100, underlineY)
        .stroke();
    doc
        .strokeColor(styles_1.STYLES.colors.divider)
        .lineWidth(0.5)
        .moveTo(margin, underlineY + 8)
        .lineTo(doc.page.width - margin, underlineY + 8)
        .stroke();
    doc.moveDown(1.5);
}
//# sourceMappingURL=sectionHeader.js.map