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
- **Menu bar mode.** Enable *Run from the menu bar* (Settings ▸ Menu Bar & Startup). When you minimize, WorkNeat hides its window, drops its Dock icon (`Accessory` activation policy), and stays alive as a menu bar item. The tray menu lets you reopen the window, apply any saved layout, or quit. With this enabled, the window's close button also tucks the app back into the menu bar rather than quitting.
- **Menu bar icon.** The template icon lives at `src-tauri/icons/menubar-icon.png` (`@2x` variant alongside it). It is a monochrome macOS *template* image, so it automatically adapts to light/dark menu bars.
- **Faster repositioning.** The slow `system_profiler` display lookup is cached and only refreshed when the monitor arrangement changes, so applying a layout no longer pays that cost on every trigger.

## Interface

The UI is built with **HeroUI Pro (v3)** on React 19 + Tailwind CSS v4.

- **Native macOS chrome.** Transparent window with a `sidebar` vibrancy material, an overlaid (hidden-title) title bar, and draggable chrome regions (`data-tauri-drag-region`). The sidebar reserves space for the traffic-light buttons.
- **Light / Dark / System theme.** Appearance follows macOS by default and can be pinned to Light or Dark in Settings. The choice is applied before first paint (no flash) and tracks the OS live while set to *System*.
- **Toasts.** Save / apply / mirror confirmations and errors surface as transient toasts instead of a static status line.

## Settings & startup

All preferences live in one place — open with **⌘,** or the **Settings** button at the bottom of the sidebar:

- **General** — Accessibility permission status, open System Settings, re-check.
- **Appearance** — theme (System/Light/Dark) and the app-icon mark.
- **Menu Bar & Startup** — *Run from the menu bar*, **Launch at login**, and a hide/minimize action.
- **Editor** — *Snap to grid*.
- **About** — version, bundle identifier, connected displays.

**Launch at login** is implemented dependency-free by writing a per-user LaunchAgent to `~/Library/LaunchAgents/app.workneat.desktop.plist` (`RunAtLoad`, with a `--autostart` flag). When launched at login while menu-bar mode is on, WorkNeat starts hidden in the menu bar.

> Note: the transparent/vibrancy window uses Tauri's `macOSPrivateApi`, so this build is not Mac App Store eligible.

## Run

Building from source needs a **HeroUI Pro** license token (the UI uses `@heroui-pro/react`). Export your token before installing — the compiled app does **not** need it at runtime:

```sh
export HEROUI_AUTH_TOKEN=your-heroui-cicd-token
npm install
npm run tauri dev
```

## Build

A release build also needs the updater signing key (auto-update artifacts are enabled):

```sh
TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/workneat-updater.key)" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" \
npm run tauri build
```

Build outputs:

- `src-tauri/target/release/bundle/macos/WorkNeat.app`
- `src-tauri/target/release/bundle/dmg/WorkNeat_0.1.0_aarch64.dmg`
- `src-tauri/target/release/bundle/macos/WorkNeat.app.tar.gz` (+ `.sig`, for the updater)

## Releasing (auto-update)

Updates ship via GitHub Releases + the Tauri updater. The `.github/workflows/release.yml` workflow builds, signs, and publishes a **draft** release (DMG, updater artifacts, and `latest.json`) whenever a `v*` tag is pushed.

One-time setup — add these repository **Secrets** (Settings → Secrets and variables → Actions):

- `HEROUI_AUTH_TOKEN` — HeroUI Pro CI/CD token (so CI can install `@heroui-pro/react`).
- `TAURI_SIGNING_PRIVATE_KEY` — contents of `~/.tauri/workneat-updater.key`.
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — the key password (empty here).

Cut a release:

```sh
# bump "version" in src-tauri/tauri.conf.json (and package.json), then:
git tag v0.1.1
git push origin v0.1.1
```

CI creates a **draft** release — review and **Publish** it. Installed apps check
`https://github.com/ArB1t3r/WorkNeat/releases/latest/download/latest.json`.

> The repo must be **public** for the updater's `releases/latest/download` URL to resolve. The source contains no secrets; cloning to build still requires your own HeroUI Pro token. Adhoc-signed builds trigger Gatekeeper on first download (right-click → Open) until Apple notarization is configured.

## Permissions

WorkNeat requires Accessibility access to inspect and move other apps' windows. It also uses Apple Events through System Events for the current MVP window automation path.
