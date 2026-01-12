# Playground Runner Skill

Manage WordPress Playground instances for bug reproduction.

## Purpose

Start, monitor, and stop WordPress Playground instances using generated blueprints.

## Prerequisites

- Node.js and npx available
- `@wp-playground/cli` (installed on-demand via npx)

## Input

This skill receives:
1. **Issue number** - Used for naming blueprint and log files
2. **Blueprint JSON** - From the blueprint-builder skill

## Process

### 1. Save the blueprint

Save the generated blueprint to `.triage/<issue>.blueprint.json`:

```bash
# Example: .triage/74447.blueprint.json
```

This persists the blueprint for debugging and manual re-runs.

### 2. Start Playground

Use the lifecycle script:

```bash
./bin/playground.sh start --blueprint=.triage/<issue>.blueprint.json
```

The script will:
- Start Playground in the background
- Save PID to `.triage/playground.pid`
- Wait for the server to be ready (polls http://127.0.0.1:9400)
- Output the URL when ready

### 3. Verify Playground is running

```bash
./bin/playground.sh status
```

Returns:
- PID of the running process
- URL (default: http://127.0.0.1:9400)
- Log file location

### 4. Get the URL for Playwright

```bash
./bin/playground.sh url
```

Returns just the URL, suitable for passing to Playwright.

### 5. Stop Playground (after reproduction)

```bash
./bin/playground.sh stop
```

Sends SIGTERM for graceful shutdown, falls back to SIGKILL after 5 seconds.

## Script Reference

```
./bin/playground.sh {start|stop|status|url|logs}

Commands:
  start [--blueprint=path] [--port=9400]  Start Playground
  stop                                     Stop Playground
  status                                   Check if running
  url                                      Print the Playground URL
  logs                                     Tail the log file
```

## Files Created

| File | Purpose |
|------|---------|
| `.triage/<issue>.blueprint.json` | Saved blueprint for this issue |
| `.triage/playground.pid` | PID of running Playground process |
| `.triage/playground.url` | URL of running Playground |
| `.triage/playground.log` | Stdout/stderr from Playground |

## Output

After starting, provide:

```
PLAYGROUND STARTED:
  URL: http://127.0.0.1:9400
  PID: <pid>
  Blueprint: .triage/<issue>.blueprint.json
  Logs: .triage/playground.log

READY FOR: repro-runner skill (Playwright automation)
```

## Error Handling

### Port already in use

If port 9400 is busy:
1. Check if it's a previous Playground instance: `./bin/playground.sh status`
2. If yes, stop it: `./bin/playground.sh stop`
3. If no, use a different port: `./bin/playground.sh start --port=9401`

### Startup timeout

If Playground doesn't respond within 30 seconds:
1. Check logs: `./bin/playground.sh logs`
2. Stop the hung process: `./bin/playground.sh stop`
3. Report the error to the user

### Blueprint errors

If the blueprint is invalid:
1. Playground will fail to start
2. Check `.triage/playground.log` for error details
3. Report the specific error to the user

## Integration with Triage Command

The triage command orchestrates this skill:

1. **blueprint-builder** generates JSON
2. **playground-runner** saves blueprint and starts Playground
3. **repro-runner** (future) connects via Playwright
4. **playground-runner** stops Playground when done

## Manual Testing

To test a blueprint manually:

```bash
# Save your blueprint
cat > .triage/test.blueprint.json << 'EOF'
{
  "$schema": "https://playground.wordpress.net/blueprint-schema.json",
  "landingPage": "/wp-admin/",
  "preferredVersions": { "php": "8.2", "wp": "latest" },
  "steps": [
    { "step": "login", "username": "admin", "password": "password" }
  ]
}
EOF

# Start
./bin/playground.sh start --blueprint=.triage/test.blueprint.json

# Open in browser
open "$(./bin/playground.sh url)"

# When done
./bin/playground.sh stop
```
