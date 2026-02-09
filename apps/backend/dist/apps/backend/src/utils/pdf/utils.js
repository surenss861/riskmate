"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categorizePhotos = void 0;
exports.fetchLogoBuffer = fetchLogoBuffer;
exports.formatDate = formatDate;
exports.formatTime = formatTime;
exports.formatShortDate = formatShortDate;
exports.truncateText = truncateText;
exports.getRiskColor = getRiskColor;
exports.getSeverityColor = getSeverityColor;
const styles_1 = require("./styles");
const photoCategory_1 = require("@lib/utils/photoCategory");
async function fetchLogoBuffer(logoUrl) {
    if (!logoUrl)
        return null;
    try {
        const response = await fetch(logoUrl);
        if (!response.ok)
            throw new Error('Failed to download logo');
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }
    catch (error) {
        console.warn('Unable to include logo in PDF:', error);
        return null;
    }
}
function formatDate(dateString) {
    if (!dateString)
        return 'N/A';
    try {
        const date = new Date(dateString);
        if (Number.isNaN(date.valueOf()))
            return 'N/A';
        return date.toLocaleString('en-US', {
            timeZone: 'America/New_York',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short',
        });
    }
    catch {
        return 'N/A';
    }
}
function formatTime(dateString) {
    if (!dateString)
        return '';
    try {
        const date = new Date(dateString);
        if (Number.isNaN(date.valueOf()))
            return '';
        return date.toLocaleTimeString('en-US', {
            timeZone: 'America/New_York',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short',
        });
    }
    catch {
        return '';
    }
}
function formatShortDate(dateString) {
    if (!dateString)
        return '';
    try {
        const date = new Date(dateString);
        if (Number.isNaN(date.valueOf()))
            return '';
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
    }
    catch {
        return '';
    }
}
function truncateText(text, maxLength) {
    if (!text || text.length <= maxLength)
        return text;
    return text.substring(0, maxLength - 3) + '...';
}
function getRiskColor(level) {
    if (!level)
        return styles_1.STYLES.colors.riskLow;
    const lower = level.toLowerCase();
    if (lower === 'critical' || lower === 'high')
        return styles_1.STYLES.colors.riskHigh;
    if (lower === 'medium')
        return styles_1.STYLES.colors.riskMedium;
    return styles_1.STYLES.colors.riskLow;
}
function getSeverityColor(severity) {
    const lower = severity.toLowerCase();
    if (lower === 'critical')
        return styles_1.STYLES.colors.riskCritical;
    if (lower === 'high')
        return styles_1.STYLES.colors.riskHigh;
    if (lower === 'medium')
        return styles_1.STYLES.colors.riskMedium;
    return styles_1.STYLES.colors.riskLow;
}
/** Re-export from shared photoCategory for backend PDF consumers. */
exports.categorizePhotos = photoCategory_1.categorizePhotos;
//# sourceMappingURL=utils.js.map