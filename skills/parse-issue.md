# GitHub Issue Parser for Playground Blueprints & Playwright Tests

## Purpose
Parse GitHub issues to extract structured information needed for creating WordPress Playground blueprints and generating reproducible Playwright test steps.

## When to Use This Skill
- User provides a GitHub issue URL or content
- User asks to create a playground blueprint from an issue
- User requests Playwright test steps from a bug report
- User needs to analyze issue reproduction steps

## Core Workflow

### 1. Fetch and Parse the GitHub Issue

First, retrieve the issue content:
```bash
# If given a URL, fetch it
curl -H "Accept: application/vnd.github.v3+json" https://api.github.com/repos/{owner}/{repo}/issues/{number}
```

Or use the `web_fetch` tool if the user provides a URL.

### 2. Extract Key Information

Parse the issue for these essential elements:

#### A. Environment Information
- WordPress version
- PHP version
- Theme name and version
- Plugin names and versions
- Browser information
- Device/OS details

#### B. Reproduction Steps
- Look for sections titled: "Steps to Reproduce", "To Reproduce", "Reproduction Steps"
- Extract numbered or bulleted steps
- Identify prerequisite setup requirements
- Note any specific content or configuration needed

#### C. Expected vs Actual Behavior
- Expected outcome
- Actual outcome/bug description
- Screenshots or video references

#### D. Code Snippets
- Custom code mentioned in the issue
- Configuration settings
- Error messages or logs

### 3. Generate Playground Blueprint

Create a JSON blueprint structure with these sections:

```json
{
  "$schema": "https://playground.wordpress.net/blueprint-schema.json",
  "landingPage": "/wp-admin/",
  "preferredVersions": {
    "php": "8.0",
    "wp": "latest"
  },
  "steps": [
    {
      "step": "login",
      "username": "admin",
      "password": "password"
    }
  ]
}
```

#### Blueprint Step Types to Consider:

**installPlugin**
```json
{
  "step": "installPlugin",
  "pluginZipFile": {
    "resource": "wordpress.org/plugins",
    "slug": "plugin-name"
  }
}
```

**installTheme**
```json
{
  "step": "installTheme",
  "themeZipFile": {
    "resource": "wordpress.org/themes",
    "slug": "theme-name"
  }
}
```

**activatePlugin**
```json
{
  "step": "activatePlugin",
  "pluginPath": "plugin-name/plugin-name.php"
}
```

**activateTheme**
```json
{
  "step": "activateTheme",
  "themeFolderName": "theme-name"
}
```

**runPHP**
```json
{
  "step": "runPHP",
  "code": "<?php // PHP code here ?>"
}
```

**writeFile**
```json
{
  "step": "writeFile",
  "path": "/wordpress/wp-content/mu-plugins/custom.php",
  "data": "<?php // Custom code ?>"
}
```

**defineWpConfigConsts**
```json
{
  "step": "defineWpConfigConsts",
  "consts": {
    "WP_DEBUG": true,
    "WP_DEBUG_LOG": true
  }
}
```

**mkdir**
```json
{
  "step": "mkdir",
  "path": "/wordpress/wp-content/uploads/custom"
}
```

**cp** (copy files)
```json
{
  "step": "cp",
  "fromPath": "/source/file.txt",
  "toPath": "/destination/file.txt"
}
```

### 4. Generate Playwright Reproduction Steps

Transform the manual reproduction steps into Playwright test code:

#### Basic Test Structure
```javascript
import { test, expect } from '@playwright/test';

test('Issue #XXX: [Brief description]', async ({ page }) => {
  // Setup: Navigate to WordPress admin
  await page.goto('http://localhost:8881/wp-admin/');
  
  // Login if needed
  await page.fill('#user_login', 'admin');
  await page.fill('#user_pass', 'password');
  await page.click('#wp-submit');
  
  // Reproduction steps
  // Step 1: [Description]
  // Step 2: [Description]
  
  // Assertion: Verify expected vs actual behavior
  // await expect(page.locator('...')).toBeVisible();
});
```

#### Common Playwright Patterns

**Navigation**
```javascript
await page.goto('/wp-admin/post-new.php');
await page.click('a:has-text("Pages")');
```

**Form Interactions**
```javascript
await page.fill('#title', 'Test Post');
await page.fill('#content', 'Post content');
await page.click('button:has-text("Publish")');
```

**Block Editor Actions**
```javascript
// Add a block
await page.click('button[aria-label="Add block"]');
await page.fill('input[placeholder="Search"]', 'paragraph');
await page.click('button:has-text("Paragraph")');

// Type in block
await page.keyboard.type('Sample text');
```

**Waiting for Elements**
```javascript
await page.waitForSelector('.notice-success');
await page.waitForLoadState('networkidle');
```

**Assertions**
```javascript
await expect(page.locator('.error-message')).toBeVisible();
await expect(page.locator('#title')).toHaveValue('Expected Title');
```

## Output Format

Provide the user with:

1. **Playground Blueprint** (as JSON file)
2. **Playwright Test Steps** (as JavaScript/TypeScript file)
3. **Summary Document** explaining:
   - What was extracted from the issue
   - Any assumptions made
   - Missing information that needs clarification
   - How to run the blueprint and tests

## Example Output Structure

Create three files:

### blueprint.json
Complete blueprint configuration

### reproduce-issue.spec.js
Playwright test with detailed steps

### README.md
```markdown
# Issue #XXX Reproduction

## Summary
[Brief description of the issue]

## Environment
- WordPress: [version]
- PHP: [version]
- Plugins: [list]
- Theme: [name]

## Running the Playground
```bash
npx @wp-playground/cli --blueprint=blueprint.json
```

## Running the Playwright Test
```bash
npx playwright test reproduce-issue.spec.js
```

## Notes
[Any assumptions, missing info, or special instructions]
```

## Best Practices

1. **Be Explicit**: Include all setup steps even if they seem obvious
2. **Version Specificity**: Use specific versions when mentioned in the issue
3. **Selectors**: Use semantic selectors (ARIA labels, text content) over brittle CSS selectors
4. **Wait Appropriately**: Add waits for dynamic content and network requests
5. **Assertions**: Include checks for both expected and actual behavior
6. **Comments**: Document each step clearly for maintainability
7. **Cleanup**: Consider teardown steps if needed
8. **Idempotency**: Ensure tests can run multiple times

## Troubleshooting Common Issues

### Missing Plugin/Theme
If a plugin/theme isn't on WordPress.org:
- Use `installPlugin` with `pluginZipFile.url` pointing to a direct download
- Or note in README that manual installation is required

### Complex Setup
For intricate configurations:
- Use `runPHP` steps to execute setup scripts
- Consider breaking into multiple smaller blueprints
- Document dependencies clearly

### Dynamic Content
For tests with dynamic IDs or content:
- Use flexible selectors (text content, ARIA labels)
- Use `page.locator()` with filters
- Avoid hardcoded IDs when possible

## Additional Resources

- [WordPress Playground Documentation](https://wordpress.github.io/wordpress-playground/)
- [Playwright Documentation](https://playwright.dev/)
- [Blueprint Schema](https://playground.wordpress.net/blueprint-schema.json)

