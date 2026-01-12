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
