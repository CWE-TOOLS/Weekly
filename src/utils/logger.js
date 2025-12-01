/**
 * Production-Ready Logger Utility
 *
 * Centralized logging system with multiple log levels, formatting, and
 * environment-aware configuration for easy production disabling.
 *
 * Features:
 * - Multiple log levels (DEBUG, INFO, WARN, ERROR)
 * - Debug mode integration (uses same flags as debug.js)
 * - INFO/DEBUG logs suppressed in production unless debug mode enabled
 * - WARN/ERROR logs always visible
 * - Global enable/disable
 * - Per-level enable/disable
 * - Timestamps
 * - Context/module identification
 * - Color-coded console output
 * - Environment-aware defaults
 *
 * Usage:
 *   import { logger } from './utils/logger.js';
 *
 *   logger.debug('Detailed debug info', { data });
 *   logger.info('Operation completed');
 *   logger.warn('Potential issue detected');
 *   logger.error('Critical error occurred', error);
 *
 *   // Create contextual logger
 *   const moduleLogger = logger.createContext('ModuleName');
 *   moduleLogger.info('Module-specific log');
 *
 * Debug Mode:
 *   To enable INFO and DEBUG logs in production:
 *   - Add ?debug=true to the URL
 *   - Set localStorage.setItem('debug', 'true') in console
 *   - Set window.DEBUG = true in console
 */

// Log levels
const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

// Log level names for display
const LogLevelNames = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR'
};

// Color codes for console output (ANSI colors for terminals, CSS for browser)
const LogColors = {
  [LogLevel.DEBUG]: { browser: '#6B7280', ansi: '\x1b[90m' }, // Gray
  [LogLevel.INFO]: { browser: '#3B82F6', ansi: '\x1b[36m' },  // Blue/Cyan
  [LogLevel.WARN]: { browser: '#F59E0B', ansi: '\x1b[33m' },  // Yellow
  [LogLevel.ERROR]: { browser: '#EF4444', ansi: '\x1b[31m' }  // Red
};

const ResetColor = '\x1b[0m';

class Logger {
  constructor() {
    // Check if running in production
    this.isProduction = this.detectProductionMode();

    // Check if debug mode is enabled
    this.isDebugMode = this.checkDebugMode();

    // Global logging enabled/disabled
    this.enabled = true; // Always enabled, but level filtering applies

    // Minimum log level (logs below this level are ignored)
    // In production without debug mode: only WARN and ERROR
    // In production with debug mode OR in dev: all levels (INFO and above)
    this.minLevel = (this.isProduction && !this.isDebugMode) ? LogLevel.WARN : LogLevel.INFO;

    // Individual level controls
    this.levelEnabled = {
      [LogLevel.DEBUG]: true,
      [LogLevel.INFO]: true,
      [LogLevel.WARN]: true,
      [LogLevel.ERROR]: true
    };

    // Whether to include timestamps
    this.includeTimestamp = true;

    // Whether to use colors
    this.useColors = true;

    // Context prefix (for module-specific loggers)
    this.context = null;
  }

  /**
   * Detect if running in production mode
   */
  detectProductionMode() {
    // Check various production indicators
    if (typeof process !== 'undefined' && process.env) {
      if (process.env.NODE_ENV === 'production') return true;
    }

    // Check for production hostname patterns
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname;
      // Add your production domains here
      const productionDomains = ['yourapp.com', 'www.yourapp.com'];
      if (productionDomains.some(domain => hostname.includes(domain))) {
        return true;
      }
    }

