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

### Step 4: Start Playground

Use the **playground-runner** skill to:
1. Save the blueprint to `.triage/<issue>.blueprint.json`
2. Start Playground: `./bin/playground.sh start --blueprint=.triage/<issue>.blueprint.json`
3. Wait for it to be ready
4. Output the URL

### Step 5: Run reproduction

Use the **repro-runner** skill to:
1. Create screenshots directory: `.triage/<issue>/screenshots/`
2. Connect Playwright to the Playground URL
3. Execute reproduction steps from parsed data:
   - Navigate to required pages
   - Interact with UI elements (type, click, etc.)
   - Capture screenshots at key points
4. Collect evidence:
   - Console errors and warnings
   - Network requests (especially failed requests)
   - Screenshots saved to `.triage/<issue>/screenshots/`
5. Determine reproduction result:
   - ✅ REPRODUCED - Bug confirmed
   - ❌ NOT REPRODUCED - Bug not present
   - ⚠️ INCONCLUSIVE - Could not complete steps
6. Report findings with evidence
7. Stop Playground: `./bin/playground.sh stop`

## Output

Output:
1. Parsed issue summary
2. Generated blueprint
3. Playground URL (when running)
4. Reproduction results:
   - Result classification (reproduced/not reproduced/inconclusive)
   - Console errors and network issues
   - Screenshots location: `.triage/<issue>/screenshots/`
   - Detailed evidence and findings

**IMPORTANT: Do not post anything to GitHub. This is a local-only tool.**

## Example usage

```
/triage 74439
/triage https://github.com/WordPress/gutenberg/issues/74439
/triage 74447 --fixture
```

## Cleanup

After triage is complete (or if interrupted), stop Playground:

```bash
./bin/playground.sh stop
```
