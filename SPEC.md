# Gutenberg Issue Triage Plugin - Specification

A Claude Code plugin that automatically attempts to reproduce WordPress Gutenberg bug reports in a controlled, repeatable way.

## Overview

Given a "Bug" issue on the WordPress/gutenberg GitHub repo, the plugin:

1. Reads and parses the issue (steps, expected vs actual behaviour, environment details)
2. Generates a Playground Blueprint matching the reported environment
3. Spins up a local WordPress Playground instance
4. Uses Playwright (via MCP) to attempt reproduction
5. Reports findings to the user

## Command

```
/triage <issue>
```

**Input formats accepted:**
- Issue number: `12345`
- Full URL: `https://github.com/WordPress/gutenberg/issues/12345`

**Flags:**
- `--dry-run` - Plan only, no Playground/Playwright execution

## Skills (MVP)

### 1. `issue-parser`

Extracts structured data from Gutenberg bug reports.

**Responsibilities:**
- Parse official Gutenberg bug report template (strict)
- Fall back to best-effort extraction for free-form issues
- Extract: steps to reproduce, expected behaviour, actual behaviour, environment details

**Output:** Structured reproduction plan

### 2. `blueprint-builder`

Generates WordPress Playground configuration.

**Responsibilities:**
- Map issue environment details to Playground CLI arguments
- Target WP/Gutenberg versions specified in issue
- Fall back to latest if versions unspecified

**Output:** Playground CLI arguments (e.g. `--wp=6.5 --plugin=gutenberg`)

**Note:** MVP uses CLI args. Full Blueprint JSON deferred to Phase 2 if needed.

### 3. `repro-runner`

Orchestrates Playwright to execute reproduction steps.

**Responsibilities:**
- Translate parsed steps into Playwright actions
- Use role/name-based targeting and accessibility tree data
- Record what was attempted and outcomes
- Capture evidence (console errors, observed UI state)

**Output:** Reproduction result (reproduced / not reproduced / inconclusive)

## Technical Requirements

### Prerequisites (checked upfront)

- `gh` CLI authenticated with access to WordPress/gutenberg
- `npx` available (for Playground CLI)
- Playwright MCP server connected

### Environment Strategy

1. Try to match WP/Gutenberg versions specified in issue
2. Fall back to latest WordPress trunk + Gutenberg plugin if unspecified

### Playground Management

- Fresh instance per run
- Tear down after reproduction completes

### Failure Handling

When reproduction fails or is inconclusive:
- Output brief summary of what was attempted
- Prompt user for guidance on next steps

## Output (MVP)

**IMPORTANT: No GitHub posting in MVP. Console output only.**

Structured summary including:
- Environment tested (WP version, Gutenberg version)
- Reproduction result
- Evidence (console errors, observed behaviour)
- Limitations or missing info if applicable

## Non-Goals (MVP)

- GitHub comment posting (Phase 2)
- Version comparison - beta vs stable (Phase 2)
- Gutenberg-specific UI macros beyond basic clicks (Phase 2)
- Confidence scoring (Phase 2)
- Issue closing, labeling, or moderation (never)
- Non-Playground server setups or proprietary plugins (never)

---

## Phase 2 (Future)

- `report-formatter` skill for GitHub comment generation
- `--compare-stable` flag for version comparison
- Skills for common Gutenberg flows (Site Editor, Navigation block, List View)
- Smarter ambiguity handling + confidence scores
- `--no-comment` mode for local testing with full pipeline
- Output to `.triage/<issue-number>.md` files

---

## Architecture

```
gutenberg-issue-triage/
├── .claude-plugin/
│   └── plugin.json
├── commands/
│   └── triage.md              # /triage command definition
├── skills/
│   ├── issue-parser/
│   │   └── SKILL.md           # [IMPLEMENTED] Parse bug reports
│   ├── blueprint-builder/
│   │   ├── SKILL.md           # [IMPLEMENTED] Generate Playground blueprints
│   │   └── templates/
│   │       └── default.json   # Default blueprint with Gutenberg
│   ├── playground-runner/
│   │   └── SKILL.md           # [IMPLEMENTED] Manage Playground lifecycle
│   └── repro-runner/
│       └── SKILL.md           # [IMPLEMENTED] Execute reproduction with Playwright
├── fixtures/
│   └── parsed-issues/         # Test fixtures for development
│       └── *.json             # Parsed issue data (e.g., 74447.json)
├── agents/
├── hooks/
└── spec.md                    # This file
```

## Development & Testing

Use `--fixture` flag to skip live parsing and load from fixtures:

```bash
/triage 74447 --fixture    # Loads fixtures/parsed-issues/74447.json
/triage 74447              # Fetches live from GitHub
```

This allows testing individual skills without re-fetching issues each time.

## Tooling

| Tool | Purpose |
|------|---------|
| `gh` CLI | Fetch issue data, post comments (Phase 2) |
| `npx @wp-playground/cli` | Spin up WordPress environment |
| Playwright MCP | Browser automation for reproduction |

## Security

- Treat issue content as untrusted input
- Only allowlist safe commands
- No arbitrary code execution from issue content

---

## Author

David Smith

## Version

1.0.0 (MVP)
