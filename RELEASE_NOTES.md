# witr-gui v0.3.1-gui

This release is an enhanced build of the original [`pranshuparmar/witr`](https://github.com/pranshuparmar/witr) project.

The original `witr` CLI and TUI are preserved. This version adds a native browser-based GUI for users who want a more visual way to inspect processes, ports, and process causality.

## Added

- Native embedded web GUI.
- `--web` mode to start the local browser interface.
- `--web-open` option to open the default browser automatically.
- `--web-addr` option to choose the listen address.
- Searchable process dashboard.
- Searchable port dashboard.
- Click-through process details.
- Click-through port and port-owner details.
- Process type badges such as `WEB`, `DB`, `SYS`, `SRV`, `CNT`, `SH`, `DEV`, and `APP`.
- Russian and English UI language switcher.
- Saved language preference in the browser.
- Native Windows, macOS, Linux, and FreeBSD support.

## How to Run the GUI

Windows:

```bat
.\witr.exe --web --web-open
```

macOS / Linux:

```bash
./witr --web --web-open
```

Then open:

```text
http://127.0.0.1:7331
```

## Important

Run the binary natively on the machine you want to inspect.

If you run it inside Docker, it will only see processes and ports inside that container, not the host system.

## Original Project

Original repository:

https://github.com/pranshuparmar/witr

Original `witr` provides the process causality engine, CLI, TUI, platform-specific process inspection, source detection, and output renderers. This release adds the embedded web GUI and usability improvements.
