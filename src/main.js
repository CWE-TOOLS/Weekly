/**
 * Application Entry Point
 * Weekly Schedule Task Viewer - Phase 8
 *
 * Minimal initialization and app startup.
 * All application logic has been moved to app-controller.js for better organization.
 */

import { initializeApp, setupBackwardCompatibility, getAppStatus } from './core/app-controller.js';
import { initializeErrorHandler } from './core/error-handler.js';

console.log('📋 Weekly Schedule Viewer - Phase 8');
console.log('⚡ ES6 Modules: Loading...');

// Initialize error handler first (to catch any initialization errors)
initializeErrorHandler();

// Set up backward compatibility for legacy code
setupBackwardCompatibility();

// Start the application
initializeApp().catch(error => {
    console.error('💥 Failed to initialize application:', error);

    // Show critical error UI
    const appError = document.getElementById('app-error');
    if (appError) {
        appError.classList.remove('hidden');

        const errorMessage = document.getElementById('error-message');
        if (errorMessage) {
            errorMessage.textContent = error.message || 'Failed to start application. Please refresh the page.';
        }
    }
});

// Export app status for debugging
window.getAppStatus = getAppStatus;

// Log Phase 8 completion message
console.log('✅ Phase 8: Application Controller Active');
console.log('💡 Type `window.getAppStatus()` in console for app health check');
