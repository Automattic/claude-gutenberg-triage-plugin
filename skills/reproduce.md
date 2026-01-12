---
description: Start Playground and attempt to reproduce the bug
allowed_args: issue
---

# /reproduce

Start Playground and attempt to reproduce the bug via Playwright.

## Arguments

- `issue` (required): Issue number

## Input

- `.triage/<issue>.parsed.json`
- `.triage/<issue>.blueprint.json`

## Output

Writes to `.triage/<issue>.findings.json`

## Process

1. Start Playground with blueprint
2. Execute reproduction steps via Playwright MCP
3. Capture evidence
4. Stop Playground
5. Write findings JSON

## TODO

- [ ] Implement
