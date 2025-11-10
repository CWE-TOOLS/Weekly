/**
 * Visual Constants
 *
 * Centralized visual values for opacity, animations, and visual effects.
 */

// ============================================================================
// OPACITY VALUES
// ============================================================================

export const OPACITY = {
  /** Drag ghost opacity */
  DRAG_GHOST: 0.9,

  /** Dragging task card opacity */
  DRAGGING_CARD: 0.3,

  /** Original card preview opacity */
  CARD_PREVIEW: 0.5,
};

// ============================================================================
// ANIMATION DURATIONS (milliseconds)
// ============================================================================

export const ANIMATION_DURATION = {
  /** Modal fade animation duration (ms) */
  MODAL_FADE: 300,

  /** Slide-in animation duration (ms) */
  SLIDE_IN: 500,

  /** Notification animation duration (ms) */
  NOTIFICATION: 2000,
};

// ============================================================================
// ANIMATION TIMING & DELAYS
// ============================================================================

export const ANIMATION_CONFIG = {
  /** Card animation delay step (seconds per index) */
  CARD_DELAY_STEP_S: 0.1,

  /** Drag ghost rotation degree */
  DRAG_GHOST_ROTATION_DEG: 2,
};
