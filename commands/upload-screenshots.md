---
description: Upload screenshots to CloudUp or other backends and get markdown links
allowed_args: files
---

# Upload Screenshots Command

Upload image files to CloudUp (or other configured backend) and receive markdown-formatted links for pasting into GitHub issues and PRs.

## Usage

```bash
/gutenberg-issue-triage:upload-screenshots <files...> [options]
```

## Arguments

**Positional**:
- `files` (required): One or more file paths. Supports glob patterns like `*.png`

**Flags**:
- `--backend=<name>`: Force specific backend (cloudup, imgur, mock). Default: auto
- `--issue=<number>`: Issue number for collection naming. Auto-detected from path if in `.triage/<number>/`
- `--title=<string>`: Custom collection title. Default: "Gutenberg Issue #<number>"
- `--copy`: Copy markdown output to clipboard (requires `pbcopy` or `xclip`)
- `--dry-run`: Show what would be uploaded without uploading

## Examples

```bash
# Upload single file (auto-detect backend)
/gutenberg-issue-triage:upload-screenshots screenshot.png

# Upload multiple files
/gutenberg-issue-triage:upload-screenshots img1.png img2.png img3.png

# Upload with glob pattern
/gutenberg-issue-triage:upload-screenshots .triage/74447/screenshots/*.png

# Force CloudUp backend
/gutenberg-issue-triage:upload-screenshots *.png --backend=cloudup

# Custom title with clipboard copy
/gutenberg-issue-triage:upload-screenshots *.png --title="Bug Evidence" --copy

# Dry run to preview
/gutenberg-issue-triage:upload-screenshots *.png --dry-run

# Issue auto-detection
/gutenberg-issue-triage:upload-screenshots .triage/74447/screenshots/*.png
# Auto-detects issue #74447 from path
```

## Prerequisites

Before executing, check:

1. **Backend configured**:
```bash
# CloudUp
if [ -z "$CLOUDUP_TOKEN" ] && [ -z "$CLOUDUP_USER" ]; then
  echo "ERROR: No image upload backend configured"
  echo ""
  echo "Setup CloudUp:"
  echo "  export CLOUDUP_USER='username'"
  echo "  export CLOUDUP_PASS='password'"
  echo "  OR"
  echo "  export CLOUDUP_TOKEN='oauth-token'"
  echo ""
  echo "Or use mock backend for testing:"
  echo "  export IMAGE_UPLOAD_MOCK=true"
  exit 1
fi
```

2. **Node.js available** (for CloudUp):
```bash
command -v node &> /dev/null || echo "WARNING: Node.js not found (needed for CloudUp)"
```

## Process

### Step 1: Parse Arguments

Extract files and flags:

```bash
FILES=()
BACKEND="auto"
ISSUE=""
TITLE=""
COPY=false
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --backend=*)
      BACKEND="${arg#*=}"
      ;;
    --issue=*)
      ISSUE="${arg#*=}"
      ;;
    --title=*)
      TITLE="${arg#*=}"
      ;;
    --copy)
      COPY=true
      ;;
    --dry-run)
      DRY_RUN=true
      ;;
    --*)
      echo "ERROR: Unknown flag: $arg"
      exit 1
      ;;
    *)
      # File argument - expand glob
      for file in $arg; do
        FILES+=("$file")
      done
      ;;
  esac
done

# Validate at least one file
if [ ${#FILES[@]} -eq 0 ]; then
  echo "ERROR: No files specified"
  echo "Usage: /upload-screenshots <files...> [options]"
  exit 1
fi
```

### Step 2: Validate Files

```bash
VALID_FILES=()

for file in "${FILES[@]}"; do
  # File exists
  if [ ! -f "$file" ]; then
    echo "ERROR: File not found: $file"
    exit 1
  fi

  # File readable
  if [ ! -r "$file" ]; then
    echo "ERROR: Cannot read file: $file"
    exit 1
  fi

  # Is an image
  mime=$(file --mime-type -b "$file")
  if [[ ! "$mime" =~ ^image/ ]]; then
    echo "ERROR: Not an image: $file (type: $mime)"
    exit 1
  fi

  # Size warning
  size=$(wc -c < "$file")
  if [ $size -gt 10485760 ]; then  # 10 MB
    size_mb=$((size / 1048576))
    echo "WARNING: Large file ($size_mb MB): $file"
    echo "Consider compressing before upload"
  fi

  # Convert to absolute path
  abs_path=$(realpath "$file")
  VALID_FILES+=("$abs_path")
done
```

