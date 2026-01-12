#!/usr/bin/env node
/**
 * Mock Backend Client
 *
 * Testing backend that generates fake URLs without performing real uploads.
 * Useful for development, testing, and CI/CD.
 *
 * @module mock-client
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Generate deterministic fake URL from filename
 * @param {string} filename - Original filename
 * @returns {string} Fake URL
 */
function generateFakeUrl(filename) {
  // Generate hash from filename (consistent across runs)
  const hash = crypto.createHash('md5')
    .update(filename)
    .digest('hex')
    .substring(0, 8);

  // Get file extension
  const ext = path.extname(filename) || '.png';

  // Generate fake URL
  return `https://example.com/mock-${hash}${ext}`;
}

/**
 * Generate fake collection URL
 * @param {string} title - Collection title
 * @returns {string} Fake collection URL
 */
function generateCollectionUrl(title) {
  const hash = crypto.createHash('md5')
    .update(title || 'default')
    .digest('hex')
    .substring(0, 8);

  return `https://example.com/mock-collection-${hash}`;
}

/**
 * Optionally copy file to mock directory for verification
 * @param {string} filePath - Source file path
 * @param {string} filename - Base filename
 * @returns {string|null} Destination path or null if copy failed
 */
function copyToMockDirectory(filePath, filename) {
  try {
    const mockDir = path.join(process.cwd(), '.triage', 'mock-uploads');

    // Create directory if it doesn't exist
    if (!fs.existsSync(mockDir)) {
      fs.mkdirSync(mockDir, { recursive: true });
    }

    // Generate hash for filename
    const hash = crypto.createHash('md5')
      .update(filename)
      .digest('hex')
      .substring(0, 8);

    // Destination path
    const destPath = path.join(mockDir, `${hash}-${filename}`);

    // Copy file
    fs.copyFileSync(filePath, destPath);

    return destPath;
  } catch (error) {
    console.error(`Warning: Failed to copy to mock directory: ${error.message}`);
    return null;
  }
}

/**
 * Upload files (mock - no actual upload)
 * @param {string[]} files - Array of file paths
 * @param {Object} options - Upload options
 * @param {string} [options.title] - Collection title
 * @param {string} [options.issue_number] - Issue number
 * @param {boolean} [options.copy_files=true] - Copy files to mock directory
 * @returns {Promise<Object>} Mock upload result
 */
async function uploadFiles(files, options = {}) {
  try {
    // Validate mock mode is enabled
    if (process.env.IMAGE_UPLOAD_MOCK !== 'true') {
      return {
        success: false,
        backend_used: 'mock',
        error: 'Mock backend requires IMAGE_UPLOAD_MOCK=true',
        error_type: 'configuration',
        setup_instructions: [
          'export IMAGE_UPLOAD_MOCK=true'
        ]
      };
    }

    // Validate files exist
    for (const filePath of files) {
      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          backend_used: 'mock',
          error: `File not found: ${filePath}`,
          error_type: 'validation'
        };
      }
    }

    // Determine collection title
    let collectionTitle = options.title;
    if (!collectionTitle && options.issue_number) {
      collectionTitle = `Gutenberg Issue #${options.issue_number}`;
    }
    if (!collectionTitle) {
      collectionTitle = 'Mock Screenshots';
    }

    console.error(`Mock upload: ${files.length} file(s) to "${collectionTitle}"`);

    // Process each file
    const results = [];
    const copyFiles = options.copy_files !== false;

    for (const filePath of files) {
      const filename = path.basename(filePath);
      const fakeUrl = generateFakeUrl(filename);

      // Optionally copy file to mock directory
      let mockPath = null;
      if (copyFiles) {
        mockPath = copyToMockDirectory(filePath, filename);
      }

      results.push({
        local_path: filePath,
        filename: filename,
        url: fakeUrl,
        markdown: `![${filename}](${fakeUrl})`,
        mock_copy: mockPath
      });

      console.error(`✓ ${filename} → ${fakeUrl}`);
    }

    // Generate fake collection URL
    const collectionUrl = generateCollectionUrl(collectionTitle);

    // Build markdown string
    const markdownAll = results.map(r => r.markdown).join('\n');

    // Return success response
    return {
      success: true,
      backend_used: 'mock',
      images: results.map(r => ({
        local_path: r.local_path,
        filename: r.filename,
        url: r.url,
        markdown: r.markdown
      })),
      collection_url: collectionUrl,
      markdown_all: markdownAll,
      metadata: {
        note: 'MOCK MODE: No actual upload performed',
        collection_title: collectionTitle,
        mock_directory: copyFiles ? '.triage/mock-uploads' : null
      }
    };
  } catch (error) {
    // Handle unexpected errors
    return {
      success: false,
      backend_used: 'mock',
      error: error.message,
      error_type: 'unexpected',
      details: error.stack
    };
  }
}

// Export for use as module
module.exports = {
  uploadFiles,
  generateFakeUrl,
  generateCollectionUrl
};

// CLI usage: node client.js <files-json> <options-json>
if (require.main === module) {
  const [,, filesJson, optionsJson] = process.argv;

  if (!filesJson || !optionsJson) {
    console.error(JSON.stringify({
      success: false,
      error: 'Usage: node client.js <files-json> <options-json>',
      example: 'node client.js \'["/path/to/test.png"]\' \'{"title":"Test"}\''
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
          backend_used: 'mock',
          error: error.message,
          stack: error.stack
        }));
        process.exit(1);
      });
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      backend_used: 'mock',
      error: `Invalid JSON arguments: ${error.message}`
    }));
    process.exit(1);
  }
}
