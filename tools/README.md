# Tools Directory

This directory contains utility scripts and tools for the Weekly Schedule project.

## Available Tools

### screenshot-releasability.js

Captures a screenshot of the releasability board for quick inspection.

**Usage:**
```bash
npm run screenshot
```

**What it does:**
1. Starts a local Python HTTP server on port 8765
2. Opens releasability.html in a headless Chromium browser via Puppeteer
3. Waits for all data to load from Google Sheets and Supabase
4. Captures a full-page screenshot
5. Saves as `releasability-screenshot.png` in the project root
6. Cleans up the HTTP server

**Requirements:**
- Node.js
- Puppeteer (installed via npm)
- Python 3 (for http.server)

**For Claude Code:**
Use the `/screenshot` slash command to automatically run this tool and view the result.

## Adding New Tools

When adding new tools to this directory:
1. Create the script in `tools/`
2. Add an npm script in `package.json` if appropriate
3. Consider creating a slash command in `.claude/commands/` for easy Claude Code access
4. Update this README
5. Update `CLAUDE.md` if the tool is important for Claude to know about
