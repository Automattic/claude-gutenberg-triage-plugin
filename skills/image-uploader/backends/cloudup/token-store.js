#!/usr/bin/env node
/**
 * CloudUp Token Storage
 *
 * Securely stores CloudUp authentication tokens in .claude directory.
 * Tokens are stored with restricted permissions (600) and automatically
 * loaded by the CloudUp client.
 *
 * @module token-store
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Credentials file location
const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const CREDS_FILE = path.join(CLAUDE_DIR, 'cloudup-credentials.json');

/**
 * Ensure .claude directory exists with proper permissions
 */
function ensureClaudeDir() {
  if (!fs.existsSync(CLAUDE_DIR)) {
    fs.mkdirSync(CLAUDE_DIR, { recursive: true, mode: 0o700 });
  }
}

/**
 * Store CloudUp credentials (username/password)
 * @param {string} username - CloudUp username
 * @param {string} password - CloudUp password
 * @returns {boolean} Success
 */
function storeCredentials(username, password) {
  try {
    ensureClaudeDir();

    // Store credentials as base64 encoded Basic Auth
    const authString = `${username}:${password}`;
    const base64Auth = Buffer.from(authString).toString('base64');

    const data = {
      username: username,
      auth: base64Auth,  // Store base64 encoded for direct use
      stored_at: new Date().toISOString(),
      type: 'basic_auth'
    };

    // Write credentials file
    fs.writeFileSync(CREDS_FILE, JSON.stringify(data, null, 2), {
      mode: 0o600  // Owner read/write only
    });

    // Verify permissions
    const stats = fs.statSync(CREDS_FILE);
    const mode = stats.mode & 0o777;
    if (mode !== 0o600) {
      console.error('Warning: Credentials file permissions not secure');
      fs.chmodSync(CREDS_FILE, 0o600);
    }

    return true;
  } catch (error) {
    console.error(`Failed to store credentials: ${error.message}`);
    return false;
  }
}

/**
 * Store CloudUp token (legacy support)
 * @param {string} token - OAuth token or API token
 * @param {Object} [metadata] - Additional metadata (username, expiry, etc.)
 * @returns {boolean} Success
 */
function storeToken(token, metadata = {}) {
  try {
    ensureClaudeDir();

    const data = {
      token: token,
      stored_at: new Date().toISOString(),
      type: 'token',
      ...metadata
    };

    // Write credentials file
    fs.writeFileSync(CREDS_FILE, JSON.stringify(data, null, 2), {
      mode: 0o600  // Owner read/write only
    });

    // Verify permissions
    const stats = fs.statSync(CREDS_FILE);
    const mode = stats.mode & 0o777;
    if (mode !== 0o600) {
      console.error('Warning: Credentials file permissions not secure');
      fs.chmodSync(CREDS_FILE, 0o600);
    }

    return true;
  } catch (error) {
    console.error(`Failed to store token: ${error.message}`);
    return false;
  }
}

/**
 * Load stored CloudUp credentials or token
 * @returns {Object|null} Credential data or null if not found
 */
