# Repro Runner Skill

Execute reproduction steps using Playwright MCP to verify Gutenberg bug reports.

## Purpose

Automate the execution of parsed reproduction steps against a WordPress Playground instance, capture evidence, and determine if the bug can be reproduced.

## Prerequisites

- Playwright MCP server connected and available
- WordPress Playground instance running (from playground-runner skill)
- Parsed issue data (from issue-parser skill)

## Input

This skill receives:
1. **Issue number** - For naming screenshots and artifacts
2. **Parsed reproduction data** - From the issue-parser skill
   - `reproduction.steps` - Array of steps to execute
   - `reproduction.expected` - Expected behavior
   - `reproduction.actual` - Reported actual behavior
3. **Playground URL** - From playground-runner skill (e.g., `http://127.0.0.1:9400`)

## Process

### 1. Setup

Create the screenshots directory:

```bash
mkdir -p .triage/<issue>/screenshots
```

Initialize Playwright browser if needed and navigate to the Playground URL.

### 2. Execute Reproduction Steps

For each step in `reproduction.steps`, translate natural language into Playwright actions:

#### Navigation Steps

| Step Pattern | Playwright Action |
|--------------|-------------------|
| "Visit `/wp-admin/...`" | Navigate to `{playground_url}/wp-admin/...` |
| "Open the site editor" | Navigate to `{playground_url}/wp-admin/site-editor.php` |
| "Create a new post" | Navigate to `{playground_url}/wp-admin/post-new.php` |
| "Go to Settings" | Navigate and click based on snapshot |

**Implementation:**
```
1. Use mcp_playwright_browser_navigate with full URL
2. Wait for page load
3. Take screenshot: `.triage/<issue>/screenshots/01-<step-description>.png`
```

#### Input/Type Steps

| Step Pattern | Playwright Action |
|--------------|-------------------|
| "Enter `...` in the ... input" | Find input, type text |
| "Type `...` in ..." | Find field, type text |
| "Add text `...`" | Find editor, type text |

**Implementation:**
```
1. Use mcp_playwright_browser_snapshot to understand page structure
2. Identify the target input/textarea by label or placeholder
3. Use mcp_playwright_browser_type with element ref and text
4. Take screenshot: `.triage/<issue>/screenshots/0X-after-input.png`
```

#### Click/Interaction Steps

| Step Pattern | Playwright Action |
|--------------|-------------------|
| "Click the Save button" | Find button, click |
| "Save the changes" | Find save button, click |
| "Open ..." | Find and click target |

**Implementation:**
```
1. Use mcp_playwright_browser_snapshot to find clickable elements
2. Identify button/link by role and name
3. Use mcp_playwright_browser_click with element ref
4. Wait briefly for response
5. Take screenshot: `.triage/<issue>/screenshots/0X-after-click.png`
```

#### Observation Steps

| Step Pattern | Action |
|--------------|--------|
| "Notice that ..." | Check for element presence/absence |
| "Observe ..." | Capture current state |
| "Open the network tab" | Start monitoring network requests |

**Implementation:**
```
1. Use mcp_playwright_browser_snapshot to verify UI state
2. Use mcp_playwright_browser_network_requests to check HTTP responses
3. Use mcp_playwright_browser_console_messages to check for errors
4. Take screenshot: `.triage/<issue>/screenshots/0X-observation.png`
```

### 3. Collect Evidence

Throughout reproduction, collect:

#### Console Errors
```
Use: mcp_playwright_browser_console_messages with level="error"
Capture: JavaScript errors, warnings, and relevant console output
```

#### Network Requests
```
Use: mcp_playwright_browser_network_requests with includeStatic=false
Focus on: Failed requests (400, 403, 404, 500, etc.)
         REST API calls
         GraphQL requests
```

#### Screenshots
```
Use: mcp_playwright_browser_take_screenshot
Save to: .triage/<issue>/screenshots/0X-<description>.png
Timing: - Initial page load
        - After each major action
        - When observing unexpected behavior
        - Final state
```

#### Page Snapshots
```
Use: mcp_playwright_browser_snapshot
Purpose: Understanding page structure for element targeting
         Verifying UI state matches expected/actual behavior
```

### 4. Determine Reproduction Result

Analyze collected evidence and classify:

