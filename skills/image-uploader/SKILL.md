# Image Uploader Skill

## Purpose

Generic image upload orchestration that validates files, selects a backend (CloudUp, Imgur, etc.), uploads images, and returns markdown-formatted links for GitHub issues/PRs.

## Input

```json
{
  "files": ["/absolute/path/to/file1.png", "/absolute/path/to/file2.png"],
  "backend": "auto",
  "options": {
    "issue_number": "74447",
    "title": "Bug Screenshots",
    "description": "Screenshots showing error",
    "collection_name": "gutenberg-issue-74447"
  }
}
```

**Fields**:
- `files` (required): Absolute paths to images
- `backend` (optional): "cloudup", "imgur", "mock", or "auto" (default)
- `options` (optional): Issue number, title, description, collection name

## Process

### Step 1: Validate Files

For each file:

```bash
# Exists and readable
[ ! -f "$file" ] && error "File not found: $file"
[ ! -r "$file" ] && error "Cannot read: $file"

# Is an image
mime=$(file --mime-type -b "$file")
[[ ! "$mime" =~ ^image/ ]] && error "Not an image: $file (type: $mime)"

# Size warning (>10MB)
size=$(wc -c < "$file")
[ $size -gt 10485760 ] && echo "WARNING: Large file ($((size/1048576)) MB): $file"

# Convert to absolute path
absolute_path=$(realpath "$file")
```

### Step 2: Select Backend

```bash
if [ "$backend" != "auto" ]; then
  selected_backend="$backend"
else
  if [ -n "$CLOUDUP_TOKEN" ] || ([ -n "$CLOUDUP_USER" ] && [ -n "$CLOUDUP_PASS" ]); then
    selected_backend="cloudup"
  elif [ -n "$IMGUR_CLIENT_ID" ]; then
    selected_backend="imgur"
  elif [ "$IMAGE_UPLOAD_MOCK" = "true" ]; then
    selected_backend="mock"
  else
    error "No backend configured. Set CLOUDUP_USER/CLOUDUP_PASS or IMAGE_UPLOAD_MOCK=true"
  fi
fi

# Validate backend exists
backend_skill="skills/image-uploader/backends/$selected_backend/SKILL.md"
[ ! -f "$backend_skill" ] && error "Unknown backend: $selected_backend"
```

### Step 3: Execute Backend

```bash
# Build JSON input
FILES_JSON=$(printf '%s\n' "${FILES[@]}" | jq -R . | jq -s .)
OPTIONS_JSON=$(jq -n --arg title "$title" --arg issue "$issue" '{title: $title, issue_number: $issue}')

# Execute via wrapper
output=$(node skills/image-uploader/templates/upload-wrapper.js \
  "$selected_backend" \
  "$FILES_JSON" \
  "$OPTIONS_JSON" 2>&1)

# Check success
[ $? -ne 0 ] && error "Upload failed: $output"
```

### Step 4: Parse Response

```bash
success=$(echo "$output" | jq -r '.success')

if [ "$success" = "true" ]; then
  urls=$(echo "$output" | jq -r '.images[].url')
  markdown=$(echo "$output" | jq -r '.markdown_all')
  collection_url=$(echo "$output" | jq -r '.collection_url')
else
  error=$(echo "$output" | jq -r '.error')
  instructions=$(echo "$output" | jq -r '.setup_instructions[]?' 2>/dev/null)
  echo "ERROR: $error"
  [ -n "$instructions" ] && echo "$instructions"
  exit 1
fi
```

### Step 5: Format Output

**Success**:
```
UPLOADED 3 IMAGES TO CLOUDUP:
✓ file1.png → https://i.cloudup.com/abc123.png
✓ file2.png → https://i.cloudup.com/def456.png
✓ file3.png → https://i.cloudup.com/ghi789.png

MARKDOWN:
![file1.png](https://i.cloudup.com/abc123.png)
![file2.png](https://i.cloudup.com/def456.png)
![file3.png](https://i.cloudup.com/ghi789.png)

COLLECTION: https://cloudup.com/cXyz789
```

**Partial Success**:
```
UPLOADED 2 OF 3 IMAGES:
✓ file1.png → https://i.cloudup.com/abc123.png
✗ file3.png → File too large (max 10MB)

MARKDOWN:
![file1.png](https://i.cloudup.com/abc123.png)
```

**Error**:
```
ERROR: CloudUp authentication failed

Setup:
  export CLOUDUP_USER='username'
  export CLOUDUP_PASS='password'
```

## Output

**Success**:
```json
{
  "success": true,
  "backend_used": "cloudup",
  "files_uploaded": 3,
  "files_failed": 0,
  "images": [
    {
      "local_path": "/path/to/file.png",
      "filename": "file.png",
      "url": "https://service.com/image-url",
      "markdown": "![file.png](https://service.com/image-url)"
    }
  ],
  "collection_url": "https://service.com/collection-url",
  "markdown_all": "![file1.png](url1)\n![file2.png](url2)"
}
```

**Error**:
```json
{
  "success": false,
  "backend_used": "cloudup",
  "error": "CloudUp authentication failed",
  "error_type": "authentication",
  "setup_instructions": ["1. Visit https://cloudup.com", "..."]
}
```

