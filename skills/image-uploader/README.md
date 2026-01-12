# Image Uploader - Developer Documentation

## Architecture

The image uploader is a generic system with pluggable backends that allows uploading screenshots to various hosting services (CloudUp, Imgur, etc.) and returning markdown-formatted links.

### Components

```
image-uploader/
├── SKILL.md                        # Main orchestration skill
├── backends/
│   ├── BACKEND-INTERFACE.md        # Contract for all backends
│   ├── cloudup/
│   │   ├── SKILL.md                # CloudUp algorithm
│   │   └── client.js               # Custom CloudUp API client
│   └── mock/
│       ├── SKILL.md                # Testing backend
│       └── client.js               # Mock implementation
└── templates/
    └── upload-wrapper.js           # Generic backend loader
```

### Data Flow

```
User → Command → Main Skill → Backend Selection → Backend Client → Result → User
```

1. **Command** (`commands/upload-screenshots.md`): Parses arguments, validates files
2. **Main Skill** (`SKILL.md`): Validates, selects backend, orchestrates
3. **Backend** (`backends/<name>/SKILL.md`): Uploads to specific service
4. **Client** (`backends/<name>/client.js`): Implements API calls
5. **Result**: Standard JSON format with URLs and markdown

## Adding a New Backend

To add a new backend (e.g., Imgur), follow these steps:

### 1. Create Backend Directory

```bash
mkdir -p skills/image-uploader/backends/imgur
```

### 2. Write Backend Skill Documentation

Create `backends/imgur/SKILL.md` following the interface contract:

```markdown
# Imgur Backend Skill

## Purpose
Upload images to Imgur and return public URLs.

## Authentication
Environment variable: `IMGUR_CLIENT_ID`

Get from: https://api.imgur.com/oauth2/addclient

## Capabilities
- Collections: YES (albums)
- Max File Size: 10 MB
- Formats: jpg, png, gif

## Upload Algorithm
[Step-by-step process...]

## Error Cases
[Authentication, upload, rate limiting...]
```

See `backends/BACKEND-INTERFACE.md` for full requirements.

### 3. Implement Backend Client

Create `backends/imgur/client.js`:

```javascript
#!/usr/bin/env node
const https = require('https');
const fs = require('fs');
const path = require('path');

async function uploadFiles(files, options = {}) {
  // Validate credentials
  if (!process.env.IMGUR_CLIENT_ID) {
    return {
      success: false,
      error: 'Imgur not configured. Set IMGUR_CLIENT_ID',
      setup_instructions: [...]
    };
  }

  // Upload logic...
  const results = [];
  for (const filePath of files) {
    const url = await uploadToImgur(filePath);
    results.push({
      local_path: filePath,
      filename: path.basename(filePath),
      url: url,
      markdown: `![${path.basename(filePath)}](${url})`
    });
  }

  return {
    success: true,
    backend_used: 'imgur',
    images: results,
    markdown_all: results.map(r => r.markdown).join('\n')
  };
}

module.exports = { uploadFiles };
```

**Requirements**:
- Use only Node.js built-ins (no npm dependencies)
- Export `uploadFiles(files, options)` function
- Return standardized output format
- Implement retry logic with exponential backoff
- Handle all error cases from SKILL.md

### 4. Update Backend Selection

Edit `skills/image-uploader/SKILL.md`, Step 2:

```bash
elif [ -n "$IMGUR_CLIENT_ID" ]; then
  selected_backend="imgur"
  echo "Auto-detected backend: imgur"
```

### 5. Test Your Backend

```bash
# Set credentials
export IMGUR_CLIENT_ID="your-client-id"

# Test upload
node skills/image-uploader/templates/upload-wrapper.js \
  imgur \
  '["test.png"]' \
  '{"title":"Test"}'

# Test via command
/gutenberg-issue-triage:upload-screenshots test.png --backend=imgur
```

### 6. Update Documentation

- Add backend to `README.md`
- Add setup instructions
- Document any backend-specific features

## Backend Interface

