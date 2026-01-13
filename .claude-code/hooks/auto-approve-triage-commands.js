#!/usr/bin/env node

/**
 * Auto-approve hook for Gutenberg triage plugin commands
 *
 * This hook automatically approves common commands used during triage:
 * - GitHub CLI for fetching issues
 * - Playground server management (start, stop, cleanup)
 * - File operations in .triage and .claude-code directories
 * - Browser automation via Playwright MCP
 * - Todo list management for tracking triage progress
 * - Process management and permissions
 */

const stdin = JSON.parse(require('fs').readFileSync(0, 'utf-8'));

// Auto-approve patterns for triage commands
const autoApprovePatterns = [
  // GitHub CLI - fetch issue data
  /^gh issue view \d+ --repo WordPress\/gutenberg/,

  // Playground server management
  /^npx --yes @wp-playground\/cli@latest server --blueprint=/,
  /^kill \$\(cat .*playground\.pid\)/,
  /^if \[ -f .*playground\.pid \]/,

  // File operations in .triage directory
  /^mkdir -p .*\.triage/,
  /^cat .*\.triage\//,
  /^ls -la .*\.triage/,
  /^tail .* .*\.triage\//,
  /^echo .* > .*\.triage\//,

  // Process management
  /^ps aux \| grep playground/,
  /^sleep \d+/,

  // Settings directory operations
  /^mkdir -p .*\.claude-code/,
  /^chmod \+x .*\.claude-code/,

  // Browser screenshot/file operations
  /^find \.triage/,
  /^ls -la/,

  // Process cleanup
  /^kill -?\d+ 2>\/dev\/null/,
  /^rm .*\.triage\/playground\.(pid|url|log)/,
];

// Check if this is a Bash tool call
if (stdin.tool === 'Bash') {
  const command = stdin.parameters?.command || '';

  // Check if command matches any auto-approve pattern
  for (const pattern of autoApprovePatterns) {
    if (pattern.test(command)) {
      process.stdout.write(JSON.stringify({
        approved: true,
        reason: 'Auto-approved triage command'
      }));
      process.exit(0);
    }
  }
}

// Check if this is a Write/Read/Edit tool for .triage directory
if (['Write', 'Read', 'Edit'].includes(stdin.tool)) {
  const filePath = stdin.parameters?.file_path || '';

  if (filePath.includes('.triage/') || filePath.includes('.claude-code/')) {
    process.stdout.write(JSON.stringify({
      approved: true,
      reason: 'Auto-approved file operation in triage directory'
    }));
    process.exit(0);
  }
}

// Check if this is a Playwright MCP tool call
if (stdin.tool?.startsWith('mcp__plugin_gutenberg-issue-triage_playwright__') ||
    stdin.tool?.startsWith('mcp__playwright__')) {
  process.stdout.write(JSON.stringify({
    approved: true,
    reason: 'Auto-approved Playwright browser automation'
  }));
  process.exit(0);
}

// Check if this is a TodoWrite tool call (for tracking triage progress)
if (stdin.tool === 'TodoWrite') {
  process.stdout.write(JSON.stringify({
    approved: true,
    reason: 'Auto-approved todo list management for triage tracking'
  }));
  process.exit(0);
}

// Not auto-approved - let user decide
process.stdout.write(JSON.stringify({ approved: null }));
process.exit(0);
