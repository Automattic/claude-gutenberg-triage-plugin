---
description: Set up CloudUp authentication for image uploads
allowed_args: []
bash: bin/setup-cloudup.sh
---

# Setup CloudUp Command

Interactive setup wizard to configure CloudUp authentication. Guides you through entering your CloudUp username and password, then securely stores them for future use.

## Usage

```bash
/gutenberg-issue-triage:setup-cloudup
```

This command runs the `bin/setup-cloudup.sh` script which provides proper terminal interaction for secure password entry.

## What This Command Does

1. Checks if you're already authenticated
2. Shows security warning about storing credentials locally
3. Prompts for your CloudUp username (visible)
4. Prompts for your CloudUp password (**hidden input** - uses `read -s`)
5. Validates credentials work by making a test API request
6. Securely stores credentials in `~/.claude/cloudup-credentials.json` (file permissions: 600)
7. Confirms setup is complete

After running this once, you never need to set environment variables or configure credentials again!

## Security Features

- **Hidden password input**: Password is never displayed in terminal
- **Secure storage**: Credentials file has 600 permissions (owner read/write only)
- **Memory cleanup**: Password cleared from shell variables after storage
- **No logs**: Password never appears in command history or logs
- **Validation**: Credentials tested against CloudUp API before storing

## Interactive Flow

### Step 1: Check Current Authentication

```bash
echo "Checking CloudUp authentication..."
echo ""

# Check if credentials already exist
if node skills/image-uploader/backends/cloudup/token-store.js check 2>/dev/null; then
  echo "✓ You're already authenticated with CloudUp!"
  echo ""

  # Show credentials info
  node skills/image-uploader/backends/cloudup/token-store.js check
  echo ""

  read -p "Re-authenticate? (y/N) " -n 1 -r
  echo ""

  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Setup cancelled. Your existing authentication is still active."
    exit 0
  fi

  echo ""
  echo "Replacing existing credentials..."
fi
```

### Step 2: Show Security Warning and Prompt for Credentials

```bash
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  CloudUp Authentication Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  SECURITY WARNING"
echo ""
echo "Your CloudUp credentials will be stored locally in:"
echo "  ~/.claude/cloudup-credentials.json"
echo ""
echo "Security measures:"
echo "  • File permissions set to 600 (owner read/write only)"
echo "  • Password never shown in terminal or logs"
echo "  • Credentials only transmitted to cloudup.com via HTTPS"
echo ""
echo "Only proceed if you understand and accept these security"
echo "implications. Press Ctrl+C to cancel."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Prompt for username (visible)
read -p "CloudUp Username: " CLOUDUP_USERNAME
echo ""

# Validate username
if [ -z "$CLOUDUP_USERNAME" ]; then
  echo "ERROR: Username cannot be empty"
  exit 1
fi

# Prompt for password (hidden)
echo "CloudUp Password (input will be hidden):"
read -s CLOUDUP_PASSWORD
echo ""

# Validate password
if [ -z "$CLOUDUP_PASSWORD" ]; then
  echo "ERROR: Password cannot be empty"
  exit 1
fi

if [ ${#CLOUDUP_PASSWORD} -lt 4 ]; then
  echo "ERROR: Password seems too short. Please check and try again."
  exit 1
fi

echo "Credentials received"
echo ""
```

### Step 3: Validate Credentials

```bash
echo "Validating credentials..."

# Encode credentials as base64 for Basic Auth
CLOUDUP_AUTH=$(echo -n "${CLOUDUP_USERNAME}:${CLOUDUP_PASSWORD}" | base64)

# Test credentials by making a simple API request
validation_result=$(node -e "
const https = require('https');

const options = {
  hostname: 'api.cloudup.com',
  port: 443,
  path: '/1/user',
  method: 'GET',
  headers: {
    'Authorization': 'Basic ${CLOUDUP_AUTH}',
    'User-Agent': 'Gutenberg-Triage-Plugin/1.0'
  },
  timeout: 10000
};

const req = https.request(options, (res) => {
  if (res.statusCode === 200) {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const user = JSON.parse(data);
        console.log(JSON.stringify({
          success: true,
          username: user.username || user.name || 'unknown'
        }));
      } catch (e) {
        console.log(JSON.stringify({success: true, username: 'unknown'}));
      }
    });
  } else {
    console.log(JSON.stringify({
      success: false,
      error: 'Authentication failed',
      status: res.statusCode
    }));
  }
});

req.on('error', (error) => {
  console.log(JSON.stringify({
    success: false,
    error: error.message
  }));
});

req.on('timeout', () => {
  req.destroy();
  console.log(JSON.stringify({
    success: false,
    error: 'Request timeout'
  }));
});

req.end();
" 2>&1)

# Parse validation result
success=$(echo "$validation_result" | jq -r '.success' 2>/dev/null || echo "false")

if [ "$success" != "true" ]; then
  error=$(echo "$validation_result" | jq -r '.error' 2>/dev/null || echo "Unknown error")
  echo "✗ Credential validation failed: $error"
  echo ""
  echo "Please check:"
  echo "  - Username and password are correct"
  echo "  - Your CloudUp account is active"
  echo "  - You have internet connection"
  exit 1
fi

echo "✓ Credentials are valid!"
echo ""
```