All backends must follow this contract:

### Required Function

```javascript
async function uploadFiles(files, options)
```

**Parameters**:
- `files`: Array of absolute file paths
- `options`: Object with `title`, `issue_number`, `collection_name`

**Returns**: Promise resolving to:

**Success**:
```javascript
{
  success: true,
  backend_used: 'backend-name',
  images: [
    {
      local_path: '/path/file.png',
      filename: 'file.png',
      url: 'https://service.com/image-url',
      markdown: '![file.png](url)'
    }
  ],
  collection_url: 'https://service.com/collection',
  markdown_all: '![file1.png](url1)\n![file2.png](url2)'
}
```

**Error**:
```javascript
{
  success: false,
  backend_used: 'backend-name',
  error: 'Error message',
  error_type: 'authentication|validation|network|rate_limit|service',
  setup_instructions: ['Step 1', 'Step 2']
}
```

### Retry Logic

Implement exponential backoff for transient errors:

```javascript
const retryable = ['ETIMEDOUT', 'ECONNRESET', 429, 500, 502, 503, 504];

for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    return await upload();
  } catch (error) {
    if (!isRetryable(error) || attempt === 3) throw error;

    const delay = Math.pow(2, attempt - 1) * 1000;  // 1s, 2s, 4s
    const jitter = delay * (0.5 + Math.random());   // +/- 50%
    await sleep(jitter);
  }
}
```

## Testing

### Unit Tests (Mock Backend)

```bash
export IMAGE_UPLOAD_MOCK=true

# Test single file
/gutenberg-issue-triage:upload-screenshots fixtures/screenshots/test-1.png

# Test multiple files
/gutenberg-issue-triage:upload-screenshots fixtures/screenshots/*.png

# Test error handling
/gutenberg-issue-triage:upload-screenshots nonexistent.png
# Should fail gracefully
```

### Integration Tests (Real Backend)

```bash
export CLOUDUP_USER="test-user"
export CLOUDUP_PASS="test-pass"

# Upload test image
/gutenberg-issue-triage:upload-screenshots fixtures/screenshots/test-1.png

# Verify URL is accessible
curl -I <returned-url>  # Should return 200 OK

# Verify markdown syntax
# Should render correctly in GitHub
```

### Backend-Specific Tests

Test each backend's unique features:

**CloudUp**:
- Collections/streams
- Username/password vs OAuth token
- Large files (>10MB)

**Mock**:
- Deterministic URLs
- Mock directory creation
- No network calls

## Design Principles

### 1. Backend Abstraction

Backends are **pure documentation** (SKILL.md) + **minimal implementation** (client.js). This makes adding backends trivial - just document the algorithm and implement `uploadFiles()`.

### 2. No External Dependencies

All clients use only Node.js built-ins. This:
- Avoids security vulnerabilities
- Reduces maintenance burden
- Ensures compatibility
- Keeps plugin lightweight

### 3. Standard Output Format

All backends return identical JSON structure. This:
- Makes command implementation simple
- Enables easy backend switching
- Simplifies testing
- Provides consistent UX

### 4. Fail Fast, Fail Clear

- Validate early (files, credentials, backend exists)
- Provide actionable error messages
- Include setup instructions in errors
- Never fail silently

### 5. Extensibility

Adding a new backend requires:
- One SKILL.md file (documents algorithm)
- One client.js file (implements upload)
- Update backend selection logic
- No changes to main skill or command

## File Validation

All backends should validate:

```javascript
// 1. File exists
if (!fs.existsSync(filePath)) {
  throw new Error(`File not found: ${filePath}`);
}

// 2. File is readable
try {
  await fs.promises.access(filePath, fs.constants.R_OK);
} catch {
  throw new Error(`Cannot read file: ${filePath}`);
}

// 3. Optionally check MIME type (not just extension)
const { spawn } = require('child_process');
const mime = await getMimeType(filePath);  // Use `file` command
if (!mime.startsWith('image/')) {
  throw new Error(`Not an image: ${filePath}`);
}
```

