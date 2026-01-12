#!/usr/bin/env node
/**
 * CloudUp API Client
 *
 * Custom lightweight client for uploading images to CloudUp.
 * Uses only Node.js built-in modules (no external dependencies).
 *
 * @module cloudup-client
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);

// Load token store
const tokenStore = require('./token-store');

// API Configuration
const API_HOST = 'api.cloudup.com';
const API_BASE_PATH = '/1';
const REQUEST_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;

/**
 * Get authentication header from stored credentials or environment variables
 * @returns {string} Authorization header value
 * @throws {Error} If no credentials configured
 */
function getAuthHeader() {
  // Use token store's getAuthHeader which handles all credential types
  const authHeader = tokenStore.getAuthHeader();

  if (authHeader) {
    return authHeader;
  }

  throw new Error('No CloudUp credentials configured. Run /gutenberg-issue-triage:setup-cloudup or set environment variables');
}

/**
 * Make HTTPS request to CloudUp API
 * @param {string} method - HTTP method
 * @param {string} apiPath - API path (e.g., '/streams')
 * @param {Object} [data] - Request body data
 * @param {Object} [headers] - Additional headers
 * @returns {Promise<Object>} Response data
 */
function makeRequest(method, apiPath, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const auth = getAuthHeader();
    const body = data ? JSON.stringify(data) : null;

    const options = {
      hostname: API_HOST,
      port: 443,
      path: `${API_BASE_PATH}${apiPath}`,
      method,
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/json',
        'User-Agent': 'Gutenberg-Triage-Plugin/1.0',
        ...headers
      },
      timeout: REQUEST_TIMEOUT
    };

    if (body) {
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        // Check status code first
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // Success - try to parse JSON, but handle plain text responses
          if (!responseData || responseData.trim() === 'OK' || responseData.trim() === '') {
            // Plain text or empty response - treat as success
            resolve({ status: res.statusCode, data: {} });
          } else {
            try {
              const parsed = JSON.parse(responseData);
              resolve({ status: res.statusCode, data: parsed });
            } catch (e) {
              // If we can't parse JSON but status is 2xx, treat as success
              resolve({ status: res.statusCode, data: { response: responseData } });
            }
          }
        } else {
          // Error response - try to parse JSON for error details
          let parsed;
          try {
            parsed = JSON.parse(responseData);
          } catch (e) {
            // Plain text error
            const error = new Error(`CloudUp API error: ${res.statusCode} - ${responseData}`);
            error.statusCode = res.statusCode;
            error.response = responseData;
            return reject(error);
          }

          const error = new Error(parsed.message || `CloudUp API error: ${res.statusCode}`);
          error.statusCode = res.statusCode;
          error.response = parsed;
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      error.code = error.code || 'ECONNECTION';
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      const error = new Error('Request timeout');
      error.code = 'ETIMEDOUT';
      reject(error);
    });

    if (body) {
      req.write(body);
    }

    req.end();
  });
}

/**
 * Upload file to S3 using multipart form-data
 * @param {string} filePath - Local file path
 * @param {Object} s3Creds - S3 credentials from CloudUp
 * @returns {Promise<void>}
 */
function uploadToS3(filePath, s3Creds) {
  return new Promise(async (resolve, reject) => {
    try {
      const fileBuffer = await readFile(filePath);
      const fileName = path.basename(filePath);
      const boundary = `----WebKitFormBoundary${Date.now()}${Math.random().toString(36)}`;

      // Build multipart form-data body
      const parts = [];

      // Add form fields - ORDER MATTERS for S3!
      // Must be in same order as policy
      const fields = {
        'key': s3Creds.s3_key,
        'AWSAccessKeyId': s3Creds.s3_access_key,
        'acl': 'public-read',
        'policy': s3Creds.s3_policy,
        'signature': s3Creds.s3_signature,
        'Content-Type': 'application/octet-stream',
        'Content-Length': fileBuffer.length.toString()
      };

      for (const [name, value] of Object.entries(fields)) {
        parts.push(
          `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="${name}"\r\n\r\n` +
          `${value}\r\n`
        );
      }

      // Add file
      parts.push(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
        `Content-Type: application/octet-stream\r\n\r\n`
      );

      const header = parts.join('');
      const footer = `\r\n--${boundary}--\r\n`;

      const headerBuffer = Buffer.from(header, 'utf8');
      const footerBuffer = Buffer.from(footer, 'utf8');
      const bodyBuffer = Buffer.concat([headerBuffer, fileBuffer, footerBuffer]);

      // Parse S3 URL
      const url = new URL(s3Creds.s3_url);

      const options = {
        hostname: url.hostname,
        port: url.protocol === 'https:' ? 443 : 80,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': bodyBuffer.length
        },
        timeout: REQUEST_TIMEOUT
      };

      const protocol = url.protocol === 'https:' ? https : require('http');
      const req = protocol.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            const error = new Error(`S3 upload failed: ${res.statusCode}`);
            error.statusCode = res.statusCode;
            error.response = responseData;
            reject(error);
          }
        });
      });

      req.on('error', reject);

      req.on('timeout', () => {
        req.destroy();
        const error = new Error('S3 upload timeout');
        error.code = 'ETIMEDOUT';
        reject(error);
      });

      req.write(bodyBuffer);
      req.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable
 * @param {Error} error - Error to check
 * @returns {boolean}
 */
