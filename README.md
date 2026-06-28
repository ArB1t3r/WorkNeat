# WorkNeat

WorkNeat is a macOS window layout manager for multi-display workflows.

## Current MVP

- Native macOS app bundle built with Tauri.
- Visual multi-display layout editor.
- Accessibility permission gate before capture or restore.
- Capture visible windows into a new layout.
- Add running apps to a layout.
- Save current window positions back into the selected layout.
- Restore app windows by saved screen-relative frames.
- Optional auto-launch per app.
- Global shortcut registration for saved layouts.

## Menu bar & global shortcuts

- **Native global shortcuts.** Layout hotkeys are registered and handled entirely in the Rust backend. When a hotkey fires, the matching layout is applied directly on the backend instead of bouncing through the webview, which removes the IPC round-trip latency (and works even while the window is hidden or the webview is throttled).
- **Menu bar mode.** Enable *Run from the menu bar* (Settings tab). When you minimize, WorkNeat hides its window, drops its Dock icon (`Accessory` activation policy), and stays alive as a menu bar item. The tray menu lets you reopen the window, apply any saved layout, or quit. With this enabled, the window's close button also tucks the app back into the menu bar rather than quitting.
- **Menu bar icon.** The template icon lives at `src-tauri/icons/menubar-icon.png` (`@2x` variant alongside it). It is a monochrome macOS *template* image, so it automatically adapts to light/dark menu bars.
- **Faster repositioning.** The slow `system_profiler` display lookup is cached and only refreshed when the monitor arrangement changes, so applying a layout no longer pays that cost on every trigger.

## Run

```sh
npm install
npm run tauri dev
```

## Build

```sh
npm run tauri build
```

Build outputs:

- `src-tauri/target/release/bundle/macos/WorkNeat.app`
- `src-tauri/target/release/bundle/dmg/WorkNeat_0.1.0_aarch64.dmg`

## Permissions

WorkNeat requires Accessibility access to inspect and move other apps' windows. It also uses Apple Events through System Events for the current MVP window automation path.
