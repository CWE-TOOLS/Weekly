/**
 * Print Preview Renderer
 * Handles preview modal display, viewport scaling, and page rendering
 * @module components/modals/print-preview-renderer
 */

// Preview modal state
import { logger } from '../../utils/logger.js';
import { PRINT_PREVIEW } from '../../config/layout-constants.js';

let previewModalElement = null;
let previewCloseButton = null;
let previewViewport = null;
let previewPageInfo = null;

/**
 * Initialize preview modal elements
 * Sets up references to preview modal DOM elements
 */
export function initializePreviewElements() {
    previewModalElement = document.getElementById('print-preview-modal');
    previewCloseButton = document.getElementById('print-preview-close');
    previewViewport = document.getElementById('print-preview-viewport');
    previewPageInfo = document.getElementById('print-preview-page-info');

    if (!previewModalElement) {
        logger.error('Preview modal elements not found in DOM');
    }
}

/**
 * Setup preview close button event listener
 * @param {Function} onCloseCallback - Callback function when close button is clicked
 */
export function setupPreviewCloseHandler(onCloseCallback) {
    if (previewCloseButton && onCloseCallback) {
        previewCloseButton.addEventListener('click', onCloseCallback);
    }
}

/**
 * Setup preview modal ESC key handler
 * @param {Function} onCloseCallback - Callback function when ESC key is pressed
 */
export function setupPreviewKeyHandler(onCloseCallback) {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && previewModalElement && previewModalElement.classList.contains('show')) {
            if (onCloseCallback) {
                onCloseCallback();
            }
        }
    });
}

/**
 * Fit print pages to viewport height
 * Scales each page to fit the available viewport height
 * Uses 98% of viewport height for maximum space usage
 * Caps scaling at 0.95 to prevent pages from getting too large
 * @private
 */
function fitPagesToViewport() {
    if (!previewViewport) {
        logger.warn('Preview viewport not found');
        return;
    }

    // Use requestAnimationFrame to ensure we run after layout
    requestAnimationFrame(() => {
        const pages = previewViewport.querySelectorAll('.print-page');
        if (pages.length === 0) return;

        // Get viewport height and use PRINT_PREVIEW.VIEWPORT_USAGE_PERCENT of it for maximum space usage
        const viewportHeight = previewViewport.clientHeight * PRINT_PREVIEW.VIEWPORT_USAGE_PERCENT;

        pages.forEach((page, index) => {
            // Get the natural height of the page
            const pageHeight = page.offsetHeight;

            if (pageHeight > 0) {
                // Calculate scale to fit PRINT_PREVIEW.VIEWPORT_USAGE_PERCENT of viewport height
                let scale = viewportHeight / pageHeight;

                // Cap at PRINT_PREVIEW.MAX_SCALE to prevent pages from getting too large
                scale = Math.min(scale, PRINT_PREVIEW.MAX_SCALE);

                // Apply the scale using CSS transform
                page.style.transform = `scale(${scale})`;
                page.style.transformOrigin = 'top center';

                // Add margin between pages for better separation
                page.style.marginBottom = `${PRINT_PREVIEW.PAGE_MARGIN_PX}px`;

                logger.info(`Page ${index + 1} - Height: ${pageHeight}px, Viewport: ${viewportHeight.toFixed(0)}px, Scale: ${scale.toFixed(3)}`);
            }
        });
    });
}

/**
 * Show preview modal with print content
 * Displays the print preview modal with scaled pages
 * @param {HTMLElement} printContent - Print content to preview
 * @param {string} printType - Print type ('week' or 'day')
 * @param {HTMLElement} printModalElement - Print configuration modal element to hide
 */
export function showPreviewModal(printContent, printType, printModalElement) {
    if (!previewModalElement || !previewViewport) {
        logger.error('Preview modal elements not found');
        return;
    }

    // Clear previous content
    previewViewport.innerHTML = '';

    // Clone the print content to avoid affecting the original
    const clonedContent = printContent.cloneNode(true);

    // Add to viewport
    previewViewport.appendChild(clonedContent);

    // Fit pages to viewport
    fitPagesToViewport();

    // Update page info
    const pages = clonedContent.querySelectorAll('.print-page');
    if (previewPageInfo) {
        previewPageInfo.textContent = `${pages.length} page${pages.length !== 1 ? 's' : ''}`;
    }

    // Show the modal
    previewModalElement.classList.add('show');
    document.body.style.overflow = 'hidden';

    // Hide the print configuration modal
    if (printModalElement) {
        printModalElement.classList.remove('show');
    }
}

/**
 * Hide preview modal
 * Closes the preview modal and clears the viewport
 */
export function hidePreviewModal() {
    if (!previewModalElement) return;

    previewModalElement.classList.remove('show');
    document.body.style.overflow = '';

    // Clear the viewport
    if (previewViewport) {
        previewViewport.innerHTML = '';
    }
}

/**
 * Get preview modal element
 * @returns {HTMLElement|null} Preview modal element
 */
export function getPreviewModalElement() {
    return previewModalElement;
}

/**
 * Get preview viewport element
 * @returns {HTMLElement|null} Preview viewport element
 */
export function getPreviewViewport() {
    return previewViewport;
}