**Partial Success**:
```json
{
  "success": true,
  "backend_used": "cloudup",
  "files_uploaded": 2,
  "files_failed": 1,
  "images": [{...}],
  "failed": [
    {
      "local_path": "/path/failed.png",
      "error": "File too large",
      "error_type": "validation"
    }
  ],
  "markdown_all": "![success.png](url)"
}
```

## Error Handling

### Validation Errors

**File Not Found**:
```json
{"success": false, "error": "File not found: /path", "error_type": "validation"}
```

**Not an Image**:
```json
{"success": false, "error": "Not an image: file.txt (type: text/plain)", "error_type": "validation"}
```

### Configuration Errors

**No Backend**:
```json
{
  "success": false,
  "error": "No backend configured",
  "error_type": "configuration",
  "setup_instructions": [
    "CloudUp: Set CLOUDUP_USER and CLOUDUP_PASS",
    "Mock: Set IMAGE_UPLOAD_MOCK=true"
  ]
}
```

**Invalid Backend**:
```json
{
  "success": false,
  "error": "Unknown backend: invalid",
  "error_type": "configuration",
  "available_backends": ["cloudup", "imgur", "mock"]
}
```

### Backend Errors

Errors from backends are passed through with original structure. The skill may add context:

```json
{
  "success": false,
  "backend_used": "cloudup",
  "error": "CloudUp authentication failed",
  "error_type": "authentication",
  "backend_error": {"status": 401, "message": "Invalid credentials"},
  "setup_instructions": ["..."]
}
```

## Integration

Commands call this skill:

1. Command parses arguments and expands globs
2. Command converts to absolute paths
3. Command builds skill input JSON
4. Command invokes image-uploader skill
5. Skill validates and uploads
6. Skill returns JSON result
7. Command formats for display
8. Command does post-processing (clipboard, save file, etc.)

## Testing

### Mock Backend Test

```bash
export IMAGE_UPLOAD_MOCK=true
# Upload test files
# Should return fake URLs without real upload
```

### Backend Selection Test

```bash
# Test CloudUp selection
export CLOUDUP_USER="test"
export CLOUDUP_PASS="test"
# Should auto-select cloudup

# Test explicit backend
backend="mock" # in input
# Should use mock regardless of env
```

### Error Tests

```bash
# No backend configured
unset CLOUDUP_USER CLOUDUP_PASS IMAGE_UPLOAD_MOCK
# Should error with setup instructions

# Invalid backend
backend="invalid" # in input
# Should error with available backends

# Missing file
files='["/nonexistent.png"]'
# Should error: File not found

# Non-image file
files='["test.txt"]'
# Should error: Not an image
```

## Examples

### Upload Single Image

**Input**:
```json
{
  "files": ["/Users/user/.triage/74447/error.png"],
  "backend": "auto",
  "options": {"issue_number": "74447", "title": "CSS Error"}
}
```

**Output**:
```json
{
  "success": true,
  "backend_used": "cloudup",
  "files_uploaded": 1,
  "images": [{
    "local_path": "/Users/user/.triage/74447/error.png",
    "url": "https://i.cloudup.com/abc123.png",
    "markdown": "![error.png](https://i.cloudup.com/abc123.png)"
  }],
  "collection_url": "https://cloudup.com/cXyz789"
}
```

### Mock Upload

**Input**:
```json
{
  "files": ["/path/img1.png", "/path/img2.png"],
  "backend": "mock",
  "options": {"title": "Test"}
}
```

**Output**:
```json
{
  "success": true,
  "backend_used": "mock",
  "files_uploaded": 2,
  "images": [
    {"url": "https://example.com/mock-a1b2.png", "markdown": "![img1.png](...)"},
    {"url": "https://example.com/mock-c3d4.png", "markdown": "![img2.png](...)"}
  ],
  "metadata": {"note": "MOCK MODE: No actual upload"}
}
```

### Validation Error

**Input**: `{"files": ["/nonexistent.png"], "backend": "auto"}`

**Output**: `{"success": false, "error": "File not found: /nonexistent.png", "error_type": "validation"}`

### No Backend Error

**Input**: `{"files": ["/valid.png"], "backend": "auto"}`
**Env**: No CLOUDUP_*, IMGUR_*, or IMAGE_UPLOAD_MOCK

**Output**:
```json
{
  "success": false,
  "error": "No backend configured",
  "error_type": "configuration",
  "setup_instructions": [
    "CloudUp: export CLOUDUP_USER='...' CLOUDUP_PASS='...'",
    "Mock: export IMAGE_UPLOAD_MOCK=true"
  ]
}
```

## Notes

- **Backend Communication**: Via JSON stdin/stdout through wrapper script
- **File Paths**: Always convert to absolute paths with `realpath`
- **Security**: Never log credentials, validate file types, warn on sensitive paths
- **Performance**: Backends may parallelize internally; skill processes sequentially
- **Retry Logic**: Handled by individual backends, not by this skill

## Related Docs

- `backends/BACKEND-INTERFACE.md` - Backend contract
- `backends/cloudup/SKILL.md` - CloudUp implementation
- `backends/mock/SKILL.md` - Testing backend
- `commands/upload-screenshots.md` - User command
