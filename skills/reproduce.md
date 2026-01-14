---
name: reproduce
description: Execute reproduction steps using Chrome DevTools MCP to verify Gutenberg bug reports
allowed_args: issue
allowedTools:
  - Bash
  - Read
  - Write
  - mcp__chrome-devtools__new_page
  - mcp__chrome-devtools__navigate_page
  - mcp__chrome-devtools__take_snapshot
  - mcp__chrome-devtools__take_screenshot
  - mcp__chrome-devtools__click
  - mcp__chrome-devtools__fill
  - mcp__chrome-devtools__fill_form
  - mcp__chrome-devtools__press_key
  - mcp__chrome-devtools__list_console_messages
  - mcp__chrome-devtools__list_network_requests
  - mcp__chrome-devtools__wait_for
  - mcp__chrome-devtools__handle_dialog
  - mcp__chrome-devtools__hover
  - mcp__chrome-devtools__close_page
---

# /reproduce

Execute reproduction steps using Chrome DevTools MCP to verify Gutenberg bug reports.

## Usage

This skill can be used in two ways:

1. **As part of triage pipeline:** Automatically called after blueprint generation
2. **Standalone:** Manually invoked to re-run reproduction with existing data

**Standalone usage examples:**
```
User: "Use the reproduce skill for issue 74447"
User: "Reproduce issue 72364 with existing blueprint"
User: "Re-run reproduction for 73872 to verify the bug"
```

## Arguments

- `issue` (required): Issue number

## Input

**Required files:**
- `.triage/<issue>/<issue>.parsed.json` - Parsed reproduction data (for steps)
- `.triage/<issue>/<issue>.blueprint.json` - Playground blueprint

**Required services:**
- Chrome DevTools MCP server connected
- WordPress Playground CLI available

**If files don't exist:**
- Inform user about missing prerequisites
- Suggest running parse-issue and build-blueprint skills first

## Output

Writes to `.triage/<issue>/<issue>.findings.json`

Screenshots saved to `.triage/<issue>/screenshots/`

**Findings include:**
- Reproduction result (reproduced/not_reproduced/inconclusive)
- Environment details
- Steps executed with success/failure status
- Evidence (console errors, network requests, screenshots)
- Observed vs expected behavior
- Conclusion and recommendations

---

## Process

### 1. Setup

Create screenshots directory:

```bash
mkdir -p .triage/<issue>/screenshots
```

Start Playground with the blueprint:

```bash
./bin/playground.sh start .triage/<issue>.blueprint.json
```

Get Playground URL from running instance and open in Chrome DevTools:

```
mcp__chrome-devtools__new_page with url: <playground_url>
```

### 2. Execute reproduction steps

For each step in `reproduction.steps`, translate natural language into DevTools actions:

| Step Pattern | DevTools Action |
|--------------|-----------------|
| "Visit `/wp-admin/...`" | `navigate_page` with url |
| "Enter `...` in the ... input" | `fill` with uid and value |
| "Click the Save button" | `click` with uid |
| "Notice that ..." | Check for element presence in snapshot |

**Implementation flow:**
1. Use `take_snapshot` to understand page structure (returns uid-based tree)
2. Identify target element by uid from snapshot
3. Perform action (navigate, fill, click, etc.)
4. Take screenshot: `.triage/<issue>/screenshots/0X-<description>.png`

### 3. Collect evidence

Throughout reproduction, collect:

- **Console errors**: `list_console_messages` (paginated - much more efficient than Playwright)
- **Network requests**: `list_network_requests` (focus on failed requests)
- **Screenshots**: After each major action and at final state
- **Page snapshots**: For understanding UI state

### 4. Determine reproduction result

Analyze collected evidence and classify:

| Result | Criteria |
|--------|----------|
| ✅ REPRODUCED | Observed behavior matches reported actual behavior |
| ❌ NOT REPRODUCED | Observed behavior matches expected behavior instead |
| ⚠️ INCONCLUSIVE | Could not complete steps, ambiguous results, or environment issues |

### 5. Report findings

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
  - <error messages>

Network Issues:
  - <failed requests with status codes>

Screenshots:
  📸 .triage/<issue>/screenshots/01-initial-page.png
  📸 .triage/<issue>/screenshots/02-after-action.png
  ...

Observed Behavior:
  <description of what actually happened>

Expected vs Actual:
  Expected: <reproduction.expected>
  Actual: <reproduction.actual>
  Observed: <what we saw>

CONCLUSION:
-----------
<detailed explanation of findings>
```

### 6. Cleanup

Close the browser page:

```
mcp__chrome-devtools__close_page
```

Stop the Playground instance:

```bash
./bin/playground.sh stop
```

---

## Chrome DevTools MCP Tools Reference

### Navigation
- `new_page` - Open URL in new page
- `navigate_page` - Navigate current page (url, back, forward, reload)

### Page Analysis
- `take_snapshot` - Get accessibility tree with uid identifiers (compact format)
- `take_screenshot` - Capture visual evidence

### Interaction
- `click` - Click element by uid
- `fill` - Type text into input by uid
- `fill_form` - Fill multiple fields at once
- `press_key` - Press keyboard keys
- `hover` - Hover over element

### Evidence Collection
- `list_console_messages` - Get paginated console logs (efficient!)
- `list_network_requests` - Get paginated network activity

### Utilities
- `wait_for` - Wait for text to appear
- `handle_dialog` - Accept/dismiss popups
- `close_page` - Close browser page

---

## Chrome DevTools vs Playwright: Key Differences

| Feature | Chrome DevTools | Playwright |
|---------|-----------------|------------|
| Element refs | `uid=1_23` | `ref=e23` |
| Snapshots | Flat, compact | YAML, verbose |
| Console | Paginated (~2KB) | Full dump (~200KB!) |
| Fill input | `fill` with uid | `type` with ref |
| Navigation | `new_page` / `navigate_page` | `browser_navigate` |

---

## WordPress-Specific Patterns

Common WordPress admin element patterns:

| Task | How to Find |
|------|-------------|
| Save button | Look for `button` with "Save" text in snapshot |
| Settings input | Find `textbox` or `input` by label in snapshot |
| Block inserter | Look for button with "Add" in name/description |
| Site Editor navigation | Look for navigation landmarks in snapshot |

Use `take_snapshot` to discover the actual structure - returns compact uid-based tree.

---

## Special Cases

### Site Editor Issues
- Wait for Site Editor to fully load (look for editor elements in snapshot)
- Canvas may be in an iframe - DevTools handles this automatically
- Allow extra time for React to hydrate

### Block Editor Issues
- Wait for editor to load (look for block-editor elements)
- Block controls appear on hover - use `hover` first

---

## Error Handling

| Error | Action |
|-------|--------|
| Element not found | Screenshot current state, report as INCONCLUSIVE |
| Page timeout | Check network/console for errors, report as INCONCLUSIVE |
| Unexpected dialog | Use `handle_dialog` to dismiss |
| Ambiguous step | Note in findings, suggest manual verification |

---

## Screenshot Naming Convention

```
.triage/<issue>/screenshots/
  01-initial-page.png
  02-navigated-to-styles.png
  03-entered-input.png
  04-clicked-save.png
  05-final-state.png
```