### Step 3: Auto-detect Issue Number

```bash
if [ -z "$ISSUE" ]; then
  # Try to detect from first file path
  first_file="${VALID_FILES[0]}"
  if [[ "$first_file" =~ \.triage/([0-9]+)/ ]]; then
    ISSUE="${BASH_REMATCH[1]}"
    echo "Auto-detected issue: #$ISSUE"
  fi
fi
```

### Step 4: Dry Run Check

```bash
if [ "$DRY_RUN" = true ]; then
  echo "DRY RUN - No files will be uploaded"
  echo ""
  echo "Would upload ${#VALID_FILES[@]} file(s) to $BACKEND:"
  for file in "${VALID_FILES[@]}"; do
    filename=$(basename "$file")
    size=$(wc -c < "$file")
    size_human=$(numfmt --to=iec-i --suffix=B $size 2>/dev/null || echo "$((size / 1024)) KB")
    echo "  ✓ $filename ($size_human)"
  done
  echo ""
  if [ -n "$TITLE" ]; then
    echo "Collection: \"$TITLE\""
  elif [ -n "$ISSUE" ]; then
    echo "Collection: \"Gutenberg Issue #$ISSUE\""
  else
    echo "Collection: \"Screenshots\""
  fi
  exit 0
fi
```

### Step 5: Call Image-Uploader Skill

Prepare skill input and execute:

```bash
# Build files JSON
FILES_JSON=$(printf '%s\n' "${VALID_FILES[@]}" | jq -R . | jq -s .)

# Build options JSON
OPTIONS_JSON=$(jq -n \
  --arg backend "$BACKEND" \
  --arg issue "$ISSUE" \
  --arg title "$TITLE" \
  '{backend: $backend, issue_number: $issue, title: $title}')

# Get plugin root
PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Execute via wrapper
cd "$PLUGIN_ROOT"
output=$(node skills/image-uploader/templates/upload-wrapper.js \
  "$BACKEND" \
  "$FILES_JSON" \
  "$OPTIONS_JSON" 2>&1)

exit_code=$?
```

### Step 6: Parse Results

```bash
if [ $exit_code -eq 0 ]; then
  # Success - parse output
  success=$(echo "$output" | jq -r '.success')
  backend_used=$(echo "$output" | jq -r '.backend_used')
  files_uploaded=$(echo "$output" | jq -r '.files_uploaded // .images | length')
  markdown_all=$(echo "$output" | jq -r '.markdown_all')
  collection_url=$(echo "$output" | jq -r '.collection_url // empty')

  # Display success message
  echo "UPLOADED $files_uploaded IMAGE(S) TO ${backend_used^^}:"
  echo ""

  # List uploaded files
  echo "$output" | jq -r '.images[] | "✓ \(.filename) → \(.url)"'
  echo ""

  # Display markdown
  echo "MARKDOWN:"
  echo "$markdown_all"
  echo ""

  # Display collection URL
  if [ -n "$collection_url" ] && [ "$collection_url" != "null" ]; then
    echo "COLLECTION: $collection_url"
    echo ""
  fi
else
  # Error - extract and display
  error=$(echo "$output" | jq -r '.error // "Upload failed"')
  error_type=$(echo "$output" | jq -r '.error_type // "unknown"')

  echo "ERROR: $error"
  echo ""

  # Show setup instructions if available
  instructions=$(echo "$output" | jq -r '.setup_instructions[]?' 2>/dev/null)
  if [ -n "$instructions" ]; then
    echo "Setup instructions:"
    echo "$instructions"
    echo ""
  fi

  exit 1
fi
```

### Step 7: Optional Clipboard Copy

```bash
if [ "$COPY" = true ]; then
  if command -v pbcopy &> /dev/null; then
    echo "$markdown_all" | pbcopy
    echo "✓ Markdown copied to clipboard (pbcopy)"
  elif command -v xclip &> /dev/null; then
    echo "$markdown_all" | xclip -selection clipboard
    echo "✓ Markdown copied to clipboard (xclip)"
  else
    echo "WARNING: Clipboard tool not found (install pbcopy or xclip)"
  fi
  echo ""
fi
```

### Step 8: Save Markdown File