#### ✅ REPRODUCED
- Observed behavior matches reported actual behavior
- Evidence confirms the bug (e.g., 400 error, missing error message, incorrect output)
- All reproduction steps completed successfully

#### ❌ NOT REPRODUCED
- Observed behavior matches expected behavior instead
- Bug does not occur in test environment
- All steps completed but issue not seen

#### ⚠️ INCONCLUSIVE
- Could not complete all reproduction steps (element not found, timeout)
- Ambiguous steps that couldn't be automated
- Environment mismatch preventing reproduction
- Partial completion with unclear results

### 5. Report Findings

Output structured results:

```
REPRODUCTION ATTEMPT COMPLETED
================================

Issue: #<issue>
Playground: <url>
Steps Attempted: <count> of <total>

RESULT: [REPRODUCED | NOT REPRODUCED | INCONCLUSIVE]

EVIDENCE:
---------

Console Errors:
  - <error message 1>
  - <error message 2>

Network Issues:
  - <failed request> (status: 400, endpoint: /wp-json/...)
  
Screenshots:
  📸 .triage/<issue>/screenshots/01-initial-page.png
  📸 .triage/<issue>/screenshots/02-after-input.png
  📸 .triage/<issue>/screenshots/03-after-save.png
  ... (all screenshots listed)

Observed Behavior:
  <description of what actually happened>

Expected vs Actual:
  Expected: <reproduction.expected>
  Actual: <reproduction.actual>
  Observed: <what we saw>

CONCLUSION:
-----------
<detailed explanation of findings>

NEXT STEPS:
-----------
<recommended actions if inconclusive>
```

### 6. Cleanup

Stop the Playground instance:

```bash
./bin/playground.sh stop
```

## Playwright MCP Tools Reference

### Navigation
- `mcp_playwright_browser_navigate` - Go to URL
- `mcp_playwright_browser_navigate_back` - Go back

### Page Analysis
- `mcp_playwright_browser_snapshot` - Get accessibility tree (better than screenshot for automation)
- `mcp_playwright_browser_take_screenshot` - Capture visual evidence

### Interaction
- `mcp_playwright_browser_click` - Click element
- `mcp_playwright_browser_type` - Type text into input
- `mcp_playwright_browser_press_key` - Press keyboard keys
- `mcp_playwright_browser_fill_form` - Fill multiple fields at once

### Evidence Collection
- `mcp_playwright_browser_console_messages` - Get console logs/errors
- `mcp_playwright_browser_network_requests` - Get network activity

### Utilities
- `mcp_playwright_browser_wait_for` - Wait for text/time
- `mcp_playwright_browser_evaluate` - Execute JavaScript

## Translation Strategies

### Smart Step Parsing

Use pattern matching and NLP to interpret steps:

```
Step: "Visit `/wp-admin/site-editor.php?p=%2Fstyles&section=%2Fcss`"
→ Navigate to: http://127.0.0.1:9400/wp-admin/site-editor.php?p=%2Fstyles&section=%2Fcss

Step: "Enter `/* </style> */` in the additional CSS input"
→ 1. Snapshot page
   2. Find element matching "additional CSS" or "css" input
   3. Type: /* </style> */
   4. Screenshot

Step: "Save the changes"
→ 1. Snapshot page
   2. Find button with role="button" and name matching "save" or "publish"
   3. Click button
   4. Wait 1-2 seconds
   5. Screenshot
```

### Handling Ambiguous Steps

When a step cannot be automated:

1. Report it clearly: "Step X could not be automated: '<step text>'"
2. Take a screenshot of current state
3. Mark reproduction as INCONCLUSIVE
4. Suggest manual verification

### WordPress-Specific Knowledge

Common WordPress admin patterns:

| Task | How to Find |
|------|-------------|
| Save button | `button[name="save"]`, `.editor-post-publish-button`, `button:has-text("Save")` |
| Settings input | Look for `label` text, then find associated `input` |
| Block inserter | `.block-editor-inserter__toggle`, `button[aria-label*="Add"]` |
| Site Editor navigation | `.edit-site-*` classes, navigation landmarks |

Use `mcp_playwright_browser_snapshot` to discover the actual structure rather than assuming.

## Error Handling

### Element Not Found
```
1. Take screenshot of current page state
2. Log the element we were looking for
3. Check if page loaded correctly
4. Report as INCONCLUSIVE with details
```

