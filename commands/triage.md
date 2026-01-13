---
description: Run full triage pipeline for a Gutenberg bug report
allowed_args: issue
allowedTools:
  - Bash
  - Read
  - Write
  - Skill
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

3. **Reproduce the bug**
   - Use the **reproduce** skill
   - Start Playground with the blueprint
   - Execute reproduction steps via browser automation
   - Collect evidence (screenshots, console errors, network requests)
   - Determine result: ✅ REPRODUCED, ❌ NOT REPRODUCED, or ⚠️ INCONCLUSIVE
   - Stop Playground
   - Write to `.triage/<issue>.findings.json`

4. **Report findings**
   - Use the **report** skill
   - Summarize reproduction results in GitHub-comment format
   - Identify suspect code areas based on labels and evidence
   - Output console summary

## Output

All results are written to the `.triage/<issue>/` directory:
- `<issue>.parsed.json` - Parsed issue data
- `<issue>.blueprint.json` - Playground blueprint
- `<issue>.findings.json` - Reproduction results and evidence
- `screenshots/` - Screenshots captured during reproduction

