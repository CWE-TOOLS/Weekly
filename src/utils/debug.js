/**
 * Debug Utility
 *
 * Simple utility to gate debugging console statements in production.
 *
 * Usage:
 *   import { debug } from './utils/debug.js';
 *
 *   debug.log('Debug info', { data });
 *   debug.trace('Call stack info');
 *   debug.time('operation-name');
 *   debug.timeEnd('operation-name');
 *
 * To enable debugging:
 *   - Add ?debug=true to the URL
 *   - Set localStorage.setItem('debug', 'true') in console
 *   - Set window.DEBUG = true in console
 */

class Debug {
  constructor() {
    this.isEnabled = this.checkDebugMode();
  }

  /**
   * Check if debug mode is enabled via multiple sources
   */
  checkDebugMode() {
    // Check localStorage
    if (typeof localStorage !== 'undefined') {
      if (localStorage.getItem('debug') === 'true') {
        return true;
      }
    }

    // Check URL parameter
    if (typeof window !== 'undefined' && window.location) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('debug') === 'true') {
        return true;
      }
    }

    // Check global window variable
    if (typeof window !== 'undefined' && window.DEBUG === true) {
      return true;
    }

    // Default to disabled
    return false;
  }

  /**
   * Debug log - only outputs if debug mode is enabled
   */
  log(...args) {
    if (this.isEnabled) {
      console.log(...args);
    }
  }

  /**
   * Debug trace - only outputs if debug mode is enabled
   */
  trace(...args) {
    if (this.isEnabled) {
      console.trace(...args);
    }
  }

  /**
   * Debug time - only outputs if debug mode is enabled
   */
  time(label) {
    if (this.isEnabled) {
      console.time(label);
    }
  }

  /**
   * Debug timeEnd - only outputs if debug mode is enabled
   */
  timeEnd(label) {
    if (this.isEnabled) {
      console.timeEnd(label);
    }
  }

  /**
   * Enable debug mode programmatically
   */
  enable() {
    this.isEnabled = true;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('debug', 'true');
    }
  }

  /**
   * Disable debug mode programmatically
   */
  disable() {
    this.isEnabled = false;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('debug');
    }
  }

  /**
   * Check if debug mode is currently enabled
   */
  get enabled() {
    return this.isEnabled;
  }
}

// Create and export singleton instance
const debug = new Debug();

export { debug };
export default debug;
