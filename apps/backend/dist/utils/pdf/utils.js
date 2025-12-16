"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchLogoBuffer = fetchLogoBuffer;
exports.formatDate = formatDate;
exports.formatTime = formatTime;
exports.formatShortDate = formatShortDate;
exports.truncateText = truncateText;
exports.getRiskColor = getRiskColor;
exports.getSeverityColor = getSeverityColor;
exports.categorizePhotos = categorizePhotos;
const styles_1 = require("./styles");
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
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
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
            hour: '2-digit',
            minute: '2-digit',
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
function categorizePhotos(photos, jobStartDate) {
    if (!jobStartDate)
        return { before: [], during: photos, after: [] };
    const jobStart = new Date(jobStartDate).getTime();
    const jobEnd = Date.now();
    const before = [];
    const during = [];
    const after = [];
    photos.forEach((photo) => {
        if (!photo.created_at) {
            during.push(photo);
            return;
        }
        const photoTime = new Date(photo.created_at).getTime();
        if (photoTime < jobStart) {
            before.push(photo);
        }
        else if (photoTime > jobEnd) {
            after.push(photo);
        }
        else {
            during.push(photo);
        }
    });
    return { before, during, after };
}
//# sourceMappingURL=utils.js.map