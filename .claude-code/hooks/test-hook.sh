#!/bin/bash
# Test the auto-approve hook patterns
#
# USAGE: ./.claude-code/hooks/test-hook.sh
#
# Tests that auto-approve-triage-commands.js correctly:
# - Auto-approves safe triage commands (read-only, scoped writes)
# - Requires manual approval for dangerous commands (destructive, network, system)
#
# WHEN TO UPDATE:
# When you add new patterns to auto-approve-triage-commands.js, add corresponding
# test cases here to verify they work. Add tests to the "Should be auto-approved"
# section for patterns you want auto-approved, and "Should require manual approval"
# for patterns that should still need user confirmation.
#
# All tests should pass before committing hook changes.

HOOK_FILE=".claude-code/hooks/auto-approve-triage-commands.js"

test_command() {
  local tool="$1"
  local command="$2"
  local expected="$3"  # "approved" or "manual"

  # Create test input
  local input=$(cat <<EOF
{
  "tool": "$tool",
  "parameters": {
    "command": "$command"
  }
}
EOF
)

  # Run hook
  result=$(echo "$input" | node "$HOOK_FILE")
  approved=$(echo "$result" | jq -r '.approved')

  # Check result
  if [[ "$expected" == "approved" && "$approved" == "true" ]]; then
    echo "✅ PASS: $command"
  elif [[ "$expected" == "manual" && "$approved" == "null" ]]; then
    echo "✅ PASS: $command (correctly requires approval)"
  else
    echo "❌ FAIL: $command (expected: $expected, got: approved=$approved)"
  fi
}

echo "Testing auto-approve hook patterns..."
echo ""

echo "=== Should be auto-approved ==="
test_command "Bash" "ls -la /tmp" "approved"
test_command "Bash" "mkdir -p .triage/74554" "approved"
test_command "Bash" "cp /tmp/test.jpg .triage/74554/" "approved"
test_command "Bash" "./bin/playground.sh stop" "approved"
test_command "Bash" "jq '.field' file.json" "approved"
test_command "Bash" "cat README.md" "approved"
test_command "Bash" "pwd" "approved"
test_command "Bash" "head -20 file.txt" "approved"
test_command "Bash" "grep 'pattern' file.txt" "approved"
test_command "Bash" "find . -name '*.json'" "approved"
test_command "Bash" "convert -size 800x600 xc:blue test.jpg" "approved"

echo ""
echo "=== Should require manual approval ==="
test_command "Bash" "rm -rf /tmp/test" "manual"
test_command "Bash" "curl https://example.com" "manual"
test_command "Bash" "npm install package" "manual"
test_command "Bash" "echo 'test' > /etc/hosts" "manual"
test_command "Bash" "sed -i 's/foo/bar/' file.txt" "manual"

echo ""
echo "=== Other tool types ==="

# Test Read tool
read_input='{"tool":"Read","parameters":{"file_path":"test.txt"}}'
result=$(echo "$read_input" | node "$HOOK_FILE")
approved=$(echo "$result" | jq -r '.approved')
if [[ "$approved" == "true" ]]; then
  echo "✅ PASS: Read tool auto-approved"
else
  echo "❌ FAIL: Read tool not auto-approved"
fi

# Test TodoWrite tool
todo_input='{"tool":"TodoWrite","parameters":{"todos":[]}}'
result=$(echo "$todo_input" | node "$HOOK_FILE")
approved=$(echo "$result" | jq -r '.approved')
if [[ "$approved" == "true" ]]; then
  echo "✅ PASS: TodoWrite tool auto-approved"
else
  echo "❌ FAIL: TodoWrite tool not auto-approved"
fi

echo ""
echo "Hook testing complete!"