function loadCredentials() {
  try {
    if (!fs.existsSync(CREDS_FILE)) {
      return null;
    }

    // Check file permissions
    const stats = fs.statSync(CREDS_FILE);
    const mode = stats.mode & 0o777;
    if (mode !== 0o600) {
      console.error('Warning: Credentials file has insecure permissions');
    }

    const data = fs.readFileSync(CREDS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Failed to load credentials: ${error.message}`);
    return null;
  }
}

/**
 * Check if credentials are stored
 * @returns {boolean}
 */
function hasCredentials() {
  return fs.existsSync(CREDS_FILE);
}

/**
 * Remove stored credentials
 * @returns {boolean} Success
 */
function removeCredentials() {
  try {
    if (fs.existsSync(CREDS_FILE)) {
      fs.unlinkSync(CREDS_FILE);
    }
    return true;
  } catch (error) {
    console.error(`Failed to remove credentials: ${error.message}`);
    return false;
  }
}

/**
 * Get authentication header value
 * Priority: stored credentials > environment variables
 * @returns {string|null} Auth header value (Bearer token or Basic auth) or null
 */
function getAuthHeader() {
  // Check stored credentials first
  const stored = loadCredentials();
  if (stored) {
    if (stored.type === 'basic_auth' && stored.auth) {
      // Return base64 encoded Basic Auth
      return `Basic ${stored.auth}`;
    } else if (stored.type === 'token' && stored.token) {
      // Return Bearer token
      return `Bearer ${stored.token}`;
    }
  }

  // Fallback to environment variables
  if (process.env.CLOUDUP_TOKEN) {
    return `Bearer ${process.env.CLOUDUP_TOKEN}`;
  }

  if (process.env.CLOUDUP_USER && process.env.CLOUDUP_PASS) {
    const credentials = Buffer.from(
      `${process.env.CLOUDUP_USER}:${process.env.CLOUDUP_PASS}`
    ).toString('base64');
    return `Basic ${credentials}`;
  }

  return null;
}

/**
 * Get credentials info (without exposing actual credentials)
 * @returns {Object|null} Credentials metadata
 */
function getCredentialsInfo() {
  const stored = loadCredentials();
  if (!stored) {
    return null;
  }

  return {
    stored_at: stored.stored_at,
    username: stored.username || 'unknown',
    type: stored.type || 'unknown',
    source: 'stored',
    file: CREDS_FILE
  };
}

// Export functions
module.exports = {
  storeCredentials,
  storeToken,           // Legacy support
  loadCredentials,
  hasCredentials,
  removeCredentials,
  getAuthHeader,
  getCredentialsInfo,
  CREDS_FILE
};

// CLI usage
if (require.main === module) {
  const command = process.argv[2];

  switch (command) {
    case 'store-credentials':
      const username = process.argv[3];
      const password = process.argv[4];
      if (!username || !password) {
        console.error('Usage: node token-store.js store-credentials <username> <password>');
        process.exit(1);
      }
      const credSuccess = storeCredentials(username, password);
      console.log(credSuccess ? 'Credentials stored successfully' : 'Failed to store credentials');
      console.log(`Location: ${CREDS_FILE}`);
      break;

    case 'store':
      const token = process.argv[3];
      const tokenUsername = process.argv[4];
      if (!token) {
        console.error('Usage: node token-store.js store <token> [username]');
        process.exit(1);
      }
      const tokenSuccess = storeToken(token, { username: tokenUsername });
      console.log(tokenSuccess ? 'Token stored successfully' : 'Failed to store token');
      console.log(`Location: ${CREDS_FILE}`);
      break;

    case 'load':
      const data = loadCredentials();
      if (data) {
        // Don't show actual credentials
        const safe = { ...data };
        if (safe.auth) safe.auth = '***';
        if (safe.token) safe.token = '***';
        console.log(JSON.stringify(safe, null, 2));
      } else {
        console.log('No credentials stored');
        process.exit(1);
      }
      break;

    case 'check':
      if (hasCredentials()) {
        const info = getCredentialsInfo();
        console.log('Credentials found:');
        console.log(`  File: ${info.file}`);
        console.log(`  Type: ${info.type}`);
        console.log(`  Stored: ${info.stored_at}`);
        console.log(`  Username: ${info.username}`);
      } else {
        console.log('No credentials stored');
        process.exit(1);
      }
      break;

    case 'remove':
      const removed = removeCredentials();
      console.log(removed ? 'Credentials removed' : 'Failed to remove credentials');
      break;

    case 'get':
      const authHeader = getAuthHeader();
      if (authHeader) {
        // Only show first few chars for security
        const masked = authHeader.substring(0, 10) + '...';
        console.log(`Auth header: ${masked}`);
      } else {
        console.log('No credentials available');
        process.exit(1);
      }
      break;

    default:
      console.log('CloudUp Credentials Store');
      console.log('');
      console.log('Commands:');
      console.log('  store-credentials <user> <pass>  Store username/password');
      console.log('  store <token> [username]         Store OAuth token (legacy)');
      console.log('  load                             Load credential data');
      console.log('  check                            Check if credentials exist');
      console.log('  get                              Get auth header (masked)');
      console.log('  remove                           Remove stored credentials');
      console.log('');
      console.log(`Credentials file: ${CREDS_FILE}`);
      break;
  }
}
