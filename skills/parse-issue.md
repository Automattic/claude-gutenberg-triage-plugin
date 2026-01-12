---
description: Parse a Gutenberg bug report into structured data
allowed_args: issue
---

# /parse-issue

Parse a WordPress Gutenberg bug report into structured reproduction data.

## Arguments

- `issue` (required): Issue number or GitHub URL

## Output

Writes to `.triage/<issue>.parsed.json`

---

## Process

### 1. Fetch the issue and comments

```bash
gh issue view <number> --repo WordPress/gutenberg --json title,body,labels,state,comments,author
```

Fetches issue body AND all comments (often contain critical context).

### 2. Validate it's a bug report

Check that:
- Issue has the `[Type] Bug` label
- Issue state is `open` (warn if closed but continue)

If not a bug report, stop and inform the user.

### 3. Parse and understand labels

Gutenberg uses a structured label taxonomy. Extract ALL labels for context.

**Label prefixes:**

| Prefix | Purpose | Example |
|--------|---------|---------|
| `[Type]` | Issue type | `[Type] Bug` |
| `[Status]` | Workflow state | `[Status] Needs Testing` |
| `[Block]` | Affected block | `[Block] Navigation` |
| `[Feature]` | Affected feature | `[Feature] Patterns` |
| `[Package]` | npm package | `[Package] Components` |
| `[Focus]` | Area of focus | `[Focus] Accessibility` |

**Use labels to disambiguate steps:**
- If `[Block] More` is present and steps mention "the block", it's the More block
- If `[Feature] Block Visibility` is present and steps say "set to Hide", it's the visibility toggle
- Label descriptions often contain helpful context

### 4. Extract context from comments

Comments often contain critical information missing from the original report.

**Look for:**
- **Feature names**: Maintainers often name the specific feature
- **Technical explanations**: How the feature works
- **Clarifications**: Reporter or maintainers clarifying steps
- **Related issues/PRs**: Links to context
- **Reproduction confirmations**: Others confirming the bug

**Comment signals:**
- Comments from `MEMBER` or `CONTRIBUTOR` carry more weight
- "This is related to..." or "This happens because..." explains root cause

### 5. Parse template sections

Gutenberg bug template sections (identified by `### ` headings):

| Section | Required | Content |
|---------|----------|---------|
| `### Description` | Yes | What the bug is |
| `### Step-by-step reproduction instructions` | Yes | Numbered steps |
| `### Screenshots, screen recording, code snippet` | No | Visual evidence |
| `### Environment info` | Yes | WP/Gutenberg versions |
| `### Please confirm...` | No | Checkboxes, ignore |

### 6. Extract environment details

From `### Environment info`:

- **WordPress version**: `WordPress 6.9`, `WP 6.8`, `6.7.1`
- **Gutenberg version**: `Gutenberg trunk`, `Gutenberg 20.0`, `built-in/core`
- **Theme type**: Block, Classic, or Hybrid

If missing, note as `unknown`.

### 7. Parse reproduction steps

From `### Step-by-step reproduction instructions`:

- Extract numbered steps (1., 2., 3.)
- Preserve exact wording
- Flag ambiguous steps

**Ambiguity indicators:**
- Vague actions: "click around", "navigate somewhere"
- Missing specifics: "click the button" (which button?)
- Assumes context: "in the editor" (which editor?)
- External dependencies: "install plugin X"

### 8. Identify expected vs actual

Extract from `### Description` or explicit sections:
- What should happen (expected)
- What actually happens (actual)

### 9. Write parsed data

Write to `.triage/<issue>.parsed.json`:

```json
{
  "issue": {
    "number": 74447,
    "title": "...",
    "state": "OPEN",
    "author": "username",
    "url": "https://github.com/..."
  },
  "labels": [
    { "name": "[Type] Bug", "description": "..." },
    { "name": "[Block] Navigation", "description": "..." }
  ],
  "affected": {
    "blocks": ["Navigation"],
    "features": ["Site Editor"]
  },
  "environment": {
    "wordpress": "latest",
    "gutenberg": "latest",
    "theme": "block",
    "plugins": ["gutenberg"]
  },
  "reproduction": {
    "steps": ["Step 1", "Step 2"],
    "expected": "What should happen",
    "actual": "What actually happens"
  },
  "context": {
    "related_issues": [12345],
    "comments_count": 5,
    "reproduction_confirmed": true,
    "feature_names": ["block visibility"]
  },
  "parseable": true,
  "ambiguities": ["Step 3 unclear: which button?"]
}
```

### 10. Output summary

```
ISSUE PARSED: #<number>
Title: <title>
State: <open/closed>

LABELS:
- [Type] Bug: An existing feature does not function as intended
- [Feature] Site Editor: Related to the Site Editor
...

AFFECTED:
- Blocks: <list>
- Features: <list>

ENVIRONMENT:
- WordPress: <version>
- Gutenberg: <version>
- Theme: <type>

REPRODUCTION STEPS:
1. <step>
2. <step>
...

EXPECTED: <what should happen>
ACTUAL: <what happens instead>

AMBIGUITIES:
- <any unclear steps>

OUTPUT: .triage/<issue>.parsed.json
```

---

## Fallback: Non-template issues

If issue doesn't follow template:
1. Attempt best-effort extraction
2. Look for keywords: "steps", "reproduce", "expected", "actual", "version"
3. Flag as `parseable: false` with notes on what's missing

---

## Error Cases

- **Not a bug**: Lacks `[Type] Bug` label → inform user, stop
- **Empty body**: No content → inform user, stop
- **No steps found**: Can't identify steps → flag, ask user for guidance
