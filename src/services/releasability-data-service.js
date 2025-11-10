/**
 * Releasability Data Service
 *
 * Handles data integration between Google Sheets, Supabase, and the releasability board.
 * - Loads projects from Google Sheets
 * - Detects project start dates
 * - Loads/saves tracking statuses from/to Supabase
 *
 * @module services/releasability-data-service
 */

import { fetchTasks } from './sheets-service.js';
import { initializeSupabase, getSupabaseClient } from './supabase-service.js';
import { logger } from '../utils/logger.js';
import { DEFAULT_TRACKING_STATUS, PROJECT_SOURCE } from '../config/releasability-config.js';

// Supabase table for releasability tracking
const RELEASABILITY_TABLE = 'releasability_tracking';

/**
 * Load projects from Google Sheets
 *
 * Fetches tasks from Google Sheets, groups them by project, and detects
 * the earliest week (start date) for each project.
 *
 * @returns {Promise<Array<Object>>} Array of project objects with weekMonday and department
 *
 * @example
 * const projects = await loadProjectsFromSheets();
 * // Returns: [{project: 'Project A', weekMonday: '2025-01-13', department: 'Mill', ...}]
 */
export async function loadProjectsFromSheets() {
  logger.info('📊 Loading projects from Google Sheets...');

  try {
    // Fetch all tasks from Google Sheets
    const tasks = await fetchTasks();
    logger.info(`  → Fetched ${tasks.length} tasks from Google Sheets`);

    // Group tasks by project name
    const projectGroups = {};
    tasks.forEach(task => {
      const projectName = task.project.trim();
      if (!projectName) return; // Skip tasks without project name

      if (!projectGroups[projectName]) {
        projectGroups[projectName] = [];
      }
      projectGroups[projectName].push(task);
    });

    logger.info(`  → Found ${Object.keys(projectGroups).length} unique projects`);

    // Create project objects with earliest week as start date
    const projects = [];
    for (const [projectName, projectTasks] of Object.entries(projectGroups)) {
      // Find earliest week for this project
      const weeks = projectTasks
        .map(task => task.week)
        .filter(week => week) // Filter out empty weeks
        .sort();

      if (weeks.length === 0) continue; // Skip projects without any week data

      const earliestWeek = weeks[0];

      // Get most common department for this project
      const department = getMostCommonDepartment(projectTasks);

      projects.push({
        project: projectName,
        weekMonday: earliestWeek,
        department: department,
        source: PROJECT_SOURCE.SHEETS
      });
    }

    logger.info(`  → Created ${projects.length} releasability board projects`);
    return projects;

  } catch (error) {
    logger.error('❌ Failed to load projects from Google Sheets:', error);
    throw error;
  }
}

/**
 * Get the most common department from a list of tasks
 * @param {Array<Object>} tasks - Array of task objects
 * @returns {string|null} Most common department name or null
 */
function getMostCommonDepartment(tasks) {
  const departmentCounts = {};

  tasks.forEach(task => {
    const dept = task.department;
    if (dept) {
      departmentCounts[dept] = (departmentCounts[dept] || 0) + 1;
    }
  });

  // Find department with highest count
  let maxCount = 0;
  let mostCommon = null;

  for (const [dept, count] of Object.entries(departmentCounts)) {
    if (count > maxCount) {
      maxCount = count;
      mostCommon = dept;
    }
  }

  return mostCommon;
}

/**
 * Load tracking statuses from Supabase
 *
 * Fetches all saved tracking statuses for releasability board projects.
 * Returns a map of project+week -> tracking status object.
 *
 * @returns {Promise<Map<string, Object>>} Map of project keys to tracking status objects
 *
 * @example
 * const statuses = await loadTrackingStatuses();
 * // Returns: Map { 'Project A|2025-01-13' => {trackingStatus: {...}, updatedAt: '...'} }
 */
export async function loadTrackingStatuses() {
  logger.info('💾 Loading tracking statuses from Supabase...');

  try {
    // Ensure Supabase is initialized
    if (!getSupabaseClient()) {
      await initializeSupabase();
    }

    const client = getSupabaseClient();

    // Fetch all tracking records
    const { data, error } = await client
      .from(RELEASABILITY_TABLE)
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Convert to map for easy lookup
    const statusMap = new Map();
    data.forEach(record => {
      const key = `${record.project}|${record.week_monday}`;
      statusMap.set(key, {
        trackingStatus: record.tracking_status,
        updatedAt: record.updated_at
      });
    });

    logger.info(`  → Loaded ${statusMap.size} tracking status records`);
    return statusMap;

  } catch (error) {
    logger.error('❌ Failed to load tracking statuses:', error);
    // Don't throw - return empty map so the app can continue
    return new Map();
  }
}

