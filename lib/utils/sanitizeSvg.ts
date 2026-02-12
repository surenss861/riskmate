import DOMPurify from 'dompurify'

/**
 * Sanitizes SVG content to prevent XSS attacks while preserving safe SVG elements.
 * Removes scripts, event handlers, and other potentially dangerous content.
 * 
 * @param svgString - The raw SVG string to sanitize
 * @returns Sanitized SVG string safe for rendering via dangerouslySetInnerHTML
 */
export function sanitizeSvg(svgString: string): string {
  if (typeof window === 'undefined') {
    // Server-side: return empty string (SVG will be sanitized on client)
    return ''
  }

  // Configure DOMPurify to allow SVG elements but strip scripts and event handlers
  const sanitized = DOMPurify.sanitize(svgString, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ['svg', 'path', 'g', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'text'],
    ADD_ATTR: ['stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'fill', 'd', 'cx', 'cy', 'r', 'x', 'y', 'width', 'height', 'viewBox', 'xmlns', 'transform', 'points', 'rx', 'ry'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'onmouseenter', 'onmouseleave', 'onmousedown', 'onmouseup', 'onkeydown', 'onkeyup', 'onkeypress', 'onfocus', 'onblur', 'onchange', 'oninput', 'onsubmit', 'onreset', 'onselect', 'onabort', 'oncanplay', 'oncanplaythrough', 'ondurationchange', 'onemptied', 'onended', 'onerror', 'onloadeddata', 'onloadedmetadata', 'onloadstart', 'onpause', 'onplay', 'onplaying', 'onprogress', 'onratechange', 'onseeked', 'onseeking', 'onstalled', 'onsuspend', 'ontimeupdate', 'onvolumechange', 'onwaiting'],
  })

  return sanitized
}
