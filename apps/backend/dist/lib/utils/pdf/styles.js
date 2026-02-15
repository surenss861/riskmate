"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STYLES = void 0;
// ============================================
// GLOBAL STYLING SYSTEM
// Compliance + Clean Branded Deck Hybrid
// ============================================
exports.STYLES = {
    colors: {
        // Text colors (legal/compliance foundation)
        primaryText: '#111111', // Strong black for readability
        secondaryText: '#555555', // Muted gray for secondary info
        borderGray: '#E6E6E6', // Subtle borders
        lightGrayBg: '#FAFAFA', // Zebra striping for tables
        cardBg: '#FFFFFF', // Clean white cards
        sectionBg: '#FFFFFF', // White background
        // Risk colors (restrained)
        riskLow: '#34C759',
        riskMedium: '#FFCC00',
        riskHigh: '#FF6B35', // Orange, not bright red
        riskCritical: '#912F40', // Cordovan (brand accent), not bright red
        // Layout colors
        divider: '#E6E6E6', // Subtle dividers
        accent: '#912F40', // Cordovan - used sparingly for brand accent
        accentLight: '#912F4015', // Light accent for backgrounds
        white: '#FFFFFF',
        black: '#000000',
        watermark: '#E8E8E8', // Very subtle watermark
    },
    fonts: {
        header: 'Helvetica-Bold', // Headings
        body: 'Helvetica', // Body text
        medium: 'Helvetica', // Medium weight
        light: 'Helvetica', // Light weight
    },
    sizes: {
        h1: 32, // Cover page title
        h2: 22, // Section headers
        h3: 18, // Subsection headers
        body: 11, // Body text (10.5-11pt range)
        caption: 9.5, // Table text (9.5-10pt range)
    },
    spacing: {
        pageMargin: 48, // Increased to 48pt (0.67in) for more breathing room
        sectionSpacing: 20, // Generous spacing between sections (12-20pt range)
        tableRowSpacing: 12, // More readable table rows
        imagePadding: 12,
        cardPadding: 24, // More generous card padding
        sectionTop: 72, // Normalized top spacing for all sections (increased from 70)
        lineHeight: 1.4, // Line height ratio (1.35-1.45 range)
    },
};
//# sourceMappingURL=styles.js.map