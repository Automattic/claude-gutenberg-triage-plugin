# Mock Backend Skill

## Purpose

Testing backend that generates fake URLs without performing real uploads. Useful for development, testing, and CI/CD without requiring real credentials or network access.

## Authentication

**Environment Variable**: `IMAGE_UPLOAD_MOCK=true`

No other credentials required.

### Validation
```bash
if [ "$IMAGE_UPLOAD_MOCK" = "true" ]; then
  echo "Mock mode enabled"
else
  echo "ERROR: Set IMAGE_UPLOAD_MOCK=true to use mock backend"
  exit 1
fi
```

### Setup
```bash
export IMAGE_UPLOAD_MOCK=true
```

Add to shell profile (`~/.bashrc` or `~/.zshrc`) for persistent mock mode.

## Capabilities

- **Collections**: YES (simulated)
- **Descriptions**: YES (simulated)
- **Max File Size**: Unlimited (no actual upload)
- **Formats**: All (no validation)
- **Expiration**: N/A (fake URLs)
- **Privacy**: N/A (no real upload)
- **Thumbnails**: N/A

## Upload Algorithm

### Step 1: Validate Mock Mode

```bash
if [ "$IMAGE_UPLOAD_MOCK" != "true" ]; then
  echo "ERROR: Mock backend requires IMAGE_UPLOAD_MOCK=true"
  exit 1
fi
```

### Step 2: Validate Files Exist

```bash
for file in "${FILES[@]}"; do
  [ ! -f "$file" ] && error "File not found: $file"
done
```

No MIME type or size validation (for testing flexibility).

### Step 3: Generate Fake URLs

For each file, create deterministic fake URL:

```bash
# Generate hash from filename (for consistent URLs across runs)
filename=$(basename "$file")
hash=$(echo -n "$filename" | md5sum | cut -c1-8)

# Create fake URL
url="https://example.com/mock-${hash}.${extension}"
```

**URL Pattern**: `https://example.com/mock-<hash>.<ext>`

**Examples**:
- `screenshot.png` → `https://example.com/mock-a1b2c3d4.png`
- `error.jpg` → `https://example.com/mock-e5f6g7h8.jpg`

### Step 4: Optional File Copy

Optionally copy files to mock directory for verification:

```bash
mock_dir=".triage/mock-uploads"
mkdir -p "$mock_dir"

for file in "${FILES[@]}"; do
  filename=$(basename "$file")
  hash=$(echo -n "$filename" | md5sum | cut -c1-8)
  cp "$file" "$mock_dir/${hash}-${filename}"
done
```

This allows inspecting "uploaded" files locally.

### Step 5: Return Mock Response

```json
{
  "success": true,
  "backend_used": "mock",
  "images": [
    {
      "local_path": "/path/to/file.png",
      "filename": "file.png",
      "url": "https://example.com/mock-a1b2c3d4.png",
      "markdown": "![file.png](https://example.com/mock-a1b2c3d4.png)"
    }
  ],
  "collection_url": "https://example.com/mock-collection-xyz789",
  "markdown_all": "![file.png](...)",
  "metadata": {
    "note": "MOCK MODE: No actual upload performed",
    "mock_directory": ".triage/mock-uploads"
  }
}
```

## Error Cases

### Mock Mode Not Enabled

**Detection**: `IMAGE_UPLOAD_MOCK != "true"`
```json
{
  "success": false,
  "error": "Mock backend requires IMAGE_UPLOAD_MOCK=true",
  "error_type": "configuration",
  "setup_instructions": ["export IMAGE_UPLOAD_MOCK=true"]
}
```

### File Not Found

**Detection**: File doesn't exist
```json
{
  "success": false,
  "error": "File not found: /path/to/file.png",
  "error_type": "validation"
}
```

**Note**: Mock backend doesn't validate file types or sizes (for testing error handling).

## Testing

### Basic Mock Upload

```bash
export IMAGE_UPLOAD_MOCK=true

# Create test file
echo "test" > test.txt

# Upload (will succeed even though it's not an image)
# node upload-wrapper.js mock '["test.txt"]' '{"title":"Test"}'

# Should return fake URL without real upload
```

### Test Multiple Files

```bash
export IMAGE_UPLOAD_MOCK=true

# Upload multiple files
# node upload-wrapper.js mock '["file1.png","file2.jpg"]' '{}'

# Should return 2 fake URLs
```

### Test Error Handling

```bash
# Without IMAGE_UPLOAD_MOCK set
unset IMAGE_UPLOAD_MOCK

# Should fail with configuration error
```

