/**
 * Performance Monitor
 * Tracks and reports performance metrics including Core Web Vitals
 * @module core/performance-monitor
 */

// Performance metrics storage
import { logger } from '../utils/logger.js';
import { MONITORING } from '../config/timing-constants.js';

const metrics = {
  marks: new Map(),
  measures: new Map(),
  vitals: {}
};

// Performance observers
let lcpObserver = null;
let fidObserver = null;
let clsObserver = null;

/**
 * Initialize performance monitoring
 * Sets up Core Web Vitals tracking and custom metrics
 */
export function initializePerformanceMonitor() {
  logger.debug('📊 Initializing performance monitor...');

  // Mark app start
  mark('app-start');

  // Observe Core Web Vitals
  if ('PerformanceObserver' in window) {
    observeCoreWebVitals();
  } else {
    logger.warn('⚠️ PerformanceObserver not supported');
  }

  // Report on page unload
  window.addEventListener('beforeunload', reportPerformanceMetrics);

  // Report periodically in development
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    setTimeout(() => {
      logger.debug('📊 Development Performance Report:');
      reportPerformanceMetrics();
    }, MONITORING.PERF_MONITOR_INTERVAL);
  }

  logger.debug('✅ Performance monitor initialized');
}

/**
 * Mark a performance point
 * @param {string} name - Mark name
 */
export function mark(name) {
  if ('performance' in window && performance.mark) {
    try {
      performance.mark(name);
      metrics.marks.set(name, performance.now());
    } catch (error) {
      logger.warn(`Failed to create mark ${name}:`, error);
    }
  }
}

/**
 * Measure time between two marks
 * @param {string} name - Measure name
 * @param {string} startMark - Start mark name
 * @param {string} endMark - End mark name (optional, defaults to now)
 * @returns {number} Duration in milliseconds
 */
export function measure(name, startMark, endMark) {
  if (!('performance' in window && performance.measure)) {
    return 0;
  }

  try {
    if (endMark) {
      performance.measure(name, startMark, endMark);
    } else {
      performance.measure(name, startMark);
    }

    const measure = performance.getEntriesByName(name, 'measure')[0];
    const duration = measure ? measure.duration : 0;

    metrics.measures.set(name, duration);
    logger.debug(`⏱️  ${name}: ${duration.toFixed(2)}ms`);

    return duration;
  } catch (error) {
    logger.warn(`Failed to measure ${name}:`, error);
    return 0;
  }
}

/**
 * Observe Core Web Vitals
 * Tracks LCP, FID, and CLS
 */
function observeCoreWebVitals() {
  // LCP (Largest Contentful Paint)
  try {
    lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      const lcpValue = lastEntry.renderTime || lastEntry.loadTime;
      metrics.vitals.LCP = lcpValue;

      const rating = lcpValue <= 2500 ? '✅ Good' : lcpValue <= 4000 ? '⚠️ Needs Improvement' : '❌ Poor';
      logger.debug(`📊 LCP: ${lcpValue.toFixed(2)}ms ${rating}`);
    });
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) {
    logger.warn('⚠️ LCP observation not supported');
  }

  // FID (First Input Delay)
  try {
    fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach(entry => {
        const fidValue = entry.processingStart - entry.startTime;
        metrics.vitals.FID = fidValue;

        const rating = fidValue <= 100 ? '✅ Good' : fidValue <= 300 ? '⚠️ Needs Improvement' : '❌ Poor';
        logger.debug(`📊 FID: ${fidValue.toFixed(2)}ms ${rating}`);
      });
    });
    fidObserver.observe({ type: 'first-input', buffered: true });
  } catch (e) {
    logger.warn('⚠️ FID observation not supported');
  }

  // CLS (Cumulative Layout Shift)
  try {
    let clsScore = 0;
    clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          clsScore += entry.value;
        }
      }
      metrics.vitals.CLS = clsScore;

      const rating = clsScore <= 0.1 ? '✅ Good' : clsScore <= 0.25 ? '⚠️ Needs Improvement' : '❌ Poor';
      logger.debug(`📊 CLS: ${clsScore.toFixed(4)} ${rating}`);
    });
    clsObserver.observe({ type: 'layout-shift', buffered: true });
  } catch (e) {
    logger.warn('⚠️ CLS observation not supported');
  }

  // TTFB (Time to First Byte) - from Navigation Timing
  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach(entry => {
        if (entry.responseStart > 0) {
          const ttfb = entry.responseStart - entry.requestStart;
          metrics.vitals.TTFB = ttfb;

          const rating = ttfb <= 600 ? '✅ Good' : ttfb <= 1500 ? '⚠️ Needs Improvement' : '❌ Poor';
          logger.debug(`📊 TTFB: ${ttfb.toFixed(2)}ms ${rating}`);
        }
      });
    });
    observer.observe({ type: 'navigation', buffered: true });
  } catch (e) {
    logger.warn('⚠️ TTFB observation not supported');
  }
}

/**
 * Get current performance metrics
 * @returns {Object} All collected metrics
 */
