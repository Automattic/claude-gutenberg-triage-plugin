# Gutenberg Issue Triage Plugin - Specification

A Claude Code plugin that automatically attempts to reproduce WordPress Gutenberg bug reports in a controlled, repeatable way.

## Overview

Given a "Bug" issue on the WordPress/gutenberg GitHub repo, the plugin:

1. Parses the issue (steps, expected vs actual behaviour, environment details)
2. Generates a Playground Blueprint matching the reported environment
3. Reproduces the bug using Playwright in a Playground instance
4. Reports findings to the user

**Primary Interface:** Users run the `/triage` command, which orchestrates all steps. Individual skills provide implementation guidance and can be tested independently.

## Commands

Commands are user-facing entry points that orchestrate skills to accomplish complete workflows.

### `/triage <issue>`

Run the full end-to-end triage pipeline.

**Input:** Issue number or URL
**Output:** Console summary + artifact files

**Process:**
1. Parses the issue (follows `/parse-issue` workflow)
2. Builds a blueprint (follows `/build-blueprint` workflow)
3. Reproduces the bug (follows `/reproduce` workflow) - NOT YET IMPLEMENTED
4. Reports findings (follows `/report` workflow) - NOT YET IMPLEMENTED

**Current Status:** Steps 1-2 implemented, Steps 3-4 planned

**Flags:**
- `--dry-run` - Parse and build blueprint only, no reproduction (future)

---

## Skills

### Task Skills (build first)

Each skill has a specific input/output contract and provides implementation guidance for commands.

#### `/parse-issue <issue>`

Parse a Gutenberg bug report into structured data.

**Input:** Issue number or URL
**Output:** `.triage/<issue>.parsed.json`

**Responsibilities:**
- Fetch issue via `gh` CLI
- Validate it has `[Type] Bug` label
- Extract: steps, expected/actual behaviour, environment details
- Handle both template-based and free-form issues

#### `/build-blueprint <issue>`

Generate a Playground blueprint from parsed issue data.

**Input:** `.triage/<issue>.parsed.json`
**Output:** `.triage/<issue>.blueprint.json`

**Responsibilities:**
- Read parsed issue data
- Map environment to blueprint config (WP version, Gutenberg, theme)
- Determine landing page from reproduction steps
- Output valid Playground blueprint JSON

#### `/reproduce <issue>`

Start Playground and attempt to reproduce the bug.

**Input:** `.triage/<issue>.parsed.json` + `.triage/<issue>.blueprint.json`
**Output:** `.triage/<issue>.findings.json`

**Responsibilities:**
- Start Playground with blueprint
- Navigate to landing page
- Execute reproduction steps via Playwright MCP
- Capture evidence (screenshots, console errors, observed state)
- Stop Playground
- Output structured findings

#### `/report <issue>`

Summarize findings for the user.

**Input:** `.triage/<issue>.findings.json`
**Output:** Console summary (Phase 2: GitHub comment)

**Responsibilities:**
- Read findings
- Format human-readable summary
- Include: environment tested, result, evidence, limitations

### Domain Knowledge Skills

Skills that provide reference knowledge (not task-oriented).

#### `playground`

Knowledge about WordPress Playground:
- Blueprint schema and common patterns
- CLI options and usage
- Environment defaults
- Limitations and workarounds

#### `playwright`

Knowledge about Playwright MCP:
- How to use browser automation tools
- Selector strategies (role-based, accessibility tree)
- Common patterns for WordPress admin
- Error handling and evidence capture

#### `gutenberg`

Knowledge about Gutenberg/Block Editor:
- Admin URLs and feature areas
- UI terminology (inserter, list view, inspector, etc.)
- Common UI elements and how to target them
- Feature context (Global Styles, Navigation, Patterns, etc.)

*Populated via Context7 MCP, WordPress docs, and manual curation.*

---

## Architecture

