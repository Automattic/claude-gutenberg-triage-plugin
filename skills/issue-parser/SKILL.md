# Issue Parser Skill

Parse WordPress Gutenberg bug reports into structured reproduction plans.

## Purpose

Extract actionable reproduction data from Gutenberg GitHub issues that follow the bug report template.

## Input

A GitHub issue number or URL from the WordPress/gutenberg repository.

## Process

### 1. Fetch the issue and comments

Use the GitHub CLI to retrieve issue data including comments:

```bash
gh issue view <number> --repo WordPress/gutenberg --json title,body,labels,state,comments
```

This fetches the issue body AND all comments, which often contain critical context.

### 2. Validate it's a bug report

Check that:
- The issue has the `[Type] Bug` label
- The issue state is `open` (warn if closed but continue)

If not a bug report, stop and inform the user.

### 3. Parse and understand labels

Gutenberg uses a structured label taxonomy. Extract ALL labels and use them for context.

**Label prefixes and their meaning:**

| Prefix | Purpose | Example |
|--------|---------|---------|
| `[Type]` | Issue type | `[Type] Bug`, `[Type] Enhancement` |
| `[Status]` | Workflow state | `[Status] In Progress`, `[Status] Needs Testing` |
| `[Block]` | Affected block(s) | `[Block] More`, `[Block] Navigation` |
| `[Feature]` | Affected feature | `[Feature] Block Visibility`, `[Feature] Patterns` |
| `[Package]` | Affected npm package | `[Package] Components` |
| `[Focus]` | Area of focus | `[Focus] Accessibility` |

**Use labels to disambiguate steps:**

- If `[Block] More` is present and steps mention "the block", it's the More block
- If `[Feature] Block Visibility` is present and steps say "set to Hide", it refers to the visibility toggle in block settings
- Label descriptions often contain helpful context (e.g., "Affects the More Block - used for displaying the 'Read More' link")

**Include in output:**
- List all labels with their descriptions
- Note which blocks/features are explicitly tagged
- Use this context when interpreting ambiguous steps

### 4. Extract context from comments

Comments often contain critical information missing from the original report:

**Look for:**
- **Feature names**: Maintainers often name the specific feature (e.g., "block visibility feature", "navigation block", "site editor")
- **Technical explanations**: How the feature works, what hooks/APIs are involved
- **Clarifying questions and answers**: Reporter or maintainers clarifying ambiguous steps
- **Related issues/PRs**: Links to related context
- **Reproduction confirmations**: Others confirming or failing to reproduce

**Comment signals:**
- Comments from `MEMBER` or `CONTRIBUTOR` associations carry more weight
- Look for technical terminology that names features or mechanisms
- "This is related to..." or "This happens because..." often explains root cause

**Extract from comments:**
- Any feature names mentioned that weren't in labels
- Clarifications to reproduction steps
- Whether the issue has been confirmed reproducible by others
- Any hints about which editor context (post editor, site editor, etc.)

### 5. Parse template sections

The Gutenberg bug template has these sections (identified by `### ` headings):

| Section | Required | Content |
|---------|----------|---------|
| `### Description` | Yes | What the bug is, context |
| `### Step-by-step reproduction instructions` | Yes | Numbered steps to reproduce |
| `### Screenshots, screen recording, code snippet` | No | Visual evidence, code |
| `### Environment info` | Yes | WP version, Gutenberg version, theme |
| `### Please confirm...` | No | Checkboxes, can ignore |

### 6. Extract environment details

From the `### Environment info` section, extract:

- **WordPress version**: Look for patterns like `WordPress 6.9`, `WP 6.8`, `6.7.1`
- **Gutenberg version**: Look for `Gutenberg trunk`, `Gutenberg 20.0`, `GB plugin`, or `built-in/core`
- **Theme type**: Block, Classic, or Hybrid (from checkboxes or text)

If versions are missing or unclear, note them as `unknown` and flag for user confirmation.

### 7. Parse reproduction steps

From `### Step-by-step reproduction instructions`:

- Extract numbered steps (1., 2., 3., etc.)
- Preserve the exact wording
- Flag any steps that are ambiguous or require interpretation

**Ambiguity indicators:**
- Vague actions: "click around", "do something", "navigate somewhere"
- Missing specifics: "click the button" (which button?)
- Assumes context: "in the editor" (which editor? post? site?)
- External dependencies: "install plugin X", "use theme Y"

### 8. Identify expected vs actual behaviour

From `### Description` or explicit sections, extract:
- What should happen (expected)
- What actually happens (actual/observed)

These may be implicit in the description rather than explicitly labeled.

## Output

Provide a structured summary:

```
ISSUE PARSED: #<number>
Title: <title>
State: <open/closed>

LABELS:
- [Block] <name>: <description>
- [Feature] <name>: <description>
- ...

AFFECTED:
- Blocks: <list of blocks from labels>
- Features: <list of features from labels or discovered in comments>

COMMENT CONTEXT:
- Feature names discovered: <any features named by maintainers>
- Reproduction confirmed: <yes/no/not mentioned>
- Additional technical context: <relevant explanations from comments>

ENVIRONMENT:
- WordPress: <version or "unknown">
- Gutenberg: <version or "built-in" or "unknown">
- Theme: <block/classic/hybrid or "unknown">

REPRODUCTION STEPS:
1. <step>
2. <step>
...

INTERPRETED STEPS (with label context applied):
1. <step with disambiguation>
2. <step with disambiguation>
...

EXPECTED: <what should happen>
ACTUAL: <what happens instead>

AMBIGUITIES:
- <any unclear steps or missing info that labels couldn't resolve>

PARSEABLE: <yes/no/partial>
```

## Fallback: Non-template issues

If the issue doesn't follow the template:

1. Attempt best-effort extraction
2. Look for keywords: "steps", "reproduce", "expected", "actual", "version"
3. Flag as `PARSEABLE: partial` with clear notes on what's missing

## Error cases

- **Not a bug**: Issue lacks `[Type] Bug` label → inform user, stop
- **Empty body**: No issue content → inform user, stop
- **No steps found**: Can't identify reproduction steps → flag, ask user for guidance