export function getPerformanceMetrics() {
  const navigation = performance.getEntriesByType('navigation')[0];

  return {
    marks: Object.fromEntries(metrics.marks),
    measures: Object.fromEntries(metrics.measures),
    vitals: {
      ...metrics.vitals,
      // Add ratings
      LCP_rating: metrics.vitals.LCP ? (metrics.vitals.LCP <= 2500 ? 'Good' : metrics.vitals.LCP <= 4000 ? 'Needs Improvement' : 'Poor') : 'N/A',
      FID_rating: metrics.vitals.FID ? (metrics.vitals.FID <= 100 ? 'Good' : metrics.vitals.FID <= 300 ? 'Needs Improvement' : 'Poor') : 'N/A',
      CLS_rating: metrics.vitals.CLS ? (metrics.vitals.CLS <= 0.1 ? 'Good' : metrics.vitals.CLS <= 0.25 ? 'Needs Improvement' : 'Poor') : 'N/A',
      TTFB_rating: metrics.vitals.TTFB ? (metrics.vitals.TTFB <= 600 ? 'Good' : metrics.vitals.TTFB <= 1500 ? 'Needs Improvement' : 'Poor') : 'N/A'
    },
    navigation: navigation ? {
      domContentLoaded: (navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart).toFixed(2) + 'ms',
      loadComplete: (navigation.loadEventEnd - navigation.loadEventStart).toFixed(2) + 'ms',
      domInteractive: navigation.domInteractive.toFixed(2) + 'ms',
      ttfb: (navigation.responseStart - navigation.requestStart).toFixed(2) + 'ms'
    } : null,
    memory: performance.memory ? {
      usedJSHeapSize: (performance.memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB',
      totalJSHeapSize: (performance.memory.totalJSHeapSize / 1048576).toFixed(2) + ' MB',
      limit: (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2) + ' MB',
      percentUsed: ((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100).toFixed(1) + '%'
    } : null,
    resources: getResourceStats()
  };
}

/**
 * Get resource loading statistics
 * @returns {Object} Resource stats
 */
function getResourceStats() {
  const resources = performance.getEntriesByType('resource');

  const stats = {
    total: resources.length,
    byType: {},
    totalSize: 0,
    totalDuration: 0
  };

  resources.forEach(resource => {
    const type = resource.initiatorType || 'other';
    if (!stats.byType[type]) {
      stats.byType[type] = { count: 0, duration: 0 };
    }
    stats.byType[type].count++;
    stats.byType[type].duration += resource.duration;
    stats.totalDuration += resource.duration;

    if (resource.transferSize) {
      stats.totalSize += resource.transferSize;
    }
  });

  stats.totalSize = (stats.totalSize / 1024).toFixed(2) + ' KB';
  stats.totalDuration = stats.totalDuration.toFixed(2) + 'ms';

  return stats;
}

/**
 * Report performance metrics to console
 */
export function reportPerformanceMetrics() {
  const metrics = getPerformanceMetrics();

  console.group('📊 Performance Report');
  logger.debug('🎯 Core Web Vitals:', metrics.vitals);
  logger.debug('⏱️  Custom Measures:', metrics.measures);
  logger.debug('🗺️  Marks:', metrics.marks);
  logger.debug('🌐 Navigation Timing:', metrics.navigation);
  logger.debug('💾 Memory Usage:', metrics.memory);
  logger.debug('📦 Resources:', metrics.resources);
  console.groupEnd();

  return metrics;
}

/**
 * Start memory monitoring
 * Logs memory usage at regular intervals
 * @param {number} interval - Interval in ms (default: 60000 = 1 minute)
 * @returns {number} Interval ID
 */
export function startMemoryMonitoring(interval = 60000) {
  if (!performance.memory) {
    logger.warn('⚠️ Memory monitoring not supported');
    return null;
  }

  logger.debug(`💾 Starting memory monitoring (interval: ${interval}ms)`);

  return setInterval(() => {
    const memory = performance.memory;
    const used = (memory.usedJSHeapSize / 1048576).toFixed(2);
    const total = (memory.totalJSHeapSize / 1048576).toFixed(2);
    const limit = (memory.jsHeapSizeLimit / 1048576).toFixed(2);
    const percent = ((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100).toFixed(1);

    logger.debug(`💾 Memory: ${used}MB / ${total}MB (Limit: ${limit}MB) - ${percent}% used`);

    // Warn if memory usage is high
    if (memory.usedJSHeapSize / memory.jsHeapSizeLimit > 0.9) {
      logger.warn('⚠️ High memory usage detected! (>90%)');
    }
  }, interval);
}

/**
 * Stop observers and clean up
 */
export function stopPerformanceMonitoring() {
  if (lcpObserver) lcpObserver.disconnect();
  if (fidObserver) fidObserver.disconnect();
  if (clsObserver) clsObserver.disconnect();
  logger.debug('🛑 Performance monitoring stopped');
}

// Expose utilities for debugging
if (typeof window !== 'undefined') {
  window.getPerformanceMetrics = getPerformanceMetrics;
  window.reportPerformanceMetrics = reportPerformanceMetrics;
  window.startMemoryMonitoring = startMemoryMonitoring;
}
