import { getSupabaseClient } from '../../services/supabase-service.js';
import { showReloadModal } from '../../components/modals/reload-modal.js';
import { clearAllData } from '../../core/storage.js';
import { logger } from '../../utils/logger.js';

const CURRENT_APP_VERSION = '1.1.1'; // This will be compared against the database version

/**
 * Fetches the latest version from the Supabase database.
 * @returns {Promise<string|null>} The latest version string or null on error.
 */
async function getLatestVersion() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    logger.warn('Supabase client not available for version check.');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'version')
      .single();

    if (error) {
      throw error;
    }

    return data ? data.value : null;
  } catch (error) {
    logger.error('Error fetching latest version:', error);
    return null;
  }
}

/**
 * Checks if the application version is outdated and triggers the reload modal if it is.
 */
export async function checkVersion() {
  const latestVersion = await getLatestVersion();

  if (latestVersion && latestVersion !== CURRENT_APP_VERSION) {
    logger.log(`New version available. Local: ${CURRENT_APP_VERSION}, Remote: ${latestVersion}`);
    showReloadModal({
      onConfirm: () => {
        clearAllData();
        window.location.reload(true);
      }
    });
  } else if (!latestVersion) {
    logger.warn('Could not determine latest application version.');
  } else {
    logger.log('Application is up to date.');
  }
}

/**
 * Subscribe to real-time version changes from Supabase.
 * When the version in the database changes, automatically trigger the version check.
 */
export function subscribeToVersionChanges() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    logger.warn('Supabase client not available for version subscription.');
    return null;
  }

  logger.info('📡 Subscribing to version changes...');

  const subscription = supabase
    .channel('version-updates')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'app_config',
        filter: 'key=eq.version'
      },
      (payload) => {
        logger.info('🔔 Version update detected:', payload.new.value);
        checkVersion();
      }
    )
    .subscribe();

  return subscription;
}