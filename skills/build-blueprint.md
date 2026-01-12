---
description: Generate a Playground blueprint from parsed issue data
allowed_args: issue
---

# /build-blueprint

Generate a WordPress Playground blueprint from parsed issue data.

## Arguments

- `issue` (required): Issue number

## Input

Reads from `.triage/<issue>.parsed.json`

## Output

Writes to `.triage/<issue>.blueprint.json`

## Process

1. Read parsed issue data
2. Map environment to blueprint config
3. Determine landing page
4. Write blueprint JSON

## TODO

- [ ] Implement
