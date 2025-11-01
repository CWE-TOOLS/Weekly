# Task Completion Checklist

## When a Task is Completed

### 1. Code Quality Checks
- [ ] No console errors in browser DevTools
- [ ] No console warnings (unless documented/intentional)
- [ ] All imports use `.js` extension
- [ ] Named exports used (no default exports)
- [ ] `logger.*` used instead of `console.*`
- [ ] JSDoc comments added for public APIs
- [ ] Code follows kebab-case naming for files
- [ ] Module size < 500 lines (ideally 200-300)

### 2. Functionality Testing (Manual)
- [ ] Feature initializes without errors
- [ ] Feature responds to user interactions correctly
- [ ] Feature emits expected events (verify with `eventBus`)
- [ ] Feature listens to relevant events
- [ ] Works after week navigation (prev/next week)
- [ ] Works after modal open/close cycles
- [ ] Works with keyboard shortcuts (if applicable)

### 3. Integration Testing
- [ ] Test with Google Sheets data source
- [ ] Test with Supabase data source
- [ ] Test with both data sources failing (graceful degradation)
- [ ] Test offline behavior (network disconnect)
- [ ] Test real-time sync (multiple browser tabs)
- [ ] Test with different departments filtered
- [ ] Test with search active

### 4. Performance Checks
- [ ] No layout thrashing (use `grid-layout-manager` for batch updates)
- [ ] Expensive operations debounced/throttled
- [ ] No memory leaks (DevTools Memory profiler)
- [ ] Render operations cached when possible
- [ ] Check `performanceMonitor.getMetrics()` for timing

### 5. Cross-Browser Testing
- [ ] Chrome (primary target)
- [ ] Firefox
- [ ] Edge
- [ ] Safari (if accessible)

### 6. Responsive Design
- [ ] Works on desktop (1920x1080+)
- [ ] Works on tablet (768px+)
- [ ] Works on mobile (375px+)
- [ ] Print layout works (if print-related)

### 7. Documentation Updates
- [ ] Update `ARCHITECTURE.md` if architecture changed
- [ ] Update `README.md` if user-facing feature
- [ ] Update `CLAUDE.md` if AI workflow changed
- [ ] Add JSDoc comments for new public APIs
- [ ] Document new events in event-bus section

### 8. Git Workflow
- [ ] Stage changes: `git add .` (or specific files)
- [ ] Commit with descriptive message: `git commit -m "Add feature X"`
- [ ] Push to remote: `git push`
- [ ] Create pull request if using branching workflow

### 9. Security Checks
- [ ] No API credentials hardcoded
- [ ] User input sanitized (XSS prevention)
- [ ] No SQL injection risks (if database queries)
- [ ] CORS configured correctly
- [ ] Row Level Security enabled on Supabase

### 10. Backward Compatibility
- [ ] Existing features still work
- [ ] LocalStorage schema compatible
- [ ] Events backward compatible
- [ ] State structure compatible
- [ ] No breaking API changes (unless version bump)

## Specific Checks by Feature Type

### For Modals
- [ ] Lazy loaded via `modal-loader.js`
- [ ] Closes on Escape key
- [ ] Closes on overlay click
- [ ] Focus trapped inside modal
- [ ] Emits `modal:opened` and `modal:closed` events
- [ ] Cleanup on close (event listeners removed)

### For UI Components
- [ ] Registered with event-bus listeners
- [ ] Cleanup on destroy
- [ ] Responsive design implemented
- [ ] Accessibility attributes (ARIA)

### For Services
- [ ] Error handling with try/catch
- [ ] Logging at appropriate levels
- [ ] Retry logic for transient failures
- [ ] Graceful degradation if service unavailable
- [ ] Timeout handling

### For Utilities
- [ ] Pure functions (no side effects)
- [ ] Well-documented with examples
- [ ] Edge cases handled
- [ ] Input validation

### For Print Features
- [ ] Single-page output verified
- [ ] Auto-scaling works correctly
- [ ] Content not cut off
- [ ] Readable fonts and spacing
- [ ] Preview matches print output

## Before Marking Task Complete
1. Run through relevant checklist items above
2. Test in browser with realistic data
3. Check console for errors/warnings
4. Verify `window.getAppStatus()` shows healthy state
5. Test undo/redo if applicable
6. Commit changes to git

## Reporting Issues Found
If issues found during checklist:
1. Log in browser console: `logger.error('Issue description', error)`
2. Check `error-handler.js` for global error catching
3. Use `performance-monitor.js` for timing issues
4. Document in comments for future reference