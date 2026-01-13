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

3. **Reproduce the bug**
   - Use the **reproduce** skill
   - Start Playground with the blueprint
   - Execute reproduction steps via browser automation
   - Collect evidence (screenshots, console errors, network requests)
   - Determine result: ✅ REPRODUCED, ❌ NOT REPRODUCED, or ⚠️ INCONCLUSIVE
   - Stop Playground
   - Write to `.triage/<issue>.findings.json`

4. **Report findings** (NOT YET IMPLEMENTED)
   - Summarize reproduction results
   - Output console summary

## Current Status

Steps 1-3 are implemented. Steps 4 are planned but not yet available.

