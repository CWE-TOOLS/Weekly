- always use sub agents when posible for code exploration and code editing to keep context size down

## Available Tools

### Screenshot Tool (`/screenshot`)
Use the `/screenshot` slash command to capture and view the current state of the releasability board. This tool:
- Starts a local HTTP server
- Opens releasability.html in headless browser
- Waits for all data to load from Google Sheets and Supabase
- Captures full-page screenshot as `releasability-screenshot.png`
- Automatically displays the screenshot

**When to use:** Before making changes to the releasability page, or to quickly inspect the current state without manually opening a browser.

**Command:** `/screenshot` or `npm run screenshot`
**Script location:** `tools/screenshot-releasability.js`

