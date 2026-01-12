---
description: Summarize reproduction findings for the user
allowed_args: issue
---

# /report

Summarize reproduction findings.

## Arguments

- `issue` (required): Issue number

## Input

Reads from `.triage/<issue>.findings.json`

## Output

Console summary (Phase 2: GitHub comment)

## Process

1. Read findings
2. Format human-readable summary
3. Output to console

## TODO

- [ ] Implement
