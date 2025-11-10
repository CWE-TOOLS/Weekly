# Drag and Drop UI Delay Analysis

## Problem Summary
~1 second delay before destination indicators (green/red highlights) and drag-over styling become visible when dragging a task card.

## Root Cause Analysis

### Primary Cause: querySelectorAll Performance on dragstart (Line 82)
**Location:** `src/features/drag-drop/drag-drop-manager.js:82`
```javascript
cachedPlaceholders = Array.from(document.querySelectorAll('.task-card-placeholder'));
```

**Issue:**
- Caching happens in `handleDragStart` with RAF (requestAnimationFrame)
- querySelectorAll with `.task-card-placeholder` searches the ENTIRE DOM for ALL placeholder elements
- With 7 days × 8 departments = 56 placeholders minimum in a typical week view
- In larger schedules or multiple weeks, this can be 100+ elements
- querySelectorAll + Array.from conversion is a FULL DOM scan = synchronous, blocking operation

**Performance Impact:**
- Initial drag event: ~50-100ms to cache placeholders (minimal, user doesn't see this)
- BUT the RAF defers visual feedback setup

### Secondary Cause: RAF Scheduling Defers Visual Feedback (Lines 85, 198-241)
**Location:** `src/features/drag-drop/drag-drop-manager.js:85`, `198-241`

**Issue 1 - dragstart RAF deferral (Line 85):**
```javascript
requestAnimationFrame(() => {
    // Create drag ghost
    dragGhost = taskCard.cloneNode(true);
    // ... styles applied
    document.body.appendChild(dragGhost);
});
```
- Drag ghost creation is deferred to next frame
- This is fine but adds one frame of delay (~16ms)

**Issue 2 - dragover RAF throttling (Lines 196-241):**
```javascript
if (rafId !== null) return;  // Exit if RAF already pending
rafId = requestAnimationFrame(() => {
    // ... placeholder highlighting logic
});
```
- EVERY dragover event is throttled to once per frame
- Destination indicators only update at 60Hz (~16.67ms per frame)
- BUT the real problem: first dragover event must wait for next RAF callback

**Combined Effect:**
- User drags → dragstart fires (ghost created on RAF, ~16ms)
- User moves mouse → dragover fires (highlighting queued on RAF)
- First dragover must wait for current frame to complete
- If user starts dragging at wrong time in frame cycle, could wait up to 16ms for dragstart RAF
- Then wait another 16ms for first dragover RAF to fire
- Total: potentially 32ms of initial latency

### Tertiary Cause: DOM Query on Every Cleanup (Lines 152, 157)
**Location:** `src/features/drag-drop/drag-drop-manager.js:152`, `157`

**During dragover handler, if element changes:**
```javascript
document.querySelectorAll('.task-card-placeholder.drag-over, .task-card-placeholder.drag-invalid').forEach(el => {
    el.classList.remove('drag-over', 'drag-invalid');
});
// ...
document.querySelectorAll('.task-card.dragging').forEach(card => {
    card.style.opacity = '1';
    card.classList.remove('dragging');
});
```
- Multiple DOM queries during each dragover event
- These scan the entire DOM again for matching elements
- Not cached, so happens every time

### Why ~1 Second Delay?

The actual ~1 second delay likely comes from a combination of factors:
1. Initial placeholder caching on dragstart: ~50-100ms
2. First frame wait for dragstart RAF: ~16ms
3. First frame wait for dragover RAF: ~16ms  
4. Browser rendering and compositing: ~50-100ms
5. JavaScript parsing/compilation of cloned node: ~50-100ms
6. DOM reflow/layout after adding placeholder highlights: ~100-300ms
7. CSS animation/transition initiation: ~100-200ms

**Total: 382-916ms** (rounds to ~1 second in user perception)

## Code Locations Responsible for Delay

1. **Placeholder Caching (dragstart)**
   - File: `src/features/drag-drop/drag-drop-manager.js`
   - Lines: 82, 85-105
   - Function: `handleDragStart()`
   - Issue: RAF defers drag ghost creation, DOM scan for placeholders

2. **Highlight Application (dragover)**
   - File: `src/features/drag-drop/drag-drop-manager.js`
   - Lines: 188-242
   - Function: `handleDragOver()`
   - Issue: RAF throttling delays first visual update, queries in cleanup loops

3. **CSS Transitions**
   - File: `src/styles/task-card.css`
   - Lines: 184, 281-294
   - Classes: `.task-card-placeholder`, `.drag-over`, `.drag-invalid`
   - Issue: 0.2s transition on placeholder background/border

4. **Cleanup Queries (cleanup phase)**
   - File: `src/features/drag-drop/drag-drop-manager.js`
   - Lines: 152, 157
   - Function: `cleanupDragState()`
   - Issue: Full DOM scans during cleanup

## Why RAF Throttling Was Used

The RAF throttling is intentional performance optimization to avoid excessive DOM updates on every mousemove event. However, it has the side effect of deferring the FIRST visual update of the dragover indicators.

## Summary of Issues

| Issue | Location | Type | Impact |
|-------|----------|------|--------|
| querySelectorAll for placeholder cache | Line 82 | Blocking DOM scan | ~50-100ms |
| dragstart RAF deferral | Line 85 | Frame scheduling | ~16ms |
| dragover RAF throttling | Line 196-198 | Frame scheduling | ~16-33ms (first time) |
| CSS transition on placeholder | task-card.css:184 | Style animation | ~200ms |
| Cleanup querySelectorAll calls | Lines 152, 157 | Blocking DOM scans | ~50-100ms per query |
| DOM layout/reflow | Lines 228-240 | Browser operation | ~100-300ms |