    // Default to development
    return false;
  }

  /**
   * Check if debug mode is enabled via multiple sources
   * Uses the same detection logic as src/utils/debug.js
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
   * Format timestamp
   */
  formatTimestamp() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${ms}`;
  }

  /**
   * Format log message with level, timestamp, and context
   */
  formatMessage(level, message) {
    const parts = [];

    if (this.includeTimestamp) {
      parts.push(`[${this.formatTimestamp()}]`);
    }

    parts.push(`[${LogLevelNames[level]}]`);

    if (this.context) {
      parts.push(`[${this.context}]`);
    }

    parts.push(message);

    return parts.join(' ');
  }

  /**
   * Check if a log level should be output
   */
  shouldLog(level) {
    if (!this.enabled) return false;
    if (level < this.minLevel) return false;
    if (!this.levelEnabled[level]) return false;
    return true;
  }

  /**
   * Core logging function
   */
  log(level, message, ...args) {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message);
    const color = LogColors[level];

    // Choose console method based on level
    let consoleMethod;
    switch (level) {
      case LogLevel.ERROR:
        consoleMethod = console.error;
        break;
      case LogLevel.WARN:
        consoleMethod = console.warn;
        break;
      case LogLevel.DEBUG:
        consoleMethod = console.debug || console.log;
        break;
      default:
        consoleMethod = console.log;
    }

    // Output with colors if supported
    if (this.useColors && typeof window !== 'undefined') {
      // Browser environment - use CSS colors
      consoleMethod(
        `%c${formattedMessage}`,
        `color: ${color.browser}; font-weight: ${level >= LogLevel.WARN ? 'bold' : 'normal'}`,
        ...args
      );
    } else {
      // Node environment or colors disabled
      consoleMethod(formattedMessage, ...args);
    }
  }

  /**
   * Log at DEBUG level - detailed debugging information
   */
  debug(message, ...args) {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  /**
   * Log at INFO level - general informational messages
   */
  info(message, ...args) {
    this.log(LogLevel.INFO, message, ...args);
  }

  /**
   * Log at WARN level - warning messages
   */
  warn(message, ...args) {
    this.log(LogLevel.WARN, message, ...args);
  }

  /**
   * Log at ERROR level - error messages
   */
  error(message, ...args) {
    this.log(LogLevel.ERROR, message, ...args);
  }

  /**
   * Create a contextual logger with a specific module/component name
   */
  createContext(contextName) {
    const contextLogger = new Logger();
    contextLogger.enabled = this.enabled;
    contextLogger.isProduction = this.isProduction;
    contextLogger.isDebugMode = this.isDebugMode;
    contextLogger.minLevel = this.minLevel;
    contextLogger.levelEnabled = { ...this.levelEnabled };
    contextLogger.includeTimestamp = this.includeTimestamp;
    contextLogger.useColors = this.useColors;
    contextLogger.context = contextName;
    return contextLogger;
  }

  /**
   * Enable logging globally
   */
  enable() {
    this.enabled = true;
  }

  /**
   * Disable logging globally
   */
  disable() {
    this.enabled = false;
  }

  /**
   * Set minimum log level
   */
  setMinLevel(level) {
    if (level >= LogLevel.DEBUG && level <= LogLevel.ERROR) {
      this.minLevel = level;
    }
  }

  /**
   * Enable specific log level
   */
  enableLevel(level) {
    if (this.levelEnabled.hasOwnProperty(level)) {
      this.levelEnabled[level] = true;
    }
  }

  /**
   * Disable specific log level
   */
  disableLevel(level) {
    if (this.levelEnabled.hasOwnProperty(level)) {
      this.levelEnabled[level] = false;
    }
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return {
      enabled: this.enabled,
      isProduction: this.isProduction,
      isDebugMode: this.isDebugMode,
      minLevel: LogLevelNames[this.minLevel],
      levelEnabled: {
        DEBUG: this.levelEnabled[LogLevel.DEBUG],
        INFO: this.levelEnabled[LogLevel.INFO],
        WARN: this.levelEnabled[LogLevel.WARN],
        ERROR: this.levelEnabled[LogLevel.ERROR]
      },
      includeTimestamp: this.includeTimestamp,
      useColors: this.useColors,
      context: this.context
    };
  }

  /**
   * Log current configuration
   */
  logConfig() {
    const config = this.getConfig();
    // Use console.info instead of console.log for legitimate logging
    console.info('Logger Configuration:', config);
  }
}

// Create and export singleton instance
const logger = new Logger();

// Export both the instance and the LogLevel enum
export { logger, LogLevel };

// Export as default as well for convenience
export default logger;
