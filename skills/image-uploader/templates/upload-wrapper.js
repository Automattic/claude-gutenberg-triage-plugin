#!/usr/bin/env node
/**
 * Upload Wrapper Script
 *
 * Generic wrapper that loads the appropriate backend client and executes uploads.
 * This allows the main skill to remain backend-agnostic.
 *
 * Usage:
 *   node upload-wrapper.js <backend> <files-json> <options-json>
 *
 * Example:
 *   node upload-wrapper.js cloudup '["/path/img.png"]' '{"title":"Test"}'
 */

const path = require('path');
const fs = require('fs');

// Parse command-line arguments
const [,, backend, filesJson, optionsJson] = process.argv;

// Validate arguments
if (!backend || !filesJson || !optionsJson) {
  console.error(JSON.stringify({
    success: false,
    error: 'Usage: node upload-wrapper.js <backend> <files-json> <options-json>',
    example: {
      command: 'node upload-wrapper.js cloudup \'["/path/to/image.png"]\' \'{"title":"My Upload"}\'',
      backends: ['cloudup', 'imgur', 'mock']
    }
  }));
  process.exit(1);
}

// Parse JSON arguments
let files, options;
try {
  files = JSON.parse(filesJson);
  options = JSON.parse(optionsJson);
} catch (error) {
  console.error(JSON.stringify({
    success: false,
    error: `Invalid JSON arguments: ${error.message}`,
    files_json: filesJson,
    options_json: optionsJson
  }));
  process.exit(1);
}

// Validate files is an array
if (!Array.isArray(files)) {
  console.error(JSON.stringify({
    success: false,
    error: 'Files must be an array',
    received: typeof files
  }));
  process.exit(1);
}

// Validate options is an object
if (typeof options !== 'object' || options === null) {
  console.error(JSON.stringify({
    success: false,
    error: 'Options must be an object',
    received: typeof options
  }));
  process.exit(1);
}

// Determine client path
const clientPath = path.join(__dirname, '..', 'backends', backend, 'client.js');

// Check if backend client exists
if (!fs.existsSync(clientPath)) {
  // List available backends
  const backendsDir = path.join(__dirname, '..', 'backends');
  const availableBackends = fs.readdirSync(backendsDir)
    .filter(name => {
      const clientFile = path.join(backendsDir, name, 'client.js');
      return fs.existsSync(clientFile);
    });

  console.error(JSON.stringify({
    success: false,
    error: `Backend not found: ${backend}`,
    error_type: 'configuration',
    available_backends: availableBackends,
    searched_path: clientPath
  }));
  process.exit(1);
}

// Load backend client
let client;
try {
  client = require(clientPath);
} catch (error) {
  console.error(JSON.stringify({
    success: false,
    error: `Failed to load backend client: ${error.message}`,
    backend: backend,
    client_path: clientPath,
    details: error.stack
  }));
  process.exit(1);
}

// Validate client has uploadFiles function
if (typeof client.uploadFiles !== 'function') {
  console.error(JSON.stringify({
    success: false,
    error: `Backend client missing uploadFiles function`,
    backend: backend,
    available_exports: Object.keys(client)
  }));
  process.exit(1);
}

// Execute upload
client.uploadFiles(files, options)
  .then(result => {
    // Ensure result has required fields
    if (!result.hasOwnProperty('success')) {
      result.success = true; // Assume success if no error thrown
    }
    if (!result.hasOwnProperty('backend_used')) {
      result.backend_used = backend;
    }

    // Output result as JSON
    console.log(JSON.stringify(result, null, 2));

    // Exit with appropriate code
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    // Handle unexpected errors
    console.error(JSON.stringify({
      success: false,
      backend_used: backend,
      error: error.message,
      error_type: 'unexpected',
      details: error.stack
    }));
    process.exit(1);
  });
