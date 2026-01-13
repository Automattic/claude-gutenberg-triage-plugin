---
name: report
description: Summarize reproduction findings for the user
allowed_args: issue
allowedTools:
  - Read
  - Grep
  - Glob
---

# /report

Summarize reproduction findings in a GitHub-comment-friendly format.

## Arguments

- `issue` (required): Issue number

## Input

Reads from:

- `.triage/<issue>.findings.json` (required) - Reproduction results and evidence
- `.triage/<issue>.parsed.json` (optional) - Issue context for better summary

## Output

Console summary formatted as a GitHub comment (concise, markdown-formatted)

---

## Process

### 1. Load data files

Read the findings file:

```bash
cat .triage/<issue>.findings.json
```

Optionally read parsed issue for context:

```bash
cat .triage/<issue>.parsed.json
```

### 2. Extract key information

From `findings.json`:

- `result`: "reproduced" | "not_reproduced" | "inconclusive"
- `environment`: WordPress, Gutenberg, PHP versions tested
- `steps_executed`: Array of executed steps with success/failure status
- `evidence`: Console errors, screenshots, observations
- `limitations`: Any constraints or issues encountered

From `parsed.json` (if available):

- `issue.title`: Bug title for context
- `issue.url`: Link to original issue
- `reproduction.expected`: Expected behavior
- `reproduction.actual`: Reported actual behavior
- `labels`: Issue labels (e.g., `[Feature] Global Styles`, `[Block] Navigation`)

### 3. Format GitHub comment

Structure the output as a concise GitHub comment with the following sections:

#### Header

```markdown
## 🔍 Automated Triage Report

**Issue:** #<issue>
```

#### Environment Summary

Include a dedicated section summarizing the test environment:

```markdown
### Test Environment

**WordPress:** <version>
**Gutenberg:** <version>
**PHP:** <version>
**Theme:** <theme name> (if available from parsed.json)
**Platform:** WordPress Playground
**Browser:** <browser info if available from evidence>
```

Extract environment details from:

- `findings.json.environment`: WordPress, Gutenberg, PHP versions
- `parsed.json.environment.theme`: Theme name (if available)
- `findings.json.evidence`: Browser/platform info if captured during reproduction

**Example:**

```markdown
### Test Environment

**WordPress:** 6.7
**Gutenberg:** 20.0
**PHP:** 8.2
**Theme:** Twenty Twenty-Five (block theme)
**Platform:** WordPress Playground
```

#### Result Summary

Based on `result` field:

**If `reproduced`:**

```markdown
### ✅ Bug Reproduced

The reported issue was successfully reproduced in the test environment.
```

**If `not_reproduced`:**

```markdown
### ❌ Bug Not Reproduced

Unable to reproduce the reported issue with the provided steps.
```

**If `inconclusive`:**

```markdown
### ⚠️ Inconclusive Results

Could not definitively reproduce or rule out the bug due to limitations.
```

#### Reproduction Details (if reproduced)

```markdown
### Reproduction Steps

<Brief summary of steps that successfully reproduced the bug>

**Observed Behavior:**
<What was actually observed that matches the reported bug>
```

#### Error Logs & Console (if reproduced)

If `evidence.console_errors` has entries:

```markdown
### Console Errors

<details>
<summary>View console errors</summary>

\`\`\`
<Each error on a new line>
\`\`\`

</details>
```

If `evidence.network_errors` or failed network requests exist:

```markdown
### Network Errors

<details>
<summary>View network errors</summary>

- `<method> <url>` - Status: `<status>` - `<error message>`

</details>
```

#### Suspect Code References (if reproduced)

Use codebase search to identify likely code locations based on:

- Issue labels (e.g., `[Feature] Global Styles` → search Global Styles code)
- Reproduction steps (e.g., "Additional CSS" → search CSS-related code)
- Error messages (search for error text in codebase)
- Affected features from parsed issue

**Search strategy:**

1. Extract feature/block names from labels
2. Search for relevant files using semantic search
3. Look for error messages in code
4. Identify save/validation functions based on reproduction steps

Format as:

```markdown
### Suspect Code Areas

Based on the reproduction steps and error patterns, the following code areas may be relevant:

- `<file path>` - `<brief reason why this file is suspect>`
- `<file path>` - `<brief reason why this file is suspect>`
```

**Example searches:**

- For Global Styles issues: Search "Global Styles save", "theme.json validation"
- For block issues: Search block name + "save" or "render"
- For CSS issues: Search "Additional CSS", "custom CSS", "saveCSS"

#### Not Reproduced Details (if not_reproduced)

