---
description: Run full triage pipeline for a Gutenberg bug report
allowed_args: issue
---

# /triage

Run the full end-to-end triage pipeline for a Gutenberg issue.

## Arguments

- `issue` (required): Issue number or GitHub URL

## Process

Execute these steps in sequence:

1. **Parse the issue**
   - Fetch issue data and extract reproduction steps
   - Write to `.triage/<issue>.parsed.json`

2. **Build a blueprint**
   - Generate Playground blueprint from parsed data
   - Write to `.triage/<issue>.blueprint.json`

3. **Reproduce the bug** (NOT YET IMPLEMENTED)
   - Start Playground with the blueprint
   - Execute reproduction steps via browser automation
   - Write to `.triage/<issue>.findings.json`

4. **Report findings** (NOT YET IMPLEMENTED)
   - Summarize reproduction results
   - Output console summary

## Current Status

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
Steps 1-3 are implemented. Steps 4 are planned but not yet available.