### Step 4: Store Credentials

```bash
echo "Storing credentials securely..."

# Store credentials using token-store module
store_result=$(node skills/image-uploader/backends/cloudup/token-store.js store-credentials "$CLOUDUP_USERNAME" "$CLOUDUP_PASSWORD" 2>&1)

if [ $? -eq 0 ]; then
  echo "✓ Credentials stored successfully"
else
  echo "✗ Failed to store credentials: $store_result"
  exit 1
fi

# Clear password from memory
unset CLOUDUP_PASSWORD
unset CLOUDUP_AUTH

echo ""
```

### Step 5: Confirm Setup

```bash
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✓ CloudUp authenticated"
echo "✓ Username: $CLOUDUP_USERNAME"
echo "✓ Credentials stored in: ~/.claude/cloudup-credentials.json"
echo "✓ File permissions: 600 (secure)"
echo ""
echo "You can now upload screenshots:"
echo "  /gutenberg-issue-triage:upload-screenshots screenshot.png"
echo ""
echo "Your credentials will be used automatically for all uploads."
echo "No environment variables needed!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

## Testing

### Test Setup Flow

```bash
# Run setup
/gutenberg-issue-triage:setup-cloudup

# Follow prompts to enter token

# Verify token stored
node skills/image-uploader/backends/cloudup/token-store.js check

# Test upload
/gutenberg-issue-triage:upload-screenshots test.png
# Should use stored token automatically
```

### Test Re-authentication

```bash
# Run setup again
/gutenberg-issue-triage:setup-cloudup

# Should detect existing token and ask to replace
```

### Test Token Removal

```bash
# Remove token
node skills/image-uploader/backends/cloudup/token-store.js remove

# Run setup again
/gutenberg-issue-triage:setup-cloudup

# Should prompt for new token
```

## Security

### Token Storage

- Stored in `~/.claude/cloudup-token.json`
- File permissions: `600` (owner read/write only)
- Token never displayed in logs
- Token never transmitted except to CloudUp API

### Token Input

- Uses `read -s` for hidden input
- Token not visible in command history
- Token not shown in terminal

### Validation

- Tests token before storing
- Confirms authentication works
- Detects revoked or invalid tokens

## Troubleshooting

### "Token validation failed"

**Cause**: Invalid token or network issues

**Fix**:
1. Copy token again from CloudUp (no extra spaces)
2. Check internet connection
3. Verify token hasn't been revoked

### "Failed to store token"

**Cause**: Permission issues with `~/.claude` directory

**Fix**:
```bash
mkdir -p ~/.claude
chmod 700 ~/.claude
/gutenberg-issue-triage:setup-cloudup
```

### "Token seems too short"

**Cause**: Incomplete token paste

**Fix**:
- Ensure entire token is copied
- Check no characters were truncated
- Try pasting in text editor first to verify

## Updating Token

To replace your token:

```bash
/gutenberg-issue-triage:setup-cloudup
# When prompted, choose to re-authenticate
```

Or manually:

```bash
# Remove old token
node skills/image-uploader/backends/cloudup/token-store.js remove

# Run setup again
/gutenberg-issue-triage:setup-cloudup
```

## Related Commands

- `/upload-screenshots` - Upload images using stored token
- Check token: `node skills/image-uploader/backends/cloudup/token-store.js check`
- Remove token: `node skills/image-uploader/backends/cloudup/token-store.js remove`

## Implementation Notes

### Why This Approach?

CloudUp doesn't support OAuth device flow, so we can't do the "enter code" style auth like `gh`. Instead, we:

1. Guide user to generate token on CloudUp website
2. Securely capture token input
3. Validate token works
4. Store encrypted in user's home directory

This provides a smooth UX similar to device flow without requiring it.

### Token Precedence

The CloudUp client checks credentials in this order:

1. Stored token (`~/.claude/cloudup-token.json`)
2. Environment variable (`$CLOUDUP_TOKEN`)
3. Basic auth (`$CLOUDUP_USER` + `$CLOUDUP_PASS`)

This allows both stored tokens and environment variables to work.

### Future Enhancements

- Automatic token refresh (if CloudUp adds refresh tokens)
- Multiple account support
- Token expiration detection
- Revocation handling
