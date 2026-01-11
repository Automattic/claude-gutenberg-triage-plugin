---
description: Triage a Gutenberg bug issue by parsing, reproducing, and reporting findings
allowed_args: issue
---

# Triage Command

Parse, configure, and reproduce a WordPress Gutenberg bug report.

## Arguments

- `issue` (required): GitHub issue number (e.g., `74439`) or full URL (e.g., `https://github.com/WordPress/gutenberg/issues/74439`)

## Flags

- `--fixture`: Load parsed data from `fixtures/parsed-issues/<issue>.json` instead of fetching live. Use for testing skills without re-parsing.

## Prerequisites

Before starting, verify the GitHub CLI is available (skip if using `--fixture`):

- Run `gh --version` to confirm `gh` is installed and authenticated

If the prerequisite is missing, stop and inform the user what needs to be installed.

## Process

**IMPORTANT:** Parse the issue ONCE in Step 2. The parsed data stays in context and is used by subsequent steps. Do NOT re-fetch or re-parse the issue.

### Step 1: Validate input

Parse the issue argument:
- If it's a number (e.g., `74439`), use it directly
- If it's a URL, extract the issue number from the path
- If invalid, inform the user and stop

### Step 2: Parse the issue (or load fixture)

**If `--fixture` flag is present:**
1. Load parsed data from `fixtures/parsed-issues/<issue>.json`
2. Output a brief summary confirming fixture loaded
3. Skip to Step 3

**Otherwise, use the issue-parser skill to:**
1. Fetch the issue from WordPress/gutenberg via `gh issue view`
2. Validate it has the `[Type] Bug` label
3. Extract structured data: steps, environment, expected/actual behaviour
4. Extract context from labels and comments
5. Output the parsed summary

The parsed output includes:
- `environment` (wordpress, gutenberg, theme)
- `reproduction.steps`
- `reproduction.expected` / `reproduction.actual`
- `labels` and `ambiguities`

**Keep this parsed data in context for the next step.**

### Step 3: Generate blueprint

Use the **blueprint-builder** skill to:
1. Read the parsed `environment` data from Step 2
2. Load the default blueprint template from `skills/blueprint-builder/templates/default.json`
3. Customize for the issue's requirements:
   - Set WordPress/PHP versions
   - Configure Gutenberg plugin (latest, specific version, or trunk)
   - Set appropriate theme (block or classic)
   - Determine landing page from first reproduction step
4. Output the complete blueprint JSON

**STOP HERE.** The following step is planned for future implementation:

### Step 4: Run reproduction (not yet implemented)

Will use the **repro-runner** skill to:
1. Start Playground with the generated blueprint
2. Execute reproduction steps via Playwright
3. Capture evidence and report findings

## Output

Output both the parsed issue summary AND the generated blueprint.

**IMPORTANT: Do not post anything to GitHub. This is a local-only tool.**

## Example usage

```
/triage 74439
/triage https://github.com/WordPress/gutenberg/issues/74439
/triage 74447 --fixture
```