```markdown
### What Was Tested

<Summary of steps executed and what was observed>

**Observed Behavior:**
<What actually happened - should match expected behavior>

**Differences from Report:**
<Any differences in environment, steps, or context that might explain why bug wasn't reproduced>
```

#### Suggestions for Additional Context (if not_reproduced)

```markdown
### Additional Information Needed

To help reproduce this issue, please consider providing:

1. **Specific versions**: Exact WordPress and Gutenberg versions (not just "latest")
2. **Browser/OS details**: Browser version and operating system
3. **Console output**: Any console errors or warnings when reproducing
4. **Network tab**: Failed network requests (status codes, error messages)
5. **Screenshots**: Visual evidence of the bug
6. **Step-by-step video**: Screen recording of the reproduction
7. **Plugin conflicts**: List of active plugins (if any)
8. **Custom code**: Any custom PHP/JavaScript that might affect behavior
```

#### Limitations (if present)

If `limitations` field has content:

```markdown
### Limitations

<limitations content>
```

#### Evidence Files (if screenshots exist)

```markdown
### Screenshots

Screenshots captured during reproduction:

- `.triage/<issue>/screenshots/<filename>.png`
```

### 4. Output to console

Print the formatted markdown to console. Keep the output concise - aim for 50-100 lines maximum for GitHub comment readability.

---

## Formatting Guidelines

### Keep it concise

- GitHub comments should be scannable
- Use bullet points and short paragraphs
- Avoid walls of text

### Use markdown effectively

- Headers for structure (`##`, `###`)
- Code blocks for errors/logs
- Details/summary for collapsible sections
- Lists for steps and suggestions

### Be helpful

- Focus on actionable information
- Provide specific file paths for code references
- Suggest concrete next steps
- Be respectful and constructive

### Evidence-based

- Reference specific observations from findings
- Include actual error messages
- Link to screenshots when available
- Cite specific steps that reproduced the issue

---

## Example Output Structure

```markdown
## 🔍 Automated Triage Report

**Issue:** #74447

### Test Environment

**WordPress:** 6.7
**Gutenberg:** 20.0
**PHP:** 8.2
**Theme:** Twenty Twenty-Five (block theme)
**Platform:** WordPress Playground

### ✅ Bug Reproduced

The reported issue was successfully reproduced in the test environment.

### Reproduction Steps

1. Navigated to Global Styles → Additional CSS
2. Entered `/* </style> */` in the CSS input
3. Attempted to save changes
4. Observed silent failure with HTTP 400 response

**Observed Behavior:**
No error message was displayed to the user despite the save request failing with a 400 status code.

### Console Errors

<details>
<summary>View console errors</summary>
```

Failed to save: HTTP 400 Bad Request

```

</details>

### Network Errors

<details>
<summary>View network errors</summary>

- `POST /wp-json/wp/v2/global-styles/...` - Status: `400` - Invalid CSS content

</details>

### Suspect Code Areas

Based on the reproduction steps and error patterns, the following code areas may be relevant:

- `packages/edit-site/src/components/global-styles/custom-css.js` - Additional CSS input component
- `packages/edit-site/src/components/global-styles/save-button.js` - Save functionality and error handling
- `packages/core-data/src/resolvers.js` - Global styles API save endpoint

### Limitations

Tested in WordPress Playground environment. Some browser-specific behaviors may differ.
```

---

## Code Reference Extraction Strategy

When bug is reproduced, identify suspect code using:

1. **Label-based search**: Extract feature/block names from labels

   - `[Feature] Global Styles` → Search "Global Styles", "theme.json", "custom CSS"
   - `[Block] Navigation` → Search "Navigation block", "block navigation"

2. **Step-based search**: Analyze reproduction steps

   - "Save" actions → Search save functions, API endpoints
   - "Additional CSS" → Search CSS-related code
   - UI interactions → Search component files

3. **Error-based search**: Use error messages

   - Extract error text → Search codebase for error strings
   - HTTP status codes → Search API error handling

4. **Semantic search**: Use codebase_search tool

   - Query: "How does Additional CSS save work?"
   - Query: "Where are Global Styles validation errors displayed?"
   - Query: "How are save failures handled in Site Editor?"

5. **File path patterns**: Based on Gutenberg structure
   - Site Editor: `packages/edit-site/src/**`
   - Blocks: `packages/block-library/src/**/<block-name>/**`
   - Components: `packages/components/src/**`
   - Core Data: `packages/core-data/src/**`

Format code references as:

- File paths relative to Gutenberg repo root
- Brief explanation of why the file is relevant
- Link to GitHub if possible (optional, Phase 2)