```bash
if [ -n "$ISSUE" ]; then
  mkdir -p ".triage/$ISSUE"
  echo "$markdown_all" > ".triage/$ISSUE/screenshots.md"
  echo "Markdown saved to: .triage/$ISSUE/screenshots.md"
fi
```

## Output Format

### Success

```
UPLOADED 3 IMAGE(S) TO CLOUDUP:

✓ screenshot1.png → https://i.cloudup.com/abc123.png
✓ screenshot2.png → https://i.cloudup.com/def456.png
✓ screenshot3.png → https://i.cloudup.com/ghi789.png

MARKDOWN:
![screenshot1.png](https://i.cloudup.com/abc123.png)
![screenshot2.png](https://i.cloudup.com/def456.png)
![screenshot3.png](https://i.cloudup.com/ghi789.png)

COLLECTION: https://cloudup.com/cXyz789

Markdown saved to: .triage/74447/screenshots.md
```

### Error

```
ERROR: CloudUp authentication failed

Setup instructions:
1. Visit https://cloudup.com
2. Create account or sign in
3. Set environment variables:
   export CLOUDUP_USER='your-username'
   export CLOUDUP_PASS='your-password'
```

### Dry Run

```
DRY RUN - No files will be uploaded

Would upload 3 file(s) to cloudup:
  ✓ screenshot1.png (245 KB)
  ✓ screenshot2.png (512 KB)
  ✓ screenshot3.png (1.2 MB)

Collection: "Gutenberg Issue #74447"
```

## Error Handling

### File Errors

- **No files matched glob**: "No files found matching pattern: *.png"
- **File not found**: "ERROR: File not found: /path/to/file.png"
- **File not accessible**: "ERROR: Cannot read file: /path/to/file.png"
- **Not an image**: "ERROR: Not an image: file.txt (type: text/plain)"

### Backend Errors

- **No backend configured**: Show setup instructions for available backends
- **Backend auth failed**: Show backend-specific setup instructions
- **Upload failed**: Display error from backend with details

### Network Errors

- **Upload timeout**: "Upload timed out. Check network connection"
- **Connection refused**: "Cannot connect to backend. Check internet connection"

## Integration with Triage Workflow

After Playwright takes screenshots during issue reproduction:

```bash
# In triage command, after screenshots taken:

# Upload screenshots
/gutenberg-issue-triage:upload-screenshots \
  .triage/$ISSUE/screenshots/*.png \
  --issue=$ISSUE \
  --title="Issue #$ISSUE Reproduction"

# Include markdown in report
if [ -f ".triage/$ISSUE/screenshots.md" ]; then
  cat ".triage/$ISSUE/screenshots.md" >> ".triage/$ISSUE/report.md"
fi
```

## Testing

### Test with Mock Backend

```bash
export IMAGE_UPLOAD_MOCK=true

/gutenberg-issue-triage:upload-screenshots fixtures/screenshots/test-*.png

# Should return fake URLs immediately
```

### Test Real CloudUp Upload

```bash
export CLOUDUP_USER="your-username"
export CLOUDUP_PASS="your-password"

/gutenberg-issue-triage:upload-screenshots test.png --title="Test Upload"

# Verify URL is accessible
curl -I <returned-url>
```

### Test Error Cases

```bash
# Missing file
/gutenberg-issue-triage:upload-screenshots nonexistent.png
# Should error: File not found

# Non-image file
echo "test" > test.txt
/gutenberg-issue-triage:upload-screenshots test.txt
# Should error: Not an image

# No backend configured
unset CLOUDUP_USER CLOUDUP_PASS IMAGE_UPLOAD_MOCK
/gutenberg-issue-triage:upload-screenshots test.png
# Should show setup instructions
```

## Security Warnings

### Public Upload Warning

For files outside `.triage/` directory:

```
⚠️  WARNING: Uploading files from outside .triage/ directory
   Images will be publicly accessible on the internet.

   Files:
   - /Users/user/Desktop/private-screenshot.png

Continue with upload? (y/N)
```

Require explicit confirmation before uploading potentially sensitive files.

## Related Documentation

- **Image Uploader Skill**: `skills/image-uploader/SKILL.md`
- **CloudUp Backend**: `skills/image-uploader/backends/cloudup/SKILL.md`
- **Mock Backend**: `skills/image-uploader/backends/mock/SKILL.md`
- **Backend Interface**: `skills/image-uploader/backends/BACKEND-INTERFACE.md`