### Test File Verification

```bash
export IMAGE_UPLOAD_MOCK=true

# Upload file
# node upload-wrapper.js mock '["test.png"]' '{}'

# Check mock directory
ls -la .triage/mock-uploads/
# Should see copied files with hash prefixes
```

## Use Cases

### Development

Test upload workflow without credentials:
```bash
export IMAGE_UPLOAD_MOCK=true
/gutenberg-issue-triage:upload-screenshots fixtures/screenshots/*.png
```

### CI/CD

Test in automated environments:
```yaml
# GitHub Actions
- name: Test upload command
  env:
    IMAGE_UPLOAD_MOCK: true
  run: |
    ./test-upload.sh
```

### Integration Tests

Test command/skill integration:
```bash
#!/bin/bash
export IMAGE_UPLOAD_MOCK=true

# Test single file
result=$(upload file.png)
assert_success "$result"

# Test multiple files
result=$(upload *.png)
assert_success "$result"

# Test error cases
result=$(upload nonexistent.png)
assert_failure "$result"
```

### Debugging

Verify markdown formatting without uploading:
```bash
export IMAGE_UPLOAD_MOCK=true
/upload-screenshots test.png
# Check markdown output format
```

## Deterministic URLs

The mock backend generates consistent URLs for the same filename:

**Benefit**: Predictable output for testing

**Example**:
```bash
# First run
upload screenshot.png → https://example.com/mock-a1b2c3d4.png

# Second run (same file)
upload screenshot.png → https://example.com/mock-a1b2c3d4.png
# Same URL!
```

**Implementation**: MD5 hash of filename (not file contents)

## Mock Directory Structure

Files optionally copied to `.triage/mock-uploads/`:

```
.triage/mock-uploads/
├── a1b2c3d4-screenshot.png    # <hash>-<filename>
├── e5f6g7h8-error.jpg
└── i9j0k1l2-test.gif
```

**Benefits**:
- Verify correct files were "uploaded"
- Inspect file contents locally
- Debug file path issues

**Cleanup**:
```bash
rm -rf .triage/mock-uploads
```

## Output Format

Mock backend returns standard format identical to real backends:

**Success** (same as CloudUp):
```json
{
  "success": true,
  "backend_used": "mock",
  "images": [{
    "local_path": "/path/file.png",
    "filename": "file.png",
    "url": "https://example.com/mock-abc123.png",
    "markdown": "![file.png](https://example.com/mock-abc123.png)"
  }],
  "collection_url": "https://example.com/mock-collection-xyz",
  "markdown_all": "![file.png](...)",
  "metadata": {
    "note": "MOCK MODE: No actual upload performed"
  }
}
```

**Error** (configuration):
```json
{
  "success": false,
  "backend_used": "mock",
  "error": "Mock backend requires IMAGE_UPLOAD_MOCK=true",
  "error_type": "configuration",
  "setup_instructions": ["export IMAGE_UPLOAD_MOCK=true"]
}
```

## Security

- **No network calls**: Completely offline
- **No credentials**: Safe for public CI/CD
- **No data leakage**: Files never leave local system
- **Git-safe**: Add `.triage/mock-uploads/` to `.gitignore`

## Limitations

### Not a Real Backend

- URLs are fake (https://example.com)
- No actual image hosting
- Can't use URLs in real GitHub comments
- No thumbnail generation
- No collection management

### No Validation

- Accepts non-image files
- No size limits
- No format checking
- Useful for testing error handling

### Deterministic Only by Filename

- Same filename → same URL
- Different contents → same URL (if same filename)
- Rename file → different URL

## Comparison to Real Backends

| Feature | Mock | CloudUp | Imgur |
|---------|------|---------|-------|
| Real upload | ❌ | ✅ | ✅ |
| Credentials needed | ❌ | ✅ | ✅ |
| Network required | ❌ | ✅ | ✅ |
| Public URLs | ❌ | ✅ | ✅ |
| Collections | Simulated | ✅ | ✅ |
| File validation | ❌ | ✅ | ✅ |
| Speed | Instant | ~1-2s/file | ~1-2s/file |
| Cost | Free | Free | Free |
| CI/CD friendly | ✅ | ❌ | ❌ |

## Related Files

- `client.js` - Mock backend implementation
- `../BACKEND-INTERFACE.md` - Backend contract
- `../../SKILL.md` - Main orchestration skill
- `../../templates/upload-wrapper.js` - Wrapper script
