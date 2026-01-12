# Backend Interface Contract

## Purpose

This document defines the contract that all image upload backend implementations must follow. Any backend (CloudUp, Imgur, S3, etc.) must implement this interface to be compatible with the image-uploader skill.

## Backend Requirements

Every backend implementation must provide a `SKILL.md` file in `backends/<backend-name>/SKILL.md` that includes the following sections:

### 1. Authentication

Document how the backend authenticates:

**Required Information**:
- **Environment Variables**: Which env vars are required and their names
- **Authentication Method**: Basic Auth, OAuth, API key, etc.
- **Validation**: How to verify credentials are valid before attempting upload
- **Setup Instructions**: Step-by-step guide for users to obtain credentials

**Example**:
```markdown
## Authentication

**Environment Variables**:
- `CLOUDUP_USER` - Your CloudUp username
- `CLOUDUP_PASS` - Your CloudUp password
- OR `CLOUDUP_TOKEN` - OAuth token (takes precedence)

**Method**: HTTP Basic Auth or Bearer token

**Validation**:
```bash
if [ -n "$CLOUDUP_TOKEN" ] || ([ -n "$CLOUDUP_USER" ] && [ -n "$CLOUDUP_PASS" ]); then
  echo "CloudUp configured"
else
  echo "ERROR: Not configured"
  exit 1
fi
```

**Setup Instructions**:
1. Visit https://cloudup.com
2. Create account or sign in
3. For token: Settings → API → Generate token
4. Set environment variables in `~/.bashrc`:
   ```bash
   export CLOUDUP_USER="your-username"
   export CLOUDUP_PASS="your-password"
   ```
```

### 2. Capabilities

Document the backend's capabilities and limitations:

**Required Fields**:
- **Collections/Albums**: Does backend support grouping images? (YES/NO)
- **Descriptions**: Can individual images have titles/descriptions? (YES/NO)
- **Max File Size**: Upload size limit (e.g., "10 MB", "Unlimited")
- **Supported Formats**: Which image formats (png, jpg, gif, webp, svg, etc.)
- **Expiration**: Can uploads expire automatically? (YES/NO, details)
- **Privacy**: Are uploads public, private, or configurable?

**Example**:
```markdown
## Capabilities

- **Collections**: YES (called "streams" in CloudUp)
- **Descriptions**: YES (via item titles)
- **Max File Size**: 10 MB per file
- **Supported Formats**: png, jpg, gif, webp, svg
- **Expiration**: NO (uploads are permanent)
- **Privacy**: Public by default
```

### 3. Upload Algorithm

Document the step-by-step process for uploading files:

**Required Steps**:
1. Prerequisites validation (credentials, Node.js, etc.)
2. File validation (exists, is image, size check)
3. Authentication
4. Create collection/album (if supported)
5. Upload file(s)
6. Finalize/complete upload
7. Extract URLs
8. Return standardized output

**Example**:
```markdown
## Upload Algorithm

### Step 1: Validate Prerequisites
- Check Node.js available: `which node`
- Verify credentials set
- Validate files exist and are images

### Step 2: Authenticate
- Build auth header from environment variables
- Test authentication with API

### Step 3: Create Collection
- POST to `/streams` with collection title
- Store stream ID for file uploads

### Step 4: Upload Files
For each file:
- Create item in stream
- Upload file to storage
- Mark upload complete
- Extract URL

### Step 5: Return Results
- Format as standard JSON output (see Output Format below)
```

### 4. Error Cases

Document all possible errors and how to handle them:

**Required Categories**:
- **Authentication Errors**: Invalid credentials, expired tokens, etc.
- **Validation Errors**: File not found, wrong format, too large
- **Network Errors**: Timeouts, connection refused, DNS failures
- **Rate Limiting**: 429 errors, quotas exceeded
- **Service Errors**: 500, 503, API down
- **Quota/Storage Errors**: Account full, storage limit reached

**For Each Error**:
- Error condition
- How to detect it
- Error message to show user
- Suggested fix/workaround
- Retry strategy (if applicable)

**Example**:
```markdown
## Error Cases

### Authentication Errors

**Invalid Credentials**:
- Detection: 401 Unauthorized response
- Message: "CloudUp authentication failed. Check CLOUDUP_USER and CLOUDUP_PASS"
- Fix: Verify credentials, check for typos
- Retry: No (requires user action)

**Expired Token**:
- Detection: 401 with message containing "expired"
- Message: "CloudUp token expired. Generate new token at https://cloudup.com/account/api"
- Fix: Generate new OAuth token
- Retry: No

### Upload Errors

**File Too Large**:
- Detection: 413 Payload Too Large response
- Message: "File exceeds CloudUp size limit (max 10 MB): <filename>"
- Fix: Compress image or use different backend
- Retry: No

**Network Timeout**:
- Detection: Request timeout after 30s
- Message: "CloudUp upload timeout, retrying (attempt X/3)..."
- Fix: Check network connection
- Retry: Yes (3 attempts with exponential backoff)

### Rate Limiting

**Too Many Requests**:
- Detection: 429 status code
- Message: "CloudUp rate limit exceeded. Wait 60 seconds and try again"
- Fix: Wait before retrying
- Retry: Yes (after delay specified in Retry-After header)
```

### 5. Output Format

Every backend MUST return this exact JSON structure:

**Success Response**:
```json
{
  "success": true,
  "backend_used": "backend-name",
  "images": [
    {
      "local_path": "/absolute/path/to/file.png",
      "url": "https://service.com/direct-url-to-image",
      "markdown": "![filename.png](https://service.com/direct-url-to-image)"
    }
  ],
  "collection_url": "https://service.com/collection-page-url",
  "metadata": {
    "collection_id": "abc123",
    "collection_name": "Gutenberg Issue #74447"
  }
}
```

**Error Response**:
```json
{
  "success": false,
  "backend_used": "backend-name",
  "error": "Human-readable error message",
  "details": "Technical details or stack trace (optional)",
  "setup_instructions": [
    "Step 1: Do this",
    "Step 2: Do that"
  ]
}
```

**Partial Success Response** (some files failed):
```json
{
  "success": true,
  "backend_used": "backend-name",
  "images": [
    {
      "local_path": "/path/to/success.png",
      "url": "https://service.com/image1",
      "markdown": "![success.png](https://service.com/image1)"
    }
  ],
  "failed": [
    {
      "local_path": "/path/to/failed.png",
      "error": "File too large (max 10MB)"
    }
  ],
  "collection_url": "https://service.com/collection"
}
```

**Field Definitions**:
- `success` (boolean, required): Overall operation success
- `backend_used` (string, required): Name of the backend
- `images` (array, required if success): Successfully uploaded images
  - `local_path` (string): Original file path
  - `url` (string): Direct public URL to image
  - `markdown` (string): Formatted markdown image link
- `collection_url` (string, optional): URL to collection/album page
- `metadata` (object, optional): Backend-specific metadata
- `error` (string, required if !success): Error message
- `details` (string, optional): Technical error details
- `setup_instructions` (array, optional): Steps to fix configuration
- `failed` (array, optional): Files that failed in partial success

## Implementation Checklist

Use this checklist when creating a new backend:

- [ ] Create `backends/<name>/SKILL.md` file
- [ ] Document Authentication (env vars, method, validation, setup)
- [ ] Document Capabilities (collections, size, formats, expiration, privacy)
- [ ] Document Upload Algorithm (step-by-step process)
- [ ] Document Error Cases (auth, validation, network, rate limits, service)
- [ ] Define Output Format (must match standard structure)
- [ ] If backend requires Node.js code:
  - [ ] Create `backends/<name>/client.js`
  - [ ] Implement using Node.js built-ins only (no external dependencies)
  - [ ] Export `uploadFiles(files, options)` function
  - [ ] Return standardized output format
  - [ ] Implement retry logic with exponential backoff
  - [ ] Add 30s timeout per request
  - [ ] Validate HTTP status codes
  - [ ] Handle all error cases from documentation
- [ ] Test with mock credentials (expect auth failure)
- [ ] Test with real credentials (actual upload)
- [ ] Test error cases (missing file, wrong format, too large)
- [ ] Test partial failure (some files succeed, some fail)
- [ ] Update main skill's backend selection logic
- [ ] Update documentation (README.md)

## Backend Selection

The main image-uploader skill automatically selects a backend based on environment variables:

```bash
# Selection logic (in order of precedence)
IF backend explicitly specified (--backend=name):
  USE that backend
ELSE (auto mode):
  IF $CLOUDUP_TOKEN or ($CLOUDUP_USER and $CLOUDUP_PASS):
    backend = "cloudup"
  ELSE IF $IMGUR_CLIENT_ID:
    backend = "imgur"
  ELSE IF $IMAGE_UPLOAD_MOCK=true:
    backend = "mock"
  ELSE:
    ERROR: "No image upload backend configured"
    SHOW setup instructions for available backends
```

When adding a new backend, update this logic in `skills/image-uploader/SKILL.md`.

## Retry Logic Pattern

All backends should implement consistent retry logic for transient failures:

```javascript
async function uploadWithRetry(uploadFn, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await uploadFn();
    } catch (error) {
      // Retry on network errors, timeouts, and 5xx errors
      const isRetryable =
        error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNRESET' ||
        error.code === 'ENOTFOUND' ||
        (error.statusCode >= 500 && error.statusCode < 600);

      if (!isRetryable || attempt === maxAttempts) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt - 1) * 1000;
      // Add jitter: +/- 50%
      const jitter = delay * (0.5 + Math.random());
      await sleep(jitter);
    }
  }
}
```

## Testing Your Backend

### 1. Unit Tests (No Real Upload)

Mock the API responses and test:
- Credential validation
- Request formatting
- Response parsing
- Error handling
- Retry logic

### 2. Integration Tests (Real Upload)

With test credentials:
- Upload single image
- Upload multiple images
- Create collection
- Verify URLs are accessible
- Test large file (near limit)

### 3. Error Handling Tests

Simulate:
- Wrong credentials
- Missing file
- Wrong file type
- File too large
- Network timeout (disconnect mid-upload)
- API errors (mock 500, 503)

### 4. Idempotency Test

Upload the same file twice:
- Should work without errors
- May create duplicate items (depending on backend)
- Document behavior in SKILL.md

## Examples

See existing backends for reference implementations:

- `backends/cloudup/SKILL.md` - Full implementation with custom Node.js client
- `backends/mock/SKILL.md` - Simple testing backend without real uploads

## Questions?

If you're unsure about any aspect of implementing a backend:

1. Check existing backend implementations for patterns
2. Review the main skill (`skills/image-uploader/SKILL.md`)
3. Test with the mock backend first
4. Start with minimal implementation, add features incrementally

The goal is consistency across backends so users have a predictable experience regardless of which service they use.
