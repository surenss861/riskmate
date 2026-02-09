"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderPhotosSection = renderPhotosSection;
const styles_1 = require("../styles");
const helpers_1 = require("../helpers");
const utils_1 = require("../utils");
function renderPhotosSection(doc, photos, jobStartDate, jobEndDate, pageWidth, pageHeight, margin, safeAddPage, estimatedTotalPages) {
    const { before, during, after } = (0, utils_1.categorizePhotos)(photos, jobStartDate, jobEndDate);
    const sections = [
        { title: 'Before Photos', photos: before },
        { title: 'During Job Photos', photos: during },
        { title: 'After Photos', photos: after },
    ];
    sections.forEach((section) => {
        if (!section.photos.length)
            return;
        safeAddPage(estimatedTotalPages);
        (0, helpers_1.addSectionHeader)(doc, section.title);
        const gridY = doc.y;
        const imagesPerRow = 3;
        const imageWidth = (pageWidth - margin * 2 - styles_1.STYLES.spacing.imagePadding * 2) / 3;
        const imageHeight = 160;
        const gutter = styles_1.STYLES.spacing.imagePadding;
        let x = margin;
        let y = gridY;
        section.photos.forEach((photo, index) => {
            if (index > 0 && index % imagesPerRow === 0) {
                x = margin;
                y += imageHeight + 80;
                if (y + imageHeight > pageHeight - 100) {
                    safeAddPage(estimatedTotalPages);
                    // Reset position for photo grid continuation
                    doc.y = styles_1.STYLES.spacing.sectionTop + 40;
                    y = doc.y;
                    x = margin; // Reset x position for new row
                }
            }
            try {
                doc
                    .rect(x - 2, y - 2, imageWidth + 4, imageHeight + 4)
                    .stroke(styles_1.STYLES.colors.borderGray)
                    .lineWidth(1);
                if (photo.buffer && photo.buffer.length > 100) {
                    const isJPEG = photo.buffer[0] === 0xff && photo.buffer[1] === 0xd8;
                    const isPNG = photo.buffer[0] === 0x89 &&
                        photo.buffer[1] === 0x50 &&
                        photo.buffer[2] === 0x4e &&
                        photo.buffer[3] === 0x47;
                    if (!isJPEG && !isPNG) {
                        throw new Error('Unsupported image format (only JPEG/PNG supported)');
                    }
                    try {
                        doc.image(photo.buffer, x, y, {
                            fit: [imageWidth, imageHeight],
                            align: 'center',
                            valign: 'center',
                        });
                    }
                    catch (imageError) {
                        console.warn('Image format not supported:', imageError?.message);
                        throw new Error('Unsupported image format');
                    }
                }
                else {
                    throw new Error('Empty or invalid image buffer');
                }
            }
            catch (error) {
                console.warn('Failed to render photo in PDF:', error);
                doc
                    .rect(x, y, imageWidth, imageHeight)
                    .fill(styles_1.STYLES.colors.lightGrayBg)
                    .stroke(styles_1.STYLES.colors.borderGray)
                    .lineWidth(1.5);
                doc
                    .fillColor(styles_1.STYLES.colors.secondaryText)
                    .fontSize(24)
                    .font(styles_1.STYLES.fonts.body)
                    .text('[IMG]', x + imageWidth / 2 - 20, y + imageHeight / 2 - 12);
                doc
                    .fillColor(styles_1.STYLES.colors.secondaryText)
                    .fontSize(styles_1.STYLES.sizes.caption)
                    .font(styles_1.STYLES.fonts.light)
                    .text('Photo', x + imageWidth / 2 - 15, y + imageHeight / 2 + 5);
            }
            const caption = photo.description || `Photo ${index + 1}`;
            doc
                .fillColor(styles_1.STYLES.colors.primaryText)
                .fontSize(styles_1.STYLES.sizes.caption)
                .font(styles_1.STYLES.fonts.body)
                .text((0, utils_1.truncateText)(caption, 40), x, y + imageHeight + 8, {
                width: imageWidth,
            });
            if (photo.created_at) {
                doc
                    .fillColor(styles_1.STYLES.colors.secondaryText)
                    .fontSize(styles_1.STYLES.sizes.caption)
                    .font(styles_1.STYLES.fonts.light)
                    .text((0, utils_1.formatTime)(photo.created_at), x, y + imageHeight + 20, {
                    width: imageWidth,
                });
            }
            x += imageWidth + gutter;
        });
    });
}
//# sourceMappingURL=photos.js.map