import { logger } from '../../utils/logger.js';

let modalElement = null;

/**
 * Creates and injects the reload modal into the DOM.
 * @private
 */
function createReloadModalDOM() {
  if (document.getElementById('reload-modal')) return;

  const modalHTML = `
    <div id="reload-modal" class="reload-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Update Required</h2>
        </div>
        <div class="modal-body">
          <p>A new version of the application is available. Please reload to get the latest features and improvements.</p>
        </div>
        <div class="modal-footer">
          <button id="reload-confirm-btn" class="button primary-button">Reload & Update</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);
  modalElement = document.getElementById('reload-modal');
}

/**
 * Displays the reload modal.
 * @param {object} options - The options for the modal.
 * @param {function} options.onConfirm - The function to call when the user confirms.
 */
export function showReloadModal({ onConfirm }) {
  if (!modalElement) {
    createReloadModalDOM();
  }

  if (modalElement.classList.contains('show')) {
    logger.log('Reload modal is already open.');
    return;
  }

  modalElement.classList.add('show');

  const confirmButton = document.getElementById('reload-confirm-btn');
  if (confirmButton) {
    // Use a fresh event listener to avoid stacking them
    confirmButton.onclick = () => {
      confirmButton.textContent = 'Reloading...';
      confirmButton.disabled = true;
      if (typeof onConfirm === 'function') {
        onConfirm();
      }
    };
  } else {
    logger.error('Could not find the confirm button in the reload modal.');
  }
}

/**
 * Hides the reload modal if it is open.
 */
export function hideReloadModal() {
  if (modalElement && modalElement.classList.contains('show')) {
    modalElement.classList.remove('show');
  }
}