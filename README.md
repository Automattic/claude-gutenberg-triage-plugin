# Gutenberg Issue Triage Plugin

A Claude Code plugin that helps reproduce WordPress Gutenberg bug reports.

## What It Does

Given a Gutenberg GitHub issue, this plugin:

1. Parses the issue to extract reproduction steps and environment details
2. Generates a WordPress Playground blueprint matching the environment
3. Spins up a local WordPress Playground instance for testing

## Requirements

- [GitHub CLI (`gh`)](https://cli.github.com/) - authenticated
- [Node.js](https://nodejs.org/) - for WordPress Playground

## Installation

Clone the repository:

```bash
git clone https://github.com/Automattic/claude-gutenberg-triage-plugin.git
```

## Usage

Start Claude with the plugin loaded:

```bash
claude --plugin-dir /path/to/claude-gutenberg-triage-plugin
```

Triage an issue:

```bash
/gutenberg-issue-triage:triage 74447
/gutenberg-issue-triage:triage https://github.com/WordPress/gutenberg/issues/74447
```

The plugin will parse the issue, generate a Playground blueprint, and start WordPress at `http://127.0.0.1:9400`.

When done testing, stop Playground:

```bash
./bin/playground.sh stop
```

## Image Upload

The plugin can upload screenshots to CloudUp (Automattic's image hosting service) for sharing in GitHub issues and PRs.

### Setup CloudUp (Recommended)

Run the interactive setup wizard:

```bash
/gutenberg-issue-triage:setup-cloudup
```

Or run the setup script directly:

```bash
./bin/setup-cloudup.sh
```

This will:
1. Show security warning about storing credentials locally
2. Prompt for your CloudUp username (visible)
3. Prompt for your CloudUp password (**hidden input** - not shown on screen)
4. Validate credentials work by testing against CloudUp API
5. Securely store them in `~/.claude/cloudup-credentials.json` (permissions: 600)

**That's it!** No environment variables needed. Your credentials are automatically used for all uploads.

### Alternative: Environment Variables

If you prefer environment variables (not recommended - credentials visible in shell history):

```bash
# Username/Password (primary method)
export CLOUDUP_USER="your-username"
export CLOUDUP_PASS="your-password"

# OR OAuth Token (if you have one)
export CLOUDUP_TOKEN="your-oauth-token"
```

Note: The setup wizard (above) is more secure than environment variables.

### Upload Screenshots

```bash
# Upload single file
/gutenberg-issue-triage:upload-screenshots screenshot.png

# Upload multiple files
/gutenberg-issue-triage:upload-screenshots img1.png img2.png

# Upload all screenshots from an issue
/gutenberg-issue-triage:upload-screenshots .triage/74447/screenshots/*.png

# Copy markdown to clipboard
/gutenberg-issue-triage:upload-screenshots *.png --copy
```

The command returns markdown-formatted image links ready to paste into GitHub:

```markdown
![screenshot1.png](https://cldup.com/abc123xyz/image1.png)
![screenshot2.png](https://cldup.com/abc123xyz/image2.png)
```

### Testing Without CloudUp

Use mock backend for testing without real credentials:

```bash
export IMAGE_UPLOAD_MOCK=true
/gutenberg-issue-triage:upload-screenshots test.png
```

This returns fake URLs without actually uploading anything.

## Updating

```bash
cd /path/to/claude-gutenberg-triage-plugin
git pull
```

## More Information

See [SPEC.md](SPEC.md) for detailed architecture and planned features.

## Author

Dave Smith

## Version

1.0.0 (MVP)