### Timeout Waiting for Page
```
1. Check network requests for failures
2. Check console for JavaScript errors
3. Take screenshot
4. Report as INCONCLUSIVE - environment issue
```

### Playwright Connection Lost
```
1. Attempt to reconnect
2. If fails, stop Playground
3. Report error to user
4. Suggest restarting
```

### Unexpected Popup/Dialog
```
1. Use mcp_playwright_browser_handle_dialog to dismiss
2. Log that dialog appeared
3. Continue reproduction
4. Note in findings
```

## Screenshot Management

### Naming Convention

Use sequential numbering with descriptive names:

```
.triage/<issue>/screenshots/
  01-initial-page.png          # First page load
  02-navigated-to-styles.png   # After navigation
  03-entered-css-input.png     # After entering CSS
  04-opened-network-tab.png    # Before critical action
  05-clicked-save.png          # After save click
  06-final-state.png           # End result
```

### When to Screenshot

**Always:**
- Initial page load after first navigation
- After each user action (click, type, select)
- Final state before stopping

**Conditionally:**
- When observing specific behavior mentioned in steps
- When errors occur
- When element cannot be found (show what was visible)

### Screenshot Metadata

Keep track of screenshots in the evidence report:
- Filename
- Step number it corresponds to
- Brief description
- Timestamp or sequence number

## Special Cases

### Site Editor Issues

The Site Editor is an iframe-heavy React app:

1. Wait for Site Editor to fully load (look for `.edit-site-visual-editor`)
2. Canvas may be in an iframe - Playwright handles this automatically
3. Styles panel may need explicit opening
4. Allow extra time for React to hydrate

### Block Editor Issues

When working with the block editor:

1. Wait for editor to load (`.block-editor`)
2. Use snapshot to find block inserter and blocks
3. Block controls appear on hover - use `mcp_playwright_browser_hover` first
4. Toolbar buttons may be in floating toolbars

### Classic Editor Issues

If issue requires Classic Editor (rare):

1. Check for `<textarea#content>`
2. May need to activate classic editor plugin in blueprint
3. Different UI patterns than Block Editor

## Integration with Triage Command

The triage command orchestrates this skill:

1. **issue-parser** extracts reproduction data
2. **blueprint-builder** creates environment config
3. **playground-runner** starts Playground
4. **repro-runner** (this skill) executes steps and reports
5. **playground-runner** stops Playground

## Testing

To test this skill in isolation:

```bash
# Start a playground manually
./bin/playground.sh start --blueprint=.triage/74447.blueprint.json

# Get the URL
URL=$(./bin/playground.sh url)

# Run reproduction with parsed fixture
# (skill receives parsed data from fixtures/parsed-issues/74447.json)

# Stop when done
./bin/playground.sh stop
```

## Output Example

```
REPRODUCTION ATTEMPT COMPLETED
================================

Issue: #74447
Playground: http://127.0.0.1:9400
Steps Attempted: 6 of 6

RESULT: ✅ REPRODUCED

EVIDENCE:
---------

Console Errors:
  (none)

Network Issues:
  - POST /wp-json/wp/v2/global-styles/123 (status: 400)
    Response: {"code":"rest_invalid_param","message":"Invalid parameter(s): styles"}

Screenshots:
  📸 .triage/74447/screenshots/01-initial-page.png
  📸 .triage/74447/screenshots/02-navigated-to-css-section.png
  📸 .triage/74447/screenshots/03-entered-malformed-css.png
  📸 .triage/74447/screenshots/04-clicked-save-button.png
  📸 .triage/74447/screenshots/05-after-save-no-error.png

Observed Behavior:
  - Navigated to Global Styles → Additional CSS section
  - Entered `/* </style> */` in CSS textarea
  - Clicked Save button
  - Network request failed with 400 status
  - NO error message displayed to user
  - UI shows no indication of failure

Expected vs Actual:
  Expected: Error messages should be displayed when save fails
  Actual: No error message is displayed, save silently fails with HTTP 400
  Observed: ✅ Matches reported behavior - no error shown despite 400 response

CONCLUSION:
-----------
Bug successfully reproduced. The Additional CSS save operation fails with HTTP 400
when invalid CSS (specifically `/* </style> */`) is entered, but the UI does not
display any error message to the user. The silent failure matches the reported issue.

Stopping Playground...
```