```
gutenberg-issue-triage/
├── commands/
│   └── triage.md              # Main command: orchestrates full pipeline
├── skills/
│   ├── parse-issue.md         # Task: parse GitHub issue
│   ├── build-blueprint.md     # Task: generate blueprint
│   ├── reproduce.md           # Task: run reproduction
│   ├── report.md              # Task: summarize findings
│   ├── playground.md          # Domain knowledge
│   ├── playwright.md          # Domain knowledge
│   ├── gutenberg.md           # Domain knowledge
│   └── templates/
│       └── default-blueprint.json
├── bin/
│   └── playground.sh          # Playground lifecycle
├── fixtures/
│   └── parsed-issues/         # Test fixtures
├── .triage/                   # Runtime files (gitignored)
│   ├── <issue>.parsed.json
│   ├── <issue>.blueprint.json
│   ├── <issue>.findings.json
│   ├── playground.pid
│   ├── playground.url
│   └── playground.log
├── spec.md
└── CONTRIBUTING.md
```

---

## Data Flow

### Via /triage Command (Recommended)

```
/triage 74447
     │
     ├─► Parse issue workflow
     │   └─► .triage/74447.parsed.json
     │
     ├─► Build blueprint workflow
     │   └─► .triage/74447.blueprint.json
     │
     ├─► Reproduce workflow (TODO)
     │   └─► .triage/74447.findings.json
     │
     └─► Report workflow (TODO)
         └─► Console output
```

### Via Individual Skills (For Testing/Development)

```
/parse-issue 74447
        │
        ▼
.triage/74447.parsed.json
        │
        ▼
/build-blueprint 74447
        │
        ▼
.triage/74447.blueprint.json
        │
        ▼
/reproduce 74447
        │ (Playground + Playwright)
        ▼
.triage/74447.findings.json
        │
        ▼
/report 74447
        │
        ▼
Console output
```

---

## File Formats

### `.triage/<issue>.parsed.json`

```json
{
  "issue": {
    "number": 74447,
    "title": "...",
    "url": "https://github.com/..."
  },
  "environment": {
    "wordpress": "latest",
    "gutenberg": "latest",
    "theme": "block"
  },
  "reproduction": {
    "steps": ["Step 1", "Step 2"],
    "expected": "What should happen",
    "actual": "What actually happens"
  },
  "labels": ["[Type] Bug", "Global Styles"],
  "parseable": true
}
```

### `.triage/<issue>.blueprint.json`

Standard Playground blueprint format. See `skills/playground.md`.

### `.triage/<issue>.findings.json`

```json
{
  "issue": 74447,
  "environment": {
    "wordpress": "6.7",
    "gutenberg": "20.0",
    "php": "8.2"
  },
  "result": "reproduced | not_reproduced | inconclusive",
  "steps_executed": [
    { "step": 1, "action": "...", "success": true },
    { "step": 2, "action": "...", "success": false, "error": "..." }
  ],
  "evidence": {
    "console_errors": [],
    "screenshots": [],
    "observations": "..."
  },
  "limitations": "..."
}
```

---

## Technical Requirements

### Prerequisites

| Tool | Purpose | Check |
|------|---------|-------|
| `gh` CLI | Fetch issues | `gh --version` |
| `npx` | Run Playground | `npx --version` |
| Playwright MCP | Browser automation | MCP server connected |

### Plugin-Provided MCP Servers

The plugin provides the following MCP server via `plugin.json`:

| Server | Package | Purpose |
|--------|---------|---------|
| Context7 | `@upstash/context7-mcp` | Fetch up-to-date documentation for Gutenberg, WordPress, and related libraries |

This enables the `gutenberg` skill to pull current documentation context rather than relying on training data.

### Defaults

- WordPress: `latest`
- Gutenberg: latest from wordpress.org/plugins
- Theme: Twenty Twenty-Five (block theme)
- PHP: 8.2

---

## MVP Scope

### In Scope

- Parse bug reports from GitHub
- Generate Playground blueprints
- Reproduce via Playwright
- Console output of results

### Out of Scope (MVP)

- GitHub comment posting
- Version comparison (beta vs stable)
- Complex multi-step Gutenberg flows
- Confidence scoring
- Issue labeling/closing

---

## Development Approach

1. **Build skills independently** - Each skill provides clear implementation guidance
2. **Define clear contracts** - Input/output formats documented for each workflow
3. **Test skills in isolation** - Use individual skills to test workflows separately
4. **Create commands** - Commands orchestrate skills to provide user-facing workflows
5. **Iterate on implementation** - Commands read skill files and execute their described workflows

---

## Security

- Treat issue content as untrusted
- No arbitrary code execution from issue text
- Playground runs sandboxed
- No credentials exposed

---

## Authors

- David Smith

## Version

1.0.0-dev