function isRetryable(error) {
  // Retryable error codes
  const retryableCodes = ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ECONNECTION'];
  if (retryableCodes.includes(error.code)) {
    return true;
  }

  // Retryable HTTP status codes
  const retryableStatuses = [429, 500, 502, 503, 504];
  if (error.statusCode && retryableStatuses.includes(error.statusCode)) {
    return true;
  }

  return false;
}

/**
 * Execute function with retry logic
 * @param {Function} fn - Async function to execute
 * @param {number} maxAttempts - Maximum retry attempts
 * @returns {Promise<any>} Function result
 */
async function withRetry(fn, maxAttempts = MAX_RETRIES) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isRetryable(error) || attempt === maxAttempts) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt - 1) * 1000;
      // Add jitter: +/- 50%
      const jitter = delay * (0.5 + Math.random());

      console.error(`Attempt ${attempt} failed: ${error.message}. Retrying in ${Math.round(jitter)}ms...`);
      await sleep(jitter);
    }
  }
}

/**
 * Create a stream (collection) in CloudUp
 * @param {string} title - Stream title
 * @returns {Promise<Object>} Stream object {id, url, title}
 */
async function createStream(title) {
  const response = await withRetry(() => makeRequest('POST', '/streams', { title }));
  return {
    id: response.data.id,
    url: response.data.url,
    title: response.data.title
  };
}

/**
 * Create an item in a stream
 * @param {string} filename - File name
 * @param {string} streamId - Stream ID
 * @returns {Promise<Object>} Item object with S3 credentials
 */
async function createItem(filename, streamId) {
  const response = await withRetry(() => makeRequest('POST', '/items', { filename, stream_id: streamId }));
  return {
    id: response.data.id,
    s3_key: response.data.s3_key,
    s3_url: response.data.s3_url,
    s3_policy: response.data.s3_policy,
    s3_signature: response.data.s3_signature,
    s3_access_key: response.data.s3_access_key
  };
}

/**
 * Mark an item as complete
 * @param {string} itemId - Item ID
 * @returns {Promise<void>}
 */
async function completeItem(itemId) {
  await withRetry(() => makeRequest('PATCH', `/items/${itemId}`, { complete: true }));
}

/**
 * Get item details including URLs
 * @param {string} itemId - Item ID
 * @returns {Promise<Object>} Item details {url, direct_url}
 */
async function getItem(itemId) {
  const response = await withRetry(() => makeRequest('GET', `/items/${itemId}`));
  return {
    url: response.data.url,
    direct_url: response.data.direct_url
  };
}

/**
 * Upload multiple files to CloudUp
 * @param {string[]} files - Array of file paths
 * @param {Object} options - Upload options
 * @param {string} [options.title] - Collection title
 * @param {string} [options.issue_number] - Issue number for title generation
 * @param {string} [options.collection_name] - Collection name slug
 * @returns {Promise<Object>} Upload result
 */
