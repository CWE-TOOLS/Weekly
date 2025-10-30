# Claude Code Navigation System

This directory contains documentation specifically designed to help Claude Code efficiently understand and navigate this codebase.

## Overview

This navigation system provides three complementary approaches to help AI assistants quickly understand the project structure, find relevant code, and make informed decisions:

1. **Text-based documentation** (`.claude/*.md` files)
2. **Enhanced module headers** (`@claude-context` in source files)
3. **Dependency maps** (plain text relationship graphs)

## Documentation Files

### Quick Start

**Start here:** `CODEBASE_MAP.md`
- Quick reference for file locations
- Common navigation patterns
- Essential files to understand first
- Directory structure overview
- Troubleshooting guide

### Deep Dive

**Architecture:** `ARCHITECTURE.md`
- High-level system design
- Design patterns used
- Technology stack details
- Data flow diagrams
- Performance considerations
- Architectural decisions and rationale

**Modules:** `MODULE_INDEX.md`
- Comprehensive index of all modules
- Function signatures and purposes
- Dependencies for each module
- Usage examples
- Module categories and organization

**Tasks:** `COMMON_TASKS.md`
- Task-based navigation ("How do I...")
- Step-by-step guides for common operations
- Files to modify for specific features
- Debugging strategies
- Testing approaches

**Dependencies:** `DEPENDENCY_MAP.md`
- Visual dependency graphs
- Import/export relationships
- Event flow diagrams
- Data flow maps
- Circular dependency detection
- Refactoring opportunities

## How to Use This System

### For Initial Exploration

```
1. Read CODEBASE_MAP.md first (5 minutes)
   → Get oriented with file structure

2. Skim ARCHITECTURE.md (10 minutes)
   → Understand design patterns

3. Reference MODULE_INDEX.md as needed
   → Look up specific modules
```

### For Specific Tasks

```
1. Check COMMON_TASKS.md for your task type
   → Find step-by-step guide

2. Use MODULE_INDEX.md to find relevant modules
   → Get function signatures and usage

3. Check DEPENDENCY_MAP.md if modifying data flow
   → Understand impact of changes
```

### For Bug Fixing

```
1. Use COMMON_TASKS.md debugging section
   → Follow debugging strategy

2. Check DEPENDENCY_MAP.md for data/event flow
   → Trace where bug might originate

3. Use MODULE_INDEX.md to understand affected modules
   → Find functions to inspect
```

### For Adding Features

```
1. Use COMMON_TASKS.md "Adding New Features"
   → Follow implementation guide

2. Check ARCHITECTURE.md for patterns
   → Follow existing patterns

3. Update DEPENDENCY_MAP.md if adding new dependencies
   → Document new relationships
```

## Enhanced Module Headers

Key source files now include `@claude-context` sections in their JSDoc headers:

```javascript
/**
 * Module Name
 *
 * @claude-context
 * @purpose What this module does
 * @dependencies What it depends on
 * @used-by What uses this module
 * @exports What functions/objects it exports
 * @modifies What it changes (state, DOM, DB)
 * @events-emitted What events it publishes
 * @events-listened What events it subscribes to
 * @key-functions Main functions and their purposes
 */
```

### Finding Enhanced Headers

```bash
# Search for all @claude-context annotations
grep -r "@claude-context" src/

# Find a specific module's context
grep -A 20 "@claude-context" src/core/state.js
```

## Navigation Patterns

### Find by Functionality

```bash
# Find authentication code
grep -r "authenticate\|auth" .claude/MODULE_INDEX.md

# Find state management
grep -r "state\.get\|state\.set" .claude/DEPENDENCY_MAP.md

# Find event handling
grep -r "eventBus\.emit" .claude/DEPENDENCY_MAP.md
```

### Find by File Type

```bash
# All services
glob: "src/services/**/*.js"

# All components
glob: "src/components/**/*.js"

# All features
glob: "src/features/**/*.js"
```

### Find by Dependency

```bash
# What uses state.js?
grep "state\.js" .claude/DEPENDENCY_MAP.md

# What does schedule-grid.js depend on?
grep "schedule-grid\.js" .claude/DEPENDENCY_MAP.md
```

## Quick Reference Table

| Need to... | Check this file | Section |
|------------|----------------|---------|
| Find a specific file | CODEBASE_MAP.md | Directory Structure |
| Understand architecture | ARCHITECTURE.md | Design Patterns |
| Look up a module | MODULE_INDEX.md | Module Index |
| Add a feature | COMMON_TASKS.md | Adding New Features |
| Fix a bug | COMMON_TASKS.md | Fixing Bugs |
| Understand data flow | DEPENDENCY_MAP.md | Data Flow Map |
| Find dependencies | DEPENDENCY_MAP.md | Module Dependencies |
| Learn event system | ARCHITECTURE.md | Event System |
| Modify UI | COMMON_TASKS.md | Modifying UI |
| Change config | COMMON_TASKS.md | Configuration Changes |

