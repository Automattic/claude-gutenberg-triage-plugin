# Blueprint Builder Skill

Generate WordPress Playground blueprints for reproducing Gutenberg bug reports.

## Purpose

Transform parsed issue data into a Playground blueprint that matches the reported environment.

## Input

This skill receives the **parsed issue output** from the issue-parser skill. It does NOT re-fetch or re-parse the issue.

Key fields used:
- `ENVIRONMENT.WordPress` - Target WP version
- `ENVIRONMENT.Gutenberg` - Target Gutenberg version
- `ENVIRONMENT.Theme` - Theme type (block/classic)
- `REPRODUCTION STEPS` - To determine landing page

## Default Blueprint Template

Most Gutenberg bug reports need:
1. WordPress with Gutenberg plugin installed
2. Admin user logged in
3. A block theme active (Twenty Twenty-Five)

Start with this base and customize per issue:

```json
{
  "$schema": "https://playground.wordpress.net/blueprint-schema.json",
  "landingPage": "/wp-admin/",
  "preferredVersions": {
    "php": "8.2",
    "wp": "latest"
  },
  "features": {
    "networking": true
  },
  "steps": [
    {
      "step": "installPlugin",
      "pluginData": {
        "resource": "wordpress.org/plugins",
        "slug": "gutenberg"
      }
    },
    {
      "step": "login",
      "username": "admin",
      "password": "password"
    }
  ]
}
```

## Process

### 1. Determine WordPress version

From parsed `ENVIRONMENT.WordPress`:

| Parsed Value | Blueprint `wp` Value |
|--------------|---------------------|
| `6.7`, `6.7.1`, `WordPress 6.7` | `"6.7"` |
| `trunk`, `nightly` | `"nightly"` |
| `latest`, `unknown`, empty | `"latest"` |

### 2. Determine Gutenberg version

From parsed `ENVIRONMENT.Gutenberg`:

| Parsed Value | Action |
|--------------|--------|
| `built-in`, `core`, `none` | Omit the installPlugin step for Gutenberg |
| `trunk`, `nightly` | Use `"resource": "url"` with nightly build URL |
| `20.0`, `Gutenberg 20.0` | Use `"resource": "wordpress.org/plugins"` (latest from .org) |
| `latest`, `unknown`, empty | Use `"resource": "wordpress.org/plugins"` with slug `gutenberg` |

**Gutenberg nightly URL pattern:**
```
https://playground.wordpress.net/gutenberg.zip
```

### 3. Determine theme

From parsed `ENVIRONMENT.Theme`:

| Parsed Value | Action |
|--------------|--------|
| `block`, `Twenty Twenty-Five`, unknown | No change (TT5 is default block theme) |
| `classic`, `Twenty Twenty-One` | Add `installTheme` + `activateTheme` step for TT1 |
| Specific theme name | Add steps for that theme |

### 4. Determine landing page

Analyze the first reproduction step to set `landingPage`:

| Step mentions | Landing Page |
|---------------|--------------|
| "site editor", "site-editor.php" | `/wp-admin/site-editor.php` |
| "create a new post", "add new post" | `/wp-admin/post-new.php` |
| "create a new page", "add new page" | `/wp-admin/post-new.php?post_type=page` |
| "edit a post", "open a post" | Create a post first, then land on edit screen |
| "widgets", "widget editor" | `/wp-admin/widgets.php` |
| "patterns", "pattern" | `/wp-admin/site-editor.php?postType=wp_block` |
| "navigation", "menus" | `/wp-admin/site-editor.php?postType=wp_navigation` |
| "styles", "global styles" | `/wp-admin/site-editor.php?path=%2Fwp_global_styles` |
| Default | `/wp-admin/` |

### 5. Add content if needed

If reproduction requires existing content:

**Create a test post:**
```json
{
  "step": "runPHP",
  "code": "<?php require '/wordpress/wp-load.php'; wp_insert_post(['post_title' => 'Test Post', 'post_content' => '<!-- wp:paragraph --><p>Test content</p><!-- /wp:paragraph -->', 'post_status' => 'publish']); ?>"
}
```

**Create a test page:**
```json
{
  "step": "runPHP",
  "code": "<?php require '/wordpress/wp-load.php'; wp_insert_post(['post_title' => 'Test Page', 'post_content' => '<!-- wp:paragraph --><p>Test content</p><!-- /wp:paragraph -->', 'post_status' => 'publish', 'post_type' => 'page']); ?>"
}
```

## Output

Output a complete, valid Blueprint JSON that can be:
1. Saved to a file for `wp-playground run-blueprint`
2. Passed directly to the Playground CLI

Format:
```
BLUEPRINT GENERATED:

```json
{
  // Complete blueprint here
}
```

CUSTOMIZATIONS APPLIED:
- WordPress version: <version> (reason)
- Gutenberg: <version/source> (reason)
- Theme: <theme> (reason)
- Landing page: <url> (reason)
- Additional steps: <list if any>

PLAYGROUND CLI COMMAND:
npx @wp-playground/cli server --blueprint=blueprint.json

READY FOR: repro-runner skill
```

## Special Cases

### Issue specifies "Gutenberg trunk"

Use the Playground-hosted nightly build:
```json
{
  "step": "installPlugin",
  "pluginData": {
    "resource": "url",
    "url": "https://playground.wordpress.net/gutenberg.zip"
  }
}
```

### Issue requires specific plugin version

If a specific Gutenberg version is required and it's not the latest:
```json
{
  "step": "installPlugin",
  "pluginData": {
    "resource": "url",
    "url": "https://downloads.wordpress.org/plugin/gutenberg.19.9.0.zip"
  }
}
```

### Issue requires classic theme

```json
{
  "step": "installTheme",
  "themeData": {
    "resource": "wordpress.org/themes",
    "slug": "flavor"
  }
},
{
  "step": "activateTheme",
  "themeFolderName": "flavor"
}
```

## Error Cases

- **Cannot determine environment**: Use defaults, note in output
- **Conflicting requirements**: Flag for user decision
- **Unsupported requirement**: Note limitation (e.g., "requires multisite" - not supported in Playground)
