# witr-gui

`witr-gui` is an enhanced version of `witr` with a native browser-based graphical interface.

The original project is [`pranshuparmar/witr`](https://github.com/pranshuparmar/witr), a cross-platform command-line and TUI tool that answers a simple but useful question:

> Why is this running?

This repository keeps the original CLI and TUI behavior, then adds a local web UI so users can inspect processes and ports from a more user-friendly interface.

## What Was Added

This fork adds:

- Embedded browser GUI served by the native `witr` binary.
- Process dashboard with searchable process list.
- Port dashboard with searchable network bindings.
- Click-through details for every process.
- Click-through details for every port and its owning process.
- Process type badges for easier scanning, such as `WEB`, `DB`, `SYS`, `SRV`, `CNT`, `SH`, `DEV`, and `APP`.
- Russian and English UI language switcher.
- Saved language preference in the browser.
- `--web` command-line mode.
- `--web-open` option to open the browser automatically.
- `--web-addr` option for choosing the listen address.
- Native Windows, macOS, Linux, and FreeBSD support through the existing Go build pipeline.

The web interface is embedded into the executable with Go `embed`, so there is no separate Node.js server, frontend build step, or Docker image required for users.

## Why Not Docker?

The GUI is meant to run natively on the machine you want to inspect.

If you run `witr-gui` inside Docker, it will only see processes and ports inside that container. That is useful for development, but not for inspecting the host system.

For real use on Windows or macOS, run the native binary directly.

## Quick Start

From the project directory on Windows:

```bat
.\witr.exe --web --web-open
```

Or start the local web server without opening the browser:

```bat
.\witr.exe --web
```

Then open:

```text
http://127.0.0.1:7331
```

On macOS or Linux:

```bash
./witr --web --web-open
```

## Remote or Server Use

By default the GUI listens only on localhost:

```bash
witr --web
```

For a remote Ubuntu server, bind to all interfaces:

```bash
witr --web --web-addr 0.0.0.0:7331
```

Only do this on a trusted network or behind your own access control. The GUI exposes process and environment information from the machine where it runs.

## CLI and TUI Are Still Available

The original command-line usage still works:

```bash
witr nginx
witr --pid 1234
witr --port 5432
witr --file /var/lib/dpkg/lock
witr --json
witr --interactive
```

Running without arguments still starts the original interactive terminal UI:

```bash
witr
```

## Building

Build the native binary:

```bash
go build -o witr ./cmd/witr
```

Build Windows from any Go environment:

```bash
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -o witr.exe ./cmd/witr
```

Build macOS:

```bash
GOOS=darwin GOARCH=amd64 CGO_ENABLED=0 go build -o witr-darwin-amd64 ./cmd/witr
GOOS=darwin GOARCH=arm64 CGO_ENABLED=0 go build -o witr-darwin-arm64 ./cmd/witr
```

Build Linux:

```bash
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o witr-linux-amd64 ./cmd/witr
```

## Release Builds

The repository includes GoReleaser configuration inherited from the original project. It can produce release artifacts for:

- Windows
- macOS
- Linux
- FreeBSD

The generated binaries include the web GUI assets automatically.

## Project Structure

Important additions in this fork:

```text
internal/web/server.go           Embedded HTTP server and JSON API
internal/web/actions_*.go        Process actions for supported platforms
internal/web/open_*.go           Open browser helpers per OS
internal/web/static/index.html   Web UI markup
internal/web/static/styles.css   Web UI styling
internal/web/static/app.js       Web UI behavior, language switcher, dashboards
```

Original core logic is still used from:

```text
internal/pipeline
internal/proc
internal/source
internal/target
internal/output
pkg/model
```

## Original Project Credit

This project is based on:

[`pranshuparmar/witr`](https://github.com/pranshuparmar/witr)

Original `witr` provides the process causality engine, CLI, TUI, platform-specific process inspection, source detection, and output renderers. This repository extends it with a native web GUI and usability improvements.

## License

This repository follows the original project's license. See [LICENSE](LICENSE).
