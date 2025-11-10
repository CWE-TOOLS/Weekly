/**
 * Test file for releasability state and config
 * Run this in the browser console to verify the setup works
 *
 * Usage: Open releasability.html (when created) and run this script
 */

import {
  STATUS,
  TRACKING_ITEMS,
  DEFAULT_TRACKING_STATUS,
  PROJECT_SOURCE,
  GRID_CONFIG
} from '../../config/releasability-config.js';

import {
  getAllProjects,
  addProject,
  updateProjectStatus,
  getProjectById,
  getNextStatus,
  getProjectCompletion,
  clearState,
  getStateSnapshot,
  RELEASABILITY_EVENTS
} from './releasability-state.js';

import { on } from '../../core/event-bus.js';

// ============================================================================
// VERIFICATION TESTS
// ============================================================================

console.group('🧪 Releasability State & Config Tests');

// Test 1: Config Constants
console.group('✅ Test 1: Configuration Constants');
console.log('STATUS:', STATUS);
console.log('Number of tracking items:', TRACKING_ITEMS.length);
console.log('First tracking item:', TRACKING_ITEMS[0]);
console.log('Last tracking item:', TRACKING_ITEMS[TRACKING_ITEMS.length - 1]);
console.log('Default tracking status keys:', Object.keys(DEFAULT_TRACKING_STATUS).length);
console.log('Grid config:', GRID_CONFIG);
console.groupEnd();

// Test 2: Initial State
console.group('✅ Test 2: Initial State');
const initialProjects = getAllProjects();
console.log('Initial projects count:', initialProjects.length);
console.log('State snapshot:', getStateSnapshot());
console.groupEnd();

// Test 3: Add Project
console.group('✅ Test 3: Add Project');

// Listen for events
const unsubProjectAdded = on(RELEASABILITY_EVENTS.PROJECT_ADDED, (data) => {
  console.log('📢 Event received: PROJECT_ADDED', data);
});

const testProject = addProject({
  project: 'Test Project Alpha',
  weekMonday: '2025-11-10',
  department: 'Cast',
  source: PROJECT_SOURCE.MANUAL
});

console.log('Added project:', testProject);
console.log('Project has ID:', !!testProject.id);
console.log('Project has default tracking status:', Object.keys(testProject.trackingStatus).length === TRACKING_ITEMS.length);
console.log('All projects count:', getAllProjects().length);
console.groupEnd();

// Test 4: Update Status
console.group('✅ Test 4: Update Project Status');

const unsubStatusUpdated = on(RELEASABILITY_EVENTS.STATUS_UPDATED, (data) => {
  console.log('📢 Event received: STATUS_UPDATED', data);
});

const firstItem = TRACKING_ITEMS[0];
const updatedProject = updateProjectStatus(testProject.id, firstItem, STATUS.IN_PROGRESS);
console.log(`Updated "${firstItem}" to IN_PROGRESS`);
console.log('New status:', updatedProject.trackingStatus[firstItem]);

// Test status cycling
const nextStatus = getNextStatus(STATUS.IN_PROGRESS);
console.log('Next status after IN_PROGRESS:', nextStatus);
console.groupEnd();

// Test 5: Project Completion
console.group('✅ Test 5: Project Completion Percentage');
const completionBefore = getProjectCompletion(testProject.id);
console.log('Completion before:', completionBefore + '%');

// Mark a few items as complete
updateProjectStatus(testProject.id, TRACKING_ITEMS[0], STATUS.COMPLETE, true);
updateProjectStatus(testProject.id, TRACKING_ITEMS[1], STATUS.COMPLETE, true);
updateProjectStatus(testProject.id, TRACKING_ITEMS[2], STATUS.COMPLETE, true);

const completionAfter = getProjectCompletion(testProject.id);
console.log('Completion after marking 3 items complete:', completionAfter + '%');
console.log('Expected:', Math.round((3 / TRACKING_ITEMS.length) * 100) + '%');
console.groupEnd();

// Test 6: Project Retrieval
console.group('✅ Test 6: Project Retrieval');
const retrievedProject = getProjectById(testProject.id);
console.log('Retrieved by ID:', !!retrievedProject);
console.log('Project name matches:', retrievedProject.project === 'Test Project Alpha');
console.groupEnd();

// Test 7: Add Second Project for Same Week
console.group('✅ Test 7: Multiple Projects Same Week');
const testProject2 = addProject({
  project: 'Test Project Beta',
  weekMonday: '2025-11-10',
  department: 'Mill',
  source: PROJECT_SOURCE.SHEETS
}, true);

console.log('Added second project (silent)');
console.log('Total projects:', getAllProjects().length);

import { getProjectsByWeek } from './releasability-state.js';
const weekProjects = getProjectsByWeek('2025-11-10');
console.log('Projects for week 2025-11-10:', weekProjects.length);
console.groupEnd();

// Test 8: State Snapshot
console.group('✅ Test 8: State Snapshot');
const finalSnapshot = getStateSnapshot();
console.log('Final state snapshot:', finalSnapshot);
console.groupEnd();

// Test 9: Cleanup
console.group('✅ Test 9: Cleanup');
clearState(true);
console.log('State cleared');
console.log('Projects after clear:', getAllProjects().length);

// Unsubscribe from events
unsubProjectAdded();
unsubStatusUpdated();
console.log('Event listeners removed');
console.groupEnd();

console.groupEnd();

console.log('\n✨ All tests completed! Check results above.');
console.log('State and config are working correctly.\n');
