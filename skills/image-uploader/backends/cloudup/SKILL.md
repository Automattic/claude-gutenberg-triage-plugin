# CloudUp Backend Skill

## Purpose

Upload images to CloudUp (Automattic's image hosting service) using a custom Node.js client. Returns publicly accessible URLs and markdown image links.

## GitHub Compatibility

CloudUp URLs are automatically proxied through WordPress.com's image proxy (`i0.wp.com`) to ensure images embed inline in GitHub issues and PRs.

**URL Transformation**:
- Original: `https://cldup.com/abc123/image.png`
- Returned: `https://i0.wp.com/cldup.com/abc123/image.png`

This bypasses GitHub's camo proxy limitations and allows CloudUp images to display inline instead of as clickable links.

## Authentication

Choose one method:

### Method 1: Username & Password
```bash
export CLOUDUP_USER="your-username"
export CLOUDUP_PASS="your-password"
```

### Method 2: OAuth Token (Recommended)
```bash
export CLOUDUP_TOKEN="your-oauth-token"
```

**Precedence**: Token takes precedence if both set.

### Validation
```bash
if [ -n "$CLOUDUP_TOKEN" ] || ([ -n "$CLOUDUP_USER" ] && [ -n "$CLOUDUP_PASS" ]); then
  echo "CloudUp configured"
else
  echo "ERROR: Set CLOUDUP_USER and CLOUDUP_PASS, or CLOUDUP_TOKEN"
  exit 1
fi
```

### Setup

**Username/Password**: Use CloudUp login credentials from https://cloudup.com

**OAuth Token**:
1. Visit https://cloudup.com → Settings → API
2. Click "Generate Token"
3. Copy token

**Add to shell** (`~/.bashrc` or `~/.zshrc`):
```bash
export CLOUDUP_USER="username"
export CLOUDUP_PASS="password"
# OR
export CLOUDUP_TOKEN="token"
```

Reload: `source ~/.bashrc`

## Capabilities

- **Collections**: YES (called "streams")
- **Descriptions**: YES (item titles)
- **Max File Size**: 10 MB per file
- **Formats**: png, jpg, gif, webp, svg, bmp
- **Expiration**: NO (permanent)
- **Privacy**: Public by default
- **Thumbnails**: YES (auto-generated)

## Upload Algorithm

### Step 1: Validate

**Node.js**:
```bash
command -v node &> /dev/null || error "Node.js not found. Install from nodejs.org"
```

**Credentials**:
```bash
[ -z "$CLOUDUP_TOKEN" ] && [ -z "$CLOUDUP_USER" ] && error "CloudUp not configured"
```

**Files**:
```bash
for file in "${FILES[@]}"; do
  [ ! -f "$file" ] && error "File not found: $file"
  [ ! -r "$file" ] && error "Cannot read: $file"

  mime=$(file --mime-type -b "$file")
  [[ ! "$mime" =~ ^image/ ]] && error "Not an image: $file"

  size=$(wc -c < "$file")
  [ $size -gt 10485760 ] && echo "WARNING: Large file ($((size/1048576)) MB): $file"
done
```

### Step 2: Prepare Options

```bash
# Collection title priority: explicit > issue-based > default
if [ -n "$TITLE" ]; then
  collection_title="$TITLE"
elif [ -n "$ISSUE_NUMBER" ]; then
  collection_title="Gutenberg Issue #$ISSUE_NUMBER"
else
  collection_title="Screenshots"
fi
```

### Step 3: Execute Upload

```bash
# Get plugin root
PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"

# Build JSON arguments
FILES_JSON=$(printf '%s\n' "${FILES[@]}" | jq -R . | jq -s .)
OPTIONS_JSON=$(jq -n \
  --arg title "$collection_title" \
  --arg issue "$ISSUE_NUMBER" \
  '{title: $title, issue_number: $issue}')

# Execute
cd "$PLUGIN_ROOT"
output=$(node skills/image-uploader/templates/upload-wrapper.js \
  "cloudup" \
  "$FILES_JSON" \
  "$OPTIONS_JSON" 2>&1)

[ $? -ne 0 ] && error "Upload failed: $output"
```

### Step 4: Parse Results

```bash
success=$(echo "$output" | jq -r '.success')

if [ "$success" = "true" ]; then
  urls=$(echo "$output" | jq -r '.images[].url')
  markdown=$(echo "$output" | jq -r '.markdown_all')
  collection_url=$(echo "$output" | jq -r '.collection_url')
  echo "Success! Collection: $collection_url"
else
  error=$(echo "$output" | jq -r '.error')
  instructions=$(echo "$output" | jq -r '.setup_instructions[]?' 2>/dev/null)
  echo "ERROR: $error"
  [ -n "$instructions" ] && echo "$instructions"
  exit 1
fi
```

### Step 5: Return Output

**Success**:
```json
{
  "success": true,
  "backend_used": "cloudup",
  "images": [
    {
      "local_path": "/path/to/file.png",
      "filename": "file.png",
      "url": "https://i.cloudup.com/abc123xyz.png",
      "markdown": "![file.png](https://i.cloudup.com/abc123xyz.png)"
    }
  ],
  "collection_url": "https://cloudup.com/cXyz789",
  "markdown_all": "![file.png](...)\n![file2.png](...)",
  "metadata": {
    "stream_id": "Xyz789",
    "stream_title": "Gutenberg Issue #74447"
  }
}
```

## CloudUp API

**Base URL**: `https://api.cloudup.com/1`

**Auth Headers**:
- Basic: `Authorization: Basic base64(user:pass)`
- OAuth: `Authorization: Bearer token`

**Workflow**:
1. `POST /streams` - Create collection → `{id, url}`
2. `POST /items` - Create placeholder → `{id, s3_key, s3_url, s3_policy, s3_signature, s3_access_key}`
3. `POST [s3_url]` - Upload to S3 (multipart form-data)
4. `PATCH /items/{id}` - Mark complete → `{complete: true}`
5. `GET /items/{id}` - Get URLs → `{url, direct_url}`

## Error Cases

### Authentication

**Invalid Credentials** (401):
- Message: "CloudUp authentication failed. Check CLOUDUP_USER and CLOUDUP_PASS"
- Fix: Verify credentials
- Retry: No

**Expired Token** (401 with "expired"):
- Message: "CloudUp token expired. Generate new at https://cloudup.com/account/api"
- Fix: Generate new OAuth token
- Retry: No

### Upload

**File Too Large** (413 or 400):
- Message: "File exceeds CloudUp limit (max 10 MB): file.png"
- Fix: Compress image
- Retry: No

**Unsupported Format** (400):
- Message: "CloudUp doesn't support this file type: file.pdf"
- Fix: Convert to supported format
- Retry: No

**Network Timeout** (ETIMEDOUT):
- Message: "CloudUp upload timeout, retrying (X/3)..."
- Fix: Check connection
- Retry: Yes (3x with backoff: 1s, 2s, 4s)

**S3 Upload Failed** (non-200 from S3):
- Message: "Failed to upload to CloudUp storage"
- Fix: Retry
- Retry: Yes (3x)

### Rate Limiting

**Too Many Requests** (429):
- Message: "CloudUp rate limit exceeded. Wait 60s and retry"
- Fix: Wait (honor Retry-After header)
- Retry: Yes (after delay)

**Quota Exceeded** (402 or 403):
- Message: "CloudUp account quota exceeded. Upgrade or delete old files"
- Fix: Clean up or upgrade
- Retry: No

### Service

**Server Error** (500):
- Message: "CloudUp service error. Try again in a few minutes"
- Fix: Wait and retry
- Retry: Yes (3x)

**Service Unavailable** (503):
- Message: "CloudUp temporarily down. Try again later"
- Fix: Wait
- Retry: Yes (3x with longer backoff)

### Retry Strategy

```javascript
const retryable = [
  'ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED',
  429, 500, 502, 503, 504
];

for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    return await upload();
  } catch (error) {
    if (!isRetryable(error) || attempt === 3) throw error;

    // Exponential backoff: 1s, 2s, 4s with +/- 50% jitter
    const delay = Math.pow(2, attempt - 1) * 1000;
    const jitter = delay * (0.5 + Math.random());
    await sleep(jitter);
  }
}
```

## Stream Naming

**Pattern**: `Gutenberg Issue #<number> [ - <title>]`

**Examples**:
- `Gutenberg Issue #74447`
- `Gutenberg Issue #74447 - CSS Error`
- `Screenshots` (fallback)

**Implementation**:
```javascript
let streamTitle = options.title ||
  (options.issue_number ? `Gutenberg Issue #${options.issue_number}` : 'Screenshots');
```

## Testing

### Valid Credentials
```bash
export CLOUDUP_USER="user"
export CLOUDUP_PASS="pass"
convert -size 100x100 xc:blue test.png
# Upload test.png - should succeed
```

### Invalid Credentials
```bash
export CLOUDUP_USER="invalid"
export CLOUDUP_PASS="wrong"
# Should fail with auth error and setup instructions
```

### File Validation
```bash
# Missing file - should error
# Non-image (echo "test" > test.txt) - should error
# Large file (dd if=/dev/urandom of=large.png bs=1M count=15) - should warn
```

### Multiple Files
```bash
convert -size 100x100 xc:red test1.png
convert -size 100x100 xc:green test2.png
convert -size 100x100 xc:blue test3.png
# Upload all - should create one stream with three items
```

## Security

### Credentials
- Never log credentials
- Auth via headers only (not URLs)
- Environment variables preferred
- Don't persist credentials

### Files
- MIME type validation (not just extension)
- Size limit warnings
- Path validation (no directory escape)

### Public Warning

CloudUp uploads are **public by default**. Warn users:

```
⚠️  WARNING: Uploading from outside .triage/
   Images will be publicly accessible.

   File: /Users/user/private.png

Continue? (y/N)
```

### HTTPS Only

All API communication uses HTTPS. Reject non-HTTPS URLs.

## Performance

### Sequential Uploads

Files upload sequentially (not parallel) to:
- Avoid rate limiting
- Provide clear progress
- Simplify errors

For large batches (>5 files), show progress:
```
Uploading 10 files...
[#####----------] 50% (5/10)
```

### Optimization

1. **Compress** large images:
   ```bash
   convert large.png -quality 85 -resize '1920x1920>' compressed.png
   ```

2. **Reuse stream** for multiple batches (provide stream_id)

3. **Cache stream ID** for same collection

## Examples

### From Command
```bash
/gutenberg-issue-triage:upload-screenshots \
  .triage/74447/screenshots/*.png \
  --backend=cloudup \
  --issue=74447
```

### From Skill
```json
{
  "skill": "image-uploader",
  "input": {
    "files": ["/path/img1.png", "/path/img2.png"],
    "backend": "cloudup",
    "options": {"issue_number": "74447", "title": "CSS Error"}
  }
}
```

### Direct Client (debug)
```bash
node skills/image-uploader/templates/upload-wrapper.js \
  "cloudup" \
  '["/path/img1.png"]' \
  '{"title":"Test","issue_number":"99999"}'
```

## Related Files

- `client.js` - Custom Node.js CloudUp API client
- `../BACKEND-INTERFACE.md` - Backend contract
- `../../SKILL.md` - Main orchestration skill
- `../../templates/upload-wrapper.js` - Wrapper script
