/**
 * Lazy Loading Utility
 * Dynamically import modules only when needed to reduce initial load time
 * @module utils/lazy-loader
 */

// Cache for loaded modules
const cache = new Map();

// Track in-flight loading promises
const loading = new Map();

/**
 * Lazy load a module
 * Returns cached module if already loaded, or loads it dynamically
 * @param {Function} importer - Dynamic import function () => import('./module.js')
 * @param {string} cacheKey - Unique cache key for this module
 * @returns {Promise<Module>} The loaded module
 * @example
 * const module = await lazyLoad(
 *   () => import('../components/modals/password-modal.js'),
 *   'password-modal'
 * );
 */
export async function lazyLoad(importer, cacheKey) {
  // Return cached module if available
  if (cache.has(cacheKey)) {
    console.log(`📦 Lazy load: Using cached module '${cacheKey}'`);
    return cache.get(cacheKey);
  }

  // Return in-flight promise if already loading
  if (loading.has(cacheKey)) {
    console.log(`⏳ Lazy load: Waiting for in-flight module '${cacheKey}'`);
    return loading.get(cacheKey);
  }

  // Start loading
  console.log(`🔄 Lazy load: Loading module '${cacheKey}'...`);
  const startTime = performance.now();

  const loadPromise = importer()
    .then(module => {
      const loadTime = (performance.now() - startTime).toFixed(2);
      console.log(`✅ Lazy load: Module '${cacheKey}' loaded in ${loadTime}ms`);

      cache.set(cacheKey, module);
      loading.delete(cacheKey);
      return module;
    })
    .catch(error => {
      loading.delete(cacheKey);
      console.error(`❌ Lazy load: Failed to load module '${cacheKey}':`, error);
      throw error;
    });

  loading.set(cacheKey, loadPromise);
  return loadPromise;
}

/**
 * Preload a module in the background
 * Silently loads module without blocking, for better perceived performance
 * @param {Function} importer - Dynamic import function
 * @param {string} cacheKey - Cache key for this module
 * @example
 * // Preload modal after app initializes
 * preload(() => import('../components/modals/print-modal.js'), 'print-modal');
 */
export function preload(importer, cacheKey) {
  if (!cache.has(cacheKey) && !loading.has(cacheKey)) {
    console.log(`🔮 Preload: Scheduling module '${cacheKey}'`);
    lazyLoad(importer, cacheKey).catch(() => {
      // Silently fail preload - not critical
      console.warn(`⚠️ Preload: Failed to preload '${cacheKey}' (non-critical)`);
    });
  }
}

/**
 * Preload multiple modules on browser idle time
 * Uses requestIdleCallback for optimal performance
 * @param {Array<{importer: Function, key: string}>} modules - Array of modules to preload
 * @param {number} timeout - Fallback timeout in ms (default: 2000)
 * @example
 * preloadOnIdle([
 *   { importer: () => import('./modal1.js'), key: 'modal1' },
 *   { importer: () => import('./modal2.js'), key: 'modal2' }
 * ]);
 */
export function preloadOnIdle(modules, timeout = 2000) {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      console.log(`💤 Preload: Starting idle preload for ${modules.length} modules`);
      modules.forEach(({ importer, key }) => {
        preload(importer, key);
      });
    }, { timeout });
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(() => {
      console.log(`⏱️ Preload: Starting deferred preload for ${modules.length} modules`);
      modules.forEach(({ importer, key }) => {
        preload(importer, key);
      });
    }, timeout);
  }
}

/**
 * Clear lazy load cache
 * Useful for testing or forcing module reload
 */
export function clearCache() {
  const cacheSize = cache.size;
  cache.clear();
  loading.clear();
  console.log(`🗑️ Lazy load: Cleared cache (${cacheSize} modules)`);
}

/**
 * Get cache statistics
 * @returns {Object} Cache stats
 */
export function getCacheStats() {
  return {
    cachedModules: cache.size,
    loadingModules: loading.size,
    moduleKeys: Array.from(cache.keys())
  };
}

// Expose utilities for debugging
if (typeof window !== 'undefined') {
  window.__lazyLoader = {
    getCacheStats,
    clearCache
  };
}
