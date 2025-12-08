/**
 * Browser Compatibility Detection
 * Detects browser capabilities for modern JavaScript features
 * @module utils/browser-compat
 */

import { logger } from './logger.js';

/**
 * Check if browser supports modern JavaScript features required by Supabase v2
 * Requires: Optional chaining, Nullish coalescing, ES2020+ features
 * Minimum browser versions:
 * - Chrome 80+ (Feb 2020)
 * - Firefox 72+ (Jan 2020)
 * - Safari 13.1+ (Mar 2020)
 * - Edge 80+ (Feb 2020)
 *
 * @returns {boolean} True if browser supports modern features
 */
export function supportsModernJavaScript() {
    try {
        // Test for optional chaining support
        const testOptionalChaining = new Function('return window?.navigator?.userAgent');
        testOptionalChaining();

        // Test for nullish coalescing support
        const testNullishCoalescing = new Function('return null ?? "fallback"');
        testNullishCoalescing();

        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Get browser information
 * @returns {Object} Browser name and version
 */
export function getBrowserInfo() {
    const userAgent = navigator.userAgent;
    let browserName = 'Unknown';
    let browserVersion = 'Unknown';

    // Chrome
    if (/Chrome\/(\d+)/.test(userAgent) && !/Edg\//.test(userAgent)) {
        browserName = 'Chrome';
        browserVersion = RegExp.$1;
    }
    // Edge (Chromium-based)
    else if (/Edg\/(\d+)/.test(userAgent)) {
        browserName = 'Edge';
        browserVersion = RegExp.$1;
    }
    // Firefox
    else if (/Firefox\/(\d+)/.test(userAgent)) {
        browserName = 'Firefox';
        browserVersion = RegExp.$1;
    }
    // Safari
    else if (/Version\/(\d+).*Safari/.test(userAgent)) {
        browserName = 'Safari';
        browserVersion = RegExp.$1;
    }

    return { browserName, browserVersion };
}

/**
 * Check if current browser is supported
 * @returns {Object} Support status and details
 */
export function checkBrowserCompatibility() {
    const supportsModern = supportsModernJavaScript();
    const browserInfo = getBrowserInfo();

    const result = {
        isSupported: supportsModern,
        browserName: browserInfo.browserName,
        browserVersion: browserInfo.browserVersion,
        message: '',
        degradedMode: false
    };

    if (!supportsModern) {
        result.degradedMode = true;
        result.message = `${browserInfo.browserName} ${browserInfo.browserVersion} detected. Running in read-only mode with REST API fallback. Editing disabled. For full features, update to Chrome 80+, Firefox 72+, or Safari 13.1+.`;

        logger.warn('⚠️ Browser does not support modern JavaScript features');
        logger.warn(`Browser: ${browserInfo.browserName} ${browserInfo.browserVersion}`);
        logger.warn('Running in degraded mode - using REST API fallback for data access');
    } else {
        result.message = 'Browser fully supported';
        logger.info(`✅ Browser supported: ${browserInfo.browserName} ${browserInfo.browserVersion}`);
    }

    return result;
}

/**
 * Show browser compatibility warning banner
 * @param {string} message - Warning message to display
 */
export function showCompatibilityWarning(message) {
    // Create warning banner
    const banner = document.createElement('div');
    banner.id = 'browser-compat-warning';
    banner.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
        color: white;
        padding: 12px 20px;
        text-align: center;
        font-size: 14px;
        font-weight: 500;
        z-index: 10000;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        line-height: 1.5;
    `;

    banner.innerHTML = `
        <span style="margin-right: 8px;">⚠️</span>
        <span>${message}</span>
        <span style="margin-left: 8px;">📖 View-only mode active</span>
    `;

    // Insert at top of body
    if (document.body) {
        document.body.insertBefore(banner, document.body.firstChild);

        // Adjust page content to account for banner
        const container = document.querySelector('.container');
        if (container) {
            container.style.marginTop = '60px';
        }
    }
}

/**
 * Disable editing UI elements for degraded mode
 */
export function disableEditingUI() {
    logger.info('🔒 Disabling editing UI elements for degraded mode');

    // Disable main editing button
    const editingBtn = document.getElementById('main-editing-btn');
    if (editingBtn) {
        editingBtn.style.display = 'none';
    }

    // Disable FAB add task button
    const fabBtn = document.getElementById('fab-add-task');
    if (fabBtn) {
        fabBtn.style.display = 'none';
    }

    // Disable refresh button (real-time sync won't work)
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.title = 'Real-time sync not available in this browser';
        refreshBtn.style.opacity = '0.5';
        refreshBtn.style.cursor = 'not-allowed';
    }

    // Add CSS to prevent context menu on cards
    const style = document.createElement('style');
    style.textContent = `
        .task-card {
            pointer-events: auto !important;
        }
        .task-card:hover {
            cursor: default !important;
        }
    `;
    document.head.appendChild(style);

    logger.info('✅ Editing UI disabled');
}

/**
 * Global flag for degraded mode
 */
let isDegradedMode = false;

/**
 * Set degraded mode flag
 * @param {boolean} enabled
 */
export function setDegradedMode(enabled) {
    isDegradedMode = enabled;
    if (enabled) {
        // Store in sessionStorage so other modules can check
        sessionStorage.setItem('degradedMode', 'true');
    } else {
        sessionStorage.removeItem('degradedMode');
    }
}

/**
 * Check if app is running in degraded mode
 * @returns {boolean}
 */
export function isInDegradedMode() {
    return isDegradedMode || sessionStorage.getItem('degradedMode') === 'true';
}