## Error Handling

### Error Types

- `authentication`: Invalid credentials
- `validation`: Bad input (file not found, wrong type)
- `network`: Connection issues, timeouts
- `rate_limit`: Too many requests
- `service`: Backend service down
- `unexpected`: Unknown errors

### Error Response Format

```javascript
{
  success: false,
  backend_used: 'backend-name',
  error: 'Human-readable error message',
  error_type: 'authentication',
  setup_instructions: [
    '1. Visit https://service.com',
    '2. Create account',
    '3. Set BACKEND_API_KEY=...'
  ]
}
```

## Security

### Credentials

- **Never log credentials**: Sanitize all output
- **Environment variables**: Preferred over config files
- **No credentials in URLs**: Use headers for auth
- **Don't persist**: Clear from memory after use

### File Paths

- **Validate paths**: Prevent directory traversal
- **Warn on sensitive paths**: Files outside `.triage/` may contain sensitive data
- **Check file types**: MIME validation, not just extension

### Public Uploads

- **Warn users**: Images will be publicly accessible
- **Require confirmation**: For files outside `.triage/`
- **Document privacy**: In README and error messages

## Performance

### Optimization Strategies

1. **Sequential uploads**: Avoid rate limiting, simplify errors
2. **Progress indication**: For batches >5 files
3. **Compression**: Warn about large files, suggest compression
4. **Caching**: Cache backend availability checks per session

### Benchmarks

Typical upload times:
- **CloudUp**: ~1-2s per file (includes S3 upload)
- **Mock**: Instant (no network)
- **Imgur**: ~1-2s per file

For batches:
- 5 files: ~5-10s
- 10 files: ~10-20s
- 20+ files: Consider progress indicator

## Debugging

### Enable Verbose Logging

Clients write to stderr:

```bash
/gutenberg-issue-triage:upload-screenshots test.png 2>&1 | tee upload.log
```

### Test Backend Directly

```bash
node skills/image-uploader/backends/cloudup/client.js \
  '["test.png"]' \
  '{"title":"Test"}'
```

### Inspect Mock Directory

```bash
ls -la .triage/mock-uploads/
# Shows copied files with hashes
```

### Check Wrapper Loading

```bash
node skills/image-uploader/templates/upload-wrapper.js \
  invalid-backend \
  '["test.png"]' \
  '{}'

# Should list available backends
```

## Future Enhancements

### Phase 2 Features

1. **Additional Backends**:
   - Imgur (free, anonymous uploads)
   - GitHub Gist (uses existing `gh` auth)
   - Self-hosted S3/MinIO

2. **Image Processing**:
   - Auto-resize large images
   - Compression with quality settings
   - Annotation (arrows, text, highlights)

3. **Advanced Features**:
   - Video upload support
   - Screen recording → GIF conversion
   - OCR text extraction
   - Expiring links

4. **Performance**:
   - Parallel uploads (with rate limiting)
   - Resume interrupted uploads
   - Batch optimization

## Troubleshooting

### Common Issues

**"Backend not found"**:
- Check backend name spelling
- Verify `client.js` exists in backend directory
- List available: `ls skills/image-uploader/backends/*/client.js`

**"No backend configured"**:
- Set environment variables (see README.md)
- Or use mock: `export IMAGE_UPLOAD_MOCK=true`

**"Upload timeout"**:
- Check internet connection
- Try with smaller file
- Check backend service status

**"File not found"**:
- Use absolute paths or relative to project root
- Check file permissions
- Verify glob pattern expanded correctly

## Contributing

When contributing backends:

1. Follow the interface contract exactly
2. Use only Node.js built-ins
3. Implement comprehensive error handling
4. Add retry logic for transient failures
5. Document setup instructions clearly
6. Test with real credentials
7. Test error cases
8. Update main skill's backend selection
9. Update README.md

## Questions?

For questions or issues:

1. Check `BACKEND-INTERFACE.md` for contract details
2. Review existing backends for patterns
3. Test with mock backend first
4. File an issue on GitHub