/**
 * Save tracking status to Supabase
 *
 * Saves or updates a project's tracking status in Supabase.
 * Uses upsert to handle both create and update cases.
 *
 * @param {Object} project - Project object with project name, weekMonday, and trackingStatus
 * @returns {Promise<boolean>} True if save successful
 *
 * @example
 * await saveTrackingStatus({
 *   project: 'Project A',
 *   weekMonday: '2025-01-13',
 *   trackingStatus: {...}
 * });
 */
export async function saveTrackingStatus(project) {
  logger.debug(`💾 Saving tracking status for "${project.project}"...`);

  try {
    // Ensure Supabase is initialized
    if (!getSupabaseClient()) {
      await initializeSupabase();
    }

    const client = getSupabaseClient();

    // Upsert tracking status
    const { data, error } = await client
      .from(RELEASABILITY_TABLE)
      .upsert({
        project: project.project,
        week_monday: project.weekMonday,
        tracking_status: project.trackingStatus,
        department: project.department,
        source: project.source,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'project,week_monday' // Update if exists
      });

    if (error) {
      throw error;
    }

    logger.debug(`  → Tracking status saved successfully`);
    return true;

  } catch (error) {
    logger.error(`❌ Failed to save tracking status for "${project.project}":`, error);
    throw error;
  }
}

/**
 * Delete tracking status from Supabase
 *
 * Removes a project's tracking status record from Supabase.
 *
 * @param {string} projectName - Project name
 * @param {string} weekMonday - Week Monday date
 * @returns {Promise<boolean>} True if deletion successful
 *
 * @example
 * await deleteTrackingStatus('Project A', '2025-01-13');
 */
export async function deleteTrackingStatus(projectName, weekMonday) {
  logger.debug(`🗑️ Deleting tracking status for "${projectName}"...`);

  try {
    // Ensure Supabase is initialized
    if (!getSupabaseClient()) {
      await initializeSupabase();
    }

    const client = getSupabaseClient();

    // Delete tracking status
    const { error } = await client
      .from(RELEASABILITY_TABLE)
      .delete()
      .eq('project', projectName)
      .eq('week_monday', weekMonday);

    if (error) {
      throw error;
    }

    logger.debug(`  → Tracking status deleted successfully`);
    return true;

  } catch (error) {
    logger.error(`❌ Failed to delete tracking status for "${projectName}":`, error);
    throw error;
  }
}

/**
 * Load all releasability data
 *
 * Combines data from Google Sheets and Supabase to create the complete
 * releasability board state.
 *
 * @returns {Promise<Array<Object>>} Array of project objects with tracking statuses
 *
 * @example
 * const projects = await loadAllReleasabilityData();
 * // Returns complete projects with tracking statuses merged from Supabase
 */
export async function loadAllReleasabilityData() {
  logger.info('🔄 Loading all releasability data...');

  try {
    // Load projects from Google Sheets and tracking statuses from Supabase in parallel
    const [sheetsProjects, trackingStatuses] = await Promise.all([
      loadProjectsFromSheets(),
      loadTrackingStatuses()
    ]);

    // Merge tracking statuses into projects
    const projects = sheetsProjects.map(project => {
      const key = `${project.project}|${project.weekMonday}`;
      const saved = trackingStatuses.get(key);

      // Generate unique ID
      const id = `project_${project.project}_${project.weekMonday}`.replace(/\s+/g, '_');

      return {
        id,
        project: project.project,
        weekMonday: project.weekMonday,
        department: project.department,
        source: project.source,
        trackingStatus: saved ? saved.trackingStatus : { ...DEFAULT_TRACKING_STATUS },
        createdAt: new Date().toISOString(),
        updatedAt: saved ? saved.updatedAt : new Date().toISOString()
      };
    });

    logger.info(`✅ Loaded ${projects.length} projects with tracking statuses`);
    return projects;

  } catch (error) {
    logger.error('❌ Failed to load all releasability data:', error);
    throw error;
  }
}