async function uploadFiles(files, options = {}) {
  try {
    // Validate files
    for (const filePath of files) {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
    }

    // Determine stream title
    let streamTitle = options.title;
    if (!streamTitle && options.issue_number) {
      streamTitle = `Gutenberg Issue #${options.issue_number}`;
    }
    if (!streamTitle) {
      streamTitle = 'Screenshots';
    }

    // Create stream
    console.error(`Creating CloudUp stream: ${streamTitle}`);
    const stream = await createStream(streamTitle);
    console.error(`Stream created: ${stream.url}`);

    // Upload each file
    const results = [];
    for (let i = 0; i < files.length; i++) {
      const filePath = files[i];
      const filename = path.basename(filePath);

      console.error(`[${i + 1}/${files.length}] Uploading ${filename}...`);

      try {
        // Create item
        const item = await createItem(filename, stream.id);

        // Upload to S3
        await withRetry(() => uploadToS3(filePath, item));

        // Mark complete
        await completeItem(item.id);

        // Get final URLs
        const itemDetails = await getItem(item.id);

        // Proxy CloudUp URLs through WordPress.com image proxy for GitHub compatibility
        // Converts: https://cldup.com/abc123/file.png
        // To: https://i0.wp.com/cldup.com/abc123/file.png
        const githubCompatibleUrl = itemDetails.direct_url.replace(/^https?:\/\//, 'https://i0.wp.com/');

        results.push({
          local_path: filePath,
          filename: filename,
          url: githubCompatibleUrl,
          markdown: `![${filename}](${githubCompatibleUrl})`
        });

        console.error(`✓ ${filename} uploaded successfully`);
      } catch (error) {
        console.error(`✗ ${filename} failed: ${error.message}`);
        throw error; // Stop on first failure
      }
    }

    // Build markdown string
    const markdownAll = results.map(r => r.markdown).join('\n');

    return {
      success: true,
      backend_used: 'cloudup',
      images: results,
      collection_url: stream.url,
      markdown_all: markdownAll,
      metadata: {
        stream_id: stream.id,
        stream_title: stream.title
      }
    };
  } catch (error) {
    // Format error response
    const errorResponse = {
      success: false,
      backend_used: 'cloudup',
      error: error.message
    };

    // Add authentication setup instructions for auth errors
    if (error.statusCode === 401) {
      errorResponse.error_type = 'authentication';
      errorResponse.setup_instructions = [
        '1. Visit https://cloudup.com',
        '2. Create account or sign in',
        '3. For OAuth token: Settings → API → Generate token',
        '4. Set environment variables:',
        '   export CLOUDUP_USER="your-username"',
        '   export CLOUDUP_PASS="your-password"',
        '   OR',
        '   export CLOUDUP_TOKEN="your-oauth-token"'
      ];
    } else if (error.statusCode === 413 || (error.statusCode === 400 && error.message.includes('size'))) {
      errorResponse.error_type = 'validation';
      errorResponse.error = 'File exceeds CloudUp size limit (max 10 MB)';
    } else if (error.code === 'ETIMEDOUT') {
      errorResponse.error_type = 'network';
      errorResponse.error = 'Upload timeout. Check your internet connection';
    } else if (error.statusCode === 429) {
      errorResponse.error_type = 'rate_limit';
      errorResponse.error = 'CloudUp rate limit exceeded. Wait and try again';
    } else if (error.statusCode >= 500) {
      errorResponse.error_type = 'service';
      errorResponse.error = 'CloudUp service error. Try again in a few minutes';
    }

    return errorResponse;
  }
}

// Export for use as module
module.exports = {
  uploadFiles,
  createStream,
  createItem,
  uploadToS3,
  completeItem,
  getItem
};

// CLI usage: node client.js <files-json> <options-json>
if (require.main === module) {
  const [,, filesJson, optionsJson] = process.argv;

  if (!filesJson || !optionsJson) {
    console.error(JSON.stringify({
      success: false,
      error: 'Usage: node client.js <files-json> <options-json>',
      example: 'node client.js \'["/path/to/img1.png"]\' \'{"title":"My Collection"}\''
    }));
    process.exit(1);
  }

  try {
    const files = JSON.parse(filesJson);
    const options = JSON.parse(optionsJson);

    uploadFiles(files, options)
      .then(result => {
        console.log(JSON.stringify(result, null, 2));
        process.exit(result.success ? 0 : 1);
      })
      .catch(error => {
        console.error(JSON.stringify({
          success: false,
          error: error.message,
          stack: error.stack
        }));
        process.exit(1);
      });
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      error: `Invalid JSON arguments: ${error.message}`
    }));
    process.exit(1);
  }
}
