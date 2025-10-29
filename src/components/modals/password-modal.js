/**
 * Password Modal Component
 * Handles password entry for unlocking editing mode
 * @module components/modals/password-modal
 */

// Imports
import { getIsEditingUnlocked, setIsEditingUnlocked } from '../../core/state.js';
import { emit, EVENTS } from '../../core/event-bus.js';
import { saveState } from '../../core/storage.js';
import { EDIT_PASSWORD } from '../../config/constants.js';

// Private state
let modalElement = null;
let passwordInput = null;
let submitButton = null;
let cancelButton = null;
let closeButton = null;

/**
 * Initialize password modal
 * Sets up event listeners and references to DOM elements
 */
export function initializePasswordModal() {
    // Get modal element
    modalElement = document.getElementById('password-modal');
    passwordInput = document.getElementById('password-input');
    submitButton = document.getElementById('password-submit');
    cancelButton = document.getElementById('password-cancel');
    closeButton = document.getElementById('password-close');

    if (!modalElement || !passwordInput || !submitButton) {
        console.error('Password modal elements not found in DOM');
        return;
    }

    // Set up event listeners
    submitButton.addEventListener('click', handlePasswordSubmit);
    cancelButton.addEventListener('click', hidePasswordModal);
    closeButton.addEventListener('click', hidePasswordModal);

    // Close modal on background click
    modalElement.addEventListener('click', (e) => {
        if (e.target === modalElement) {
            hidePasswordModal();
        }
    });

    // Submit on Enter key
    passwordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            handlePasswordSubmit();
        }
    });

    console.log('Password modal initialized');
}

/**
 * Show password prompt for editing unlock
 * @returns {void}
 */
export function showPasswordModal() {
    if (!modalElement) {
        console.error('Password modal not initialized');
        return;
    }

    modalElement.classList.add('show');
    document.body.style.overflow = 'hidden';

    // Focus password input after modal is shown
    setTimeout(() => {
        if (passwordInput) {
            passwordInput.focus();
        }
    }, 100);

    // Emit event
    emit(EVENTS.MODAL_OPENED, { modalName: 'password-modal' });
}

/**
 * Hide password modal
 * @returns {void}
 */
export function hidePasswordModal() {
    if (!modalElement) return;

    modalElement.classList.remove('show');
    document.body.style.overflow = '';

    // Clear password input
    if (passwordInput) {
        passwordInput.value = '';
    }

    // Emit event
    emit(EVENTS.MODAL_CLOSED, { modalName: 'password-modal' });
}

/**
 * Handle password submission
 * Validates password and unlocks editing if correct
 * @private
 */
function handlePasswordSubmit() {
    if (!passwordInput) return;

    const password = passwordInput.value;

    if (password && password.trim().toLowerCase() === EDIT_PASSWORD.toLowerCase()) {
        // Password is correct - unlock editing
        setIsEditingUnlocked(true);

        // Save to localStorage
        saveState('editingUnlocked', true);

        // Hide modal
        hidePasswordModal();

        // Update UI buttons
        updateEditingButtons();

        // Emit editing unlocked event
        emit(EVENTS.EDITING_UNLOCKED);

        // Enable add card indicators
        if (window.enableAddCardIndicators) {
            window.enableAddCardIndicators();
        }

        console.log('Editing unlocked successfully');
    } else {
        // Incorrect password
        alert('Incorrect password. Editing remains locked.');
        passwordInput.focus();
    }
}

/**
 * Update UI buttons based on editing state
 * @private
 */
function updateEditingButtons() {
    // Update main editing button
    const mainEditingBtn = document.getElementById('main-editing-btn');
    const unlockIcon = document.getElementById('unlock-icon');
    const lockIcon = document.getElementById('lock-icon');

    if (mainEditingBtn && unlockIcon && lockIcon) {
        const isUnlocked = getIsEditingUnlocked();
        mainEditingBtn.classList.toggle('unlocked', isUnlocked);
        unlockIcon.style.display = isUnlocked ? 'none' : 'block';
        lockIcon.style.display = isUnlocked ? 'block' : 'none';
        mainEditingBtn.setAttribute('aria-label', isUnlocked ? 'Lock Editing' : 'Unlock Editing');
    }

    // Update project modal buttons if modal is open
    const projectModal = document.getElementById('project-modal');
    if (projectModal && projectModal.classList.contains('show')) {
        const unlockBtn = document.getElementById('unlock-editing-btn');
        const editBtn = document.getElementById('edit-plan-btn');
        const lockBtn = document.getElementById('lock-editing-btn');

        if (unlockBtn && editBtn && lockBtn) {
            const isUnlocked = getIsEditingUnlocked();
            unlockBtn.style.display = isUnlocked ? 'none' : 'inline-block';
            editBtn.style.display = isUnlocked ? 'inline-block' : 'none';
            lockBtn.style.display = isUnlocked ? 'inline-block' : 'none';
        }
    }
}

/**
 * Lock editing mode
 * Publicly accessible function to lock editing
 */
export function lockEditing() {
    setIsEditingUnlocked(false);
    saveState('editingUnlocked', false);
    updateEditingButtons();

    // Disable add card indicators
    if (window.enableAddCardIndicators) {
        window.enableAddCardIndicators();
    }

    // Emit editing locked event
    emit(EVENTS.EDITING_LOCKED);

    console.log('Editing locked');
}

/**
 * Check if editing is currently unlocked
 * @returns {boolean} True if editing is unlocked
 */
export function isEditingUnlocked() {
    return getIsEditingUnlocked();
}