## Maintenance

### When to Update Documentation

**Update CODEBASE_MAP.md when:**
- Adding/removing major directories
- Changing file organization
- Adding new entry points

**Update ARCHITECTURE.md when:**
- Introducing new design patterns
- Changing architectural layers
- Adding new technologies

**Update MODULE_INDEX.md when:**
- Creating new modules
- Changing module exports
- Modifying key functions

**Update COMMON_TASKS.md when:**
- Adding new feature types
- Discovering new debugging techniques
- Creating new workflows

**Update DEPENDENCY_MAP.md when:**
- Adding new module dependencies
- Creating new event types
- Changing data flow

### Update Commands

```bash
# After adding a new module
# 1. Add entry to MODULE_INDEX.md
# 2. Add to DEPENDENCY_MAP.md if it has dependencies
# 3. Add @claude-context header to source file

# After adding a new feature
# 1. Add to COMMON_TASKS.md "Adding New Features"
# 2. Document in ARCHITECTURE.md if using new patterns

# After refactoring
# 1. Update all dependency references in DEPENDENCY_MAP.md
# 2. Update file paths in CODEBASE_MAP.md
# 3. Update module descriptions in MODULE_INDEX.md
```

## Integration with Main Documentation

This `.claude/` directory complements the existing documentation:

```
.claude/                    # AI-optimized navigation
├── CODEBASE_MAP.md         # Quick reference
├── ARCHITECTURE.md         # System design
├── MODULE_INDEX.md         # Module catalog
├── COMMON_TASKS.md         # How-to guide
└── DEPENDENCY_MAP.md       # Relationships

Documentation/              # Human-focused documentation
├── REFACTORING_PLAN.md     # Project history
├── PHASE_*_BRIEFING.md     # Implementation guides
├── AGENTS.md               # Print system docs
└── card_creation_*.md      # Feature-specific docs
```

**Key Differences:**

- `.claude/` is optimized for **grep/search** by AI
- `Documentation/` is optimized for **reading** by humans
- `.claude/` focuses on **navigation and structure**
- `Documentation/` focuses on **history and implementation**

## Examples

### Example 1: "Where is authentication handled?"

```
1. Check CODEBASE_MAP.md → Services section
   → Points to src/services/auth-service.js

2. Check MODULE_INDEX.md → auth-service.js
   → See functions: authenticate(), getAccessToken()

3. Check DEPENDENCY_MAP.md → Service Dependencies
   → See: auth-service.js ← api-config.js, state.js
```

### Example 2: "How do I add a new modal?"

```
1. Check COMMON_TASKS.md → "Add a New Modal Dialog"
   → Follow step-by-step guide

2. Check ARCHITECTURE.md → Module Architecture
   → See modal component pattern

3. Check MODULE_INDEX.md → project-modal.js
   → Use as template for new modal
```

### Example 3: "Why is data not updating?"

```
1. Check COMMON_TASKS.md → "Fix Data Loading Issues"
   → Follow debugging steps

2. Check DEPENDENCY_MAP.md → Data Flow Map
   → Trace: sheets-service → data-service → state → schedule-grid

3. Check each module in MODULE_INDEX.md
   → Verify each step in the chain
```

## Tips for AI Assistants

1. **Always read CODEBASE_MAP.md first** before making any changes
2. **Use grep commands** from DEPENDENCY_MAP.md to find related code
3. **Check @claude-context headers** in source files for detailed context
4. **Follow patterns** documented in ARCHITECTURE.md
5. **Update docs** when making structural changes
6. **Use event bus** instead of direct coupling (see ARCHITECTURE.md)
7. **Check DEPENDENCY_MAP.md** before adding new dependencies

## Benefits of This System

### For AI Assistants

- ✅ Fast navigation via grep/search
- ✅ Clear module responsibilities
- ✅ Dependency understanding
- ✅ Event flow tracing
- ✅ Pattern consistency
- ✅ Change impact analysis

### For Human Developers

- ✅ Onboarding new developers
- ✅ Understanding complex codebases
- ✅ Refactoring confidence
- ✅ Documentation maintenance
- ✅ Architectural decisions recorded
- ✅ AI assistant efficiency

## Version

**Navigation System Version:** 1.0
**Created:** 2025-10-29
**Last Updated:** 2025-10-29
**Codebase Version:** v2.0 (Phase 8 Complete)

---

For more information about the project itself, see `Documentation/REFACTORING_PLAN.md`.
