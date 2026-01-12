#!/usr/bin/env bash
#
# CloudUp Authentication Setup Script
# Sets up username/password authentication for CloudUp uploads
#

set -e

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Change to project root
cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  CloudUp Authentication Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 1: Check if already authenticated
if node skills/image-uploader/backends/cloudup/token-store.js check 2>/dev/null; then
  echo -e "${GREEN}✓${NC} You're already authenticated with CloudUp!"
  echo ""

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
  echo ""
fi

# Step 2: Security Warning
echo -e "${YELLOW}⚠️  SECURITY WARNING${NC}"
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

# Step 3: Prompt for username (visible)
read -p "CloudUp Username: " CLOUDUP_USERNAME
echo ""

# Validate username
if [ -z "$CLOUDUP_USERNAME" ]; then
  echo -e "${RED}ERROR:${NC} Username cannot be empty"
  exit 1
fi

# Step 4: Prompt for password (hidden)
echo "CloudUp Password (input will be hidden):"
read -s CLOUDUP_PASSWORD
echo ""

# Validate password
if [ -z "$CLOUDUP_PASSWORD" ]; then
  echo -e "${RED}ERROR:${NC} Password cannot be empty"
  exit 1
fi

if [ ${#CLOUDUP_PASSWORD} -lt 4 ]; then
  echo -e "${RED}ERROR:${NC} Password seems too short. Please check and try again."
  exit 1
fi

echo "Credentials received"
echo ""

# Step 5: Validate credentials
echo "Validating credentials..."
echo ""

# Create a temporary Node.js script to validate credentials
TEMP_SCRIPT=$(mktemp)
cat > "$TEMP_SCRIPT" << 'ENDSCRIPT'
const https = require('https');
const username = process.argv[2];
const password = process.argv[3];
const auth = Buffer.from(username + ':' + password).toString('base64');

const options = {
  hostname: 'api.cloudup.com',
  port: 443,
  path: '/1/user',
  method: 'GET',
  headers: {
    'Authorization': 'Basic ' + auth,
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
ENDSCRIPT

validation_result=$(node "$TEMP_SCRIPT" "$CLOUDUP_USERNAME" "$CLOUDUP_PASSWORD" 2>&1)
rm -f "$TEMP_SCRIPT"

# Parse validation result
success=$(echo "$validation_result" | jq -r '.success' 2>/dev/null || echo "false")

if [ "$success" != "true" ]; then
  error=$(echo "$validation_result" | jq -r '.error' 2>/dev/null || echo "Unknown error")
  echo -e "${RED}✗${NC} Credential validation failed: $error"
  echo ""
  echo "Please check:"
  echo "  - Username and password are correct"
  echo "  - Your CloudUp account is active"
  echo "  - You have internet connection"
  exit 1
fi

echo -e "${GREEN}✓${NC} Credentials are valid!"
echo ""

# Step 6: Store credentials
echo "Storing credentials securely..."

store_result=$(node skills/image-uploader/backends/cloudup/token-store.js store-credentials "$CLOUDUP_USERNAME" "$CLOUDUP_PASSWORD" 2>&1)

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓${NC} Credentials stored successfully"
else
  echo -e "${RED}✗${NC} Failed to store credentials: $store_result"
  exit 1
fi

# Clear password from memory
unset CLOUDUP_PASSWORD
unset validation_result

echo ""

# Step 7: Confirm setup
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✓${NC} CloudUp authenticated"
echo -e "${GREEN}✓${NC} Username: $CLOUDUP_USERNAME"
echo -e "${GREEN}✓${NC} Credentials stored in: ~/.claude/cloudup-credentials.json"
echo -e "${GREEN}✓${NC} File permissions: 600 (secure)"
echo ""
echo "You can now upload screenshots:"
echo "  /gutenberg-issue-triage:upload-screenshots screenshot.png"
echo ""
echo "Your credentials will be used automatically for all uploads."
echo "No environment variables needed!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
