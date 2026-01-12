---
description: Parse a Gutenberg bug report into structured data
allowed_args: issue
---

# /parse-issue

Parse a Gutenberg bug report from GitHub into structured JSON.

## Arguments

- `issue` (required): Issue number or GitHub URL

## Output

Writes to `.triage/<issue>.parsed.json`

## Process

1. Validate issue argument
2. Fetch issue via `gh issue view`
3. Validate `[Type] Bug` label
4. Extract structured data
5. Write JSON to `.triage/`

## TODO

- [ ] Implement
