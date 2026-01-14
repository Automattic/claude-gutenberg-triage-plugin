#!/usr/bin/env node

/**
 * Auto-approve hook for Gutenberg triage plugin commands
 *
 * This hook automatically approves common commands used during triage:
 * - GitHub CLI for fetching issues
 * - Playground server management (npx wp-playground server, pkill, bin/playground.sh)
 * - File operations in .triage and .claude-code directories (mkdir, cp, mv)
 * - Read-only shell commands (ls, cat, head, tail, pwd, wc, file, stat, du, df)
 * - Background task output monitoring (tail on /tmp/claude task files)
 * - Text processing utilities (jq, grep, awk, sed -n)
 * - Browser automation via Chrome DevTools MCP (or Playwright MCP)
 * - Todo list management for tracking triage progress
 * - Process management and cleanup (ps, sleep, kill)
 * - Skill invocations for triage workflows (parse, reproduce, report)
 * - Read-only codebase exploration (Glob, Grep, Read)
 * - Exploration and planning agents (Task tool with safe subagent types)
 * - Test image creation (ImageMagick convert command)
 */

const stdin = JSON.parse(require('fs').readFileSync(0, 'utf-8'));

// Auto-approve patterns for triage commands
const autoApprovePatterns = [
  // GitHub CLI - fetch issue data
  /^gh issue view \d+ --repo WordPress\/gutenberg/,

  // Playground server management
  /^npx( --yes)? @wp-playground\/cli(@latest)? server/,
  /^\.\/bin\/playground\.sh (start|stop|status|url|logs)/,
  /^kill \$\(cat .*playground\.pid\)/,
  /^if \[ -f .*playground\.pid \]/,
  /^pkill -f "wp-playground\/cli"/,

  // File operations in .triage directory (read and write)
  /^mkdir -p \.triage/,
  /^cat .*\.triage\//,
  /^ls(-la)? .*\.triage/,
  /^tail .* .*\.triage\//,
  /^head .* .*\.triage\//,
  /^echo .* > .*\.triage\//,
  /^cp .* \.triage\//,
  /^mv .* \.triage\//,

  // Read-only commands (anywhere, not just .triage)
  /^ls( -[lah]+)?( .*)?$/,
  /^pwd$/,
  /^cat /,
  /^head /,
  /^tail /,
  /^tail -\d+ \/tmp\/claude\/.+\/tasks\/.+\.output$/,  // Background task output
  /^wc /,
  /^file /,
  /^stat /,
  /^du /,
  /^df /,

  // Process management
  /^ps aux \| grep playground/,
  /^ps -ef/,
  /^sleep \d+/,
  /^sleep \d+ &&/,  // sleep followed by other commands

  // Settings directory operations
  /^mkdir -p .*\.claude-code/,
  /^chmod \+x .*\.claude-code/,

  // Browser screenshot/file operations
  /^find (\.triage|\.playwright-mcp)/,
  /^find \. -name/,

  // Process cleanup
  /^kill -?\d+ 2>\/dev\/null/,
  /^rm .*\.triage\/playground\.(pid|url|log)/,

  // JSON/text processing (read-only utilities)
  /^jq /,
  /^grep /,
  /^awk /,
  /^sed -n/,  // sed in read-only mode only

  // Image creation for testing
  /^convert -size .* xc:/,  // ImageMagick for test images
  /^for i in .* do convert /,  // Loop for creating multiple test images
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

// Check if this is a browser automation MCP tool call (Chrome DevTools or Playwright)
if (stdin.tool?.startsWith('mcp__chrome-devtools__') ||
    stdin.tool?.startsWith('mcp__plugin_gutenberg-issue-triage_playwright__') ||
    stdin.tool?.startsWith('mcp__playwright__')) {
  process.stdout.write(JSON.stringify({
    approved: true,
    reason: 'Auto-approved browser automation (Chrome DevTools/Playwright)'
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

// Check if this is a Skill tool call (for invoking triage skills)
if (stdin.tool === 'Skill') {
  const skill = stdin.parameters?.skill || '';
  // Auto-approve triage-related skills
  if (skill.startsWith('gutenberg-issue-triage:')) {
    process.stdout.write(JSON.stringify({
      approved: true,
      reason: 'Auto-approved triage skill invocation'
    }));
    process.exit(0);
  }
}

// Check if this is a read-only codebase exploration tool
if (['Glob', 'Grep', 'Read'].includes(stdin.tool)) {
  // These are safe read-only tools for exploring the codebase
  process.stdout.write(JSON.stringify({
    approved: true,
    reason: 'Auto-approved read-only codebase exploration'
  }));
  process.exit(0);
}

// Check if this is a Task tool for exploration agents
if (stdin.tool === 'Task') {
  const subagentType = stdin.parameters?.subagent_type || '';
  // Auto-approve exploration and planning agents (safe, read-only)
  if (['Explore', 'Plan', 'general-purpose'].includes(subagentType)) {
    process.stdout.write(JSON.stringify({
      approved: true,
      reason: 'Auto-approved exploration/planning agent'
    }));
    process.exit(0);
  }
}

// Not auto-approved - let user decide
process.stdout.write(JSON.stringify({ approved: null }));
process.exit(0);
