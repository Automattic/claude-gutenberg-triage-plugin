---
description: Run full triage pipeline for a Gutenberg bug report
allowed_args: issue
---

# /triage

Run the full triage pipeline.

## Arguments

- `issue` (required): Issue number or GitHub URL

## Flags

- `--dry-run`: Parse and build blueprint only, skip reproduction

## Output

Console summary

## Process

Wires together subroutines (NOT other skills):
1. Parse issue
2. Build blueprint
3. Reproduce
4. Report

## TODO

- [ ] Build after individual skills work
- [ ] Extract subroutines from skills
- [ ] Compose subroutines here
