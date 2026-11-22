/**
 * Security Utilities
 * Provides functions for sanitizing and escaping user input
 * @module utils/security-utils
 */

/**
 * Escape HTML special characters to prevent XSS attacks
 * @param {string} str - String to escape
 * @returns {string} Escaped string safe for HTML insertion
 *
 * @example
 * escapeHtml('<script>alert("xss")</script>')
 * // Returns: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
 */
export function escapeHtml(str) {
    if (typeof str !== 'string') return str;

    const htmlEscapeMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '/': '&#x2F;'
    };

    return str.replace(/[&<>"'/]/g, char => htmlEscapeMap[char]);
}

/**
 * Create safe HTML string with escaped content
 * Allows specific HTML tags while escaping user content
 * @param {string} content - User content to escape
 * @param {string} wrapper - Safe HTML wrapper (e.g., '<b>', '<br>')
 * @returns {string} Safe HTML string
 *
 * @example
 * safeHtmlWrap('User Input', '<b>', '</b>')
 * // Returns: '<b>User Input</b>' with User Input escaped
 */
export function safeHtmlWrap(content, openTag, closeTag = '') {
    return `${openTag}${escapeHtml(content)}${closeTag}`;
}

/**
 * Safely join array items with HTML separator
 * Escapes all items but allows HTML separator
 * @param {string[]} items - Array of strings to join
 * @param {string} separator - HTML separator (e.g., '<br>', ', ')
 * @returns {string} Safe joined HTML string
 *
 * @example
 * safeHtmlJoin(['Project A', 'Project <script>'], '<br>')
 * // Returns: 'Project A<br>Project &lt;script&gt;'
 */
export function safeHtmlJoin(items, separator = '') {
    return items.map(escapeHtml).join(separator);
}

/**
 * Sanitize HTML description by escaping all content except safe tags.
 * Used for Batch/Layout descriptions that contain <br> for line breaks
 * and <b> for day labels (e.g., Friday's "Sat:"/"Mon:" prefixes).
 * @param {string} html - HTML string to sanitize
 * @returns {string} Sanitized string with only <br> and <b> tags preserved
 */
export function sanitizeDescription(html) {
    if (typeof html !== 'string') return html;
    let safe = escapeHtml(html);
    // Restore <br> variants that were escaped
    safe = safe.replace(/&lt;br\s*(?:&#x2F;)?&gt;/gi, '<br>');
    // Restore <b> and </b> tags that were escaped
    safe = safe.replace(/&lt;b&gt;/gi, '<b>');
    safe = safe.replace(/&lt;&#x2F;b&gt;/gi, '</b>');
    return safe;
}
