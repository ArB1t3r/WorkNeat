<h1 align="center">WorkNeat</h1>

<p align="center">
  <b>A native macOS window layout manager for multi-display workflows.</b><br/>
  Save where every app's windows belong on each monitor, then restore your whole workspace in one keystroke.
</p>

<p align="center">
  <b>原生 macOS 多屏窗口布局管理器</b> —— 保存每个 App 的窗口在各显示器上的位置，一个快捷键瞬间还原整个工作区。
</p>

<p align="center">
  <img alt="platform: macOS 14+" src="https://img.shields.io/badge/platform-macOS%2014%2B-black?logo=apple" />
  <img alt="built with Tauri" src="https://img.shields.io/badge/built%20with-Tauri%202-24C8DB?logo=tauri&logoColor=white" />
  <img alt="React 19" src="https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white" />
  <img alt="Rust" src="https://img.shields.io/badge/Rust-backend-DEA584?logo=rust&logoColor=white" />
</p>

<p align="center"><a href="#english">English</a> · <a href="#中文">简体中文</a></p>

---

<a id="english"></a>

## What is WorkNeat?

**WorkNeat** is a fast, native **macOS window manager** that saves and restores **multi‑monitor window layouts**. Create a layout ("profile") that remembers which display each app window lives on and how it's sized, then snap everything back into place with a **global hotkey** — even while the app is hidden in the menu bar.

It's an open, lightweight take on the idea behind tools like **Moom, Stay, and Workspaces**: instead of dragging windows around every time you dock/undock or switch tasks, you define the arrangement once and recall it instantly.

> Keywords: macOS window manager · window layout manager · save & restore window positions · multi‑monitor / multi‑display window arrangement · global hotkeys · menu bar app · Tauri · Moom / Stay alternative.

## Features

- 🖥️ **Multi‑display layouts** — visually arrange app windows across every connected monitor on a scaled canvas.
- ⌨️ **Native global hotkeys** — each layout gets a shortcut, registered and applied entirely in the Rust backend for low‑latency, IPC‑free triggering (works even when hidden).
- 🪄 **Capture & mirror** — snapshot your current window positions into a layout, or mirror an app's live windows.
- 🧲 **Snap‑to‑grid editor** — drag/resize windows on a configurable grid (2–48 columns × rows).
- 🍫 **Menu bar mode** — run from the menu bar with no Dock icon; the close button tucks the app away instead of quitting.
- 🚀 **Launch at login** — start automatically (and optionally straight into the menu bar).
- 🌗 **Light / Dark / System theme** with native macOS **vibrancy** and an overlaid title bar.
- ☁️ **iCloud Drive sync** + **JSON import/export** to roam or back up your layouts.
- ♻️ **Built‑in auto‑update** (signed) via GitHub Releases.
- 🔔 **Clear feedback** — toasts for actions, and a notice when a window can't be moved (e.g. it's on another Space).

## Screenshots

<!-- Add fresh screenshots to docs/screenshots/ and reference them here, e.g.: -->
<!-- <p align="center"><img src="docs/screenshots/editor.png" width="900" alt="WorkNeat layout editor" /></p> -->

_Coming soon._

## Install

1. Download `WorkNeat_x.y.z_aarch64.dmg` from the [**Releases**](https://github.com/ArB1t3r/WorkNeat/releases) page.
2. Open the DMG and drag **WorkNeat** to **Applications**.
3. Builds aren't notarized yet, so on first launch use **right‑click → Open** (or `xattr -dr com.apple.quarantine /Applications/WorkNeat.app`).
4. Grant **Accessibility** access when prompted (required to move other apps' windows).

Requires **macOS 14+** on Apple Silicon.

## How it works

1. **Create a layout** in the sidebar and give it a name + hotkey.
2. **Add apps** from the running‑apps list, or hit **Mirror** to capture their current windows.
3. **Arrange** each window on the canvas (drag, resize, pick a display, set stacking).
4. **Save**, then press the layout's **hotkey** anytime to apply it — windows are positioned by screen‑relative frames, so it adapts when your display arrangement changes.

## Settings

Open with **⌘,** or the **Settings** button at the bottom of the sidebar:

- **General** — Accessibility status, check for updates.
- **Appearance** — theme (System / Light / Dark) and app‑icon mark.
- **Menu Bar & Startup** — run from the menu bar, launch at login.
- **Editor** — snap to grid, grid divisions, move‑failure warnings.
- **Sync & Backup** — iCloud Drive sync, import/export layouts (JSON).
- **About** — version, identifier, connected displays.

## Build from source

WorkNeat's UI uses **HeroUI Pro** (`@heroui-pro/react`), a licensed package, so building from source needs your HeroUI Pro token. The compiled app does **not** need it at runtime.

```sh
export HEROUI_AUTH_TOKEN=your-heroui-cicd-token
npm install
npm run tauri dev
```

A release build also needs the updater signing key (auto‑update artifacts are enabled):

```sh
TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/workneat-updater.key)" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" \
npm run tauri build
```

Outputs: `src-tauri/target/release/bundle/` → `dmg/WorkNeat_*.dmg`, `macos/WorkNeat.app`, and `macos/WorkNeat.app.tar.gz` (+ `.sig`) for the updater.

## Releasing (auto‑update)

Updates ship via **GitHub Releases** + the Tauri updater. `.github/workflows/release.yml` builds, signs and publishes a **draft** release (DMG, updater artifacts, `latest.json`) on every `v*` tag.

One‑time repo **Secrets** (Settings → Secrets and variables → Actions): `HEROUI_AUTH_TOKEN`, `TAURI_SIGNING_PRIVATE_KEY` (contents of `~/.tauri/workneat-updater.key`), `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

```sh
# bump "version" in src-tauri/tauri.conf.json (and package.json), then:
git tag v0.1.1 && git push origin v0.1.1   # CI builds → review the draft → Publish
```

> The repo must be **public** for the updater's `releases/latest/download` URL to resolve. Source contains no secrets; cloning to build still requires your own HeroUI Pro token.

## Tech stack

[Tauri 2](https://tauri.app) (Rust backend) · [React 19](https://react.dev) · [HeroUI Pro v3](https://heroui.pro) · [Tailwind CSS v4](https://tailwindcss.com) · Vite. Window placement uses the macOS Accessibility (AX) API with an AppleScript/System Events fallback.

## Permissions & privacy

WorkNeat needs **Accessibility** access to inspect and move other apps' windows, and uses Apple Events (System Events) as a fallback. Everything stays **on your Mac** — no accounts, no telemetry. Optional iCloud sync stores layouts in your own iCloud Drive.

## License

© 2026 WorkNeat. All rights reserved. _(Open an issue if you'd like a different license.)_

---

<a id="中文"></a>

## WorkNeat 是什么？

**WorkNeat** 是一款快速、原生的 **macOS 窗口管理器**，用于保存与还原**多显示器窗口布局**。你可以创建一个布局（"档案"），记住每个 App 窗口该放在哪台显示器、多大尺寸，然后用**全局快捷键**一键归位——即使应用正隐藏在菜单栏也能触发。

它是 **Moom、Stay、Workspaces** 这类工具思路的一个轻量开放实现：不必每次插拔显示器或切换任务时重新拖窗口，布局定义一次，随时秒级唤回。

> 关键词：macOS 窗口管理 · 窗口布局管理器 · 保存/还原窗口位置 · 多显示器窗口排布 · 全局快捷键 · 菜单栏应用 · Tauri · Moom / Stay 替代品。

## 功能

- 🖥️ **多屏布局** —— 在缩放画布上跨所有显示器可视化排布窗口。
- ⌨️ **原生全局快捷键** —— 每个布局一个快捷键，注册与应用全在 Rust 后端完成，低延迟、无 IPC 往返（隐藏时也能触发）。
- 🪄 **捕获与镜像** —— 一键把当前窗口位置存入布局，或镜像某 App 的实时窗口。
- 🧲 **网格吸附编辑器** —— 在可配置网格（2–48 列 × 行）上拖拽/缩放。
- 🍫 **菜单栏模式** —— 从菜单栏运行、无 Dock 图标；关闭按钮收回应用而非退出。
- 🚀 **开机启动** —— 登录自动启动（可直接进菜单栏）。
- 🌗 **浅色 / 深色 / 跟随系统** 主题，原生 **毛玻璃 vibrancy** + 透明标题栏。
- ☁️ **iCloud Drive 同步** + **JSON 导入/导出**，跨机漫游或备份布局。
- ♻️ **内置自动更新**（已签名），通过 GitHub Releases 分发。
- 🔔 **清晰反馈** —— 操作有 toast 提示；窗口无法移动时（如在其它 Space）会明确告知。

## 安装

1. 从 [**Releases**](https://github.com/ArB1t3r/WorkNeat/releases) 下载 `WorkNeat_x.y.z_aarch64.dmg`。
2. 打开 DMG，把 **WorkNeat** 拖进「应用程序」。
3. 当前未做 Apple 公证，首次打开请 **右键 → 打开**（或 `xattr -dr com.apple.quarantine /Applications/WorkNeat.app`）。
4. 按提示授予 **辅助功能** 权限（移动其它 App 窗口所必需）。

需 **macOS 14+**（Apple Silicon）。

## 使用方式

1. 在侧栏 **新建布局**，起名并设快捷键。
2. 从运行中的 App 列表 **添加 App**，或点 **Mirror** 捕获其当前窗口。
3. 在画布上 **排布** 每个窗口（拖动、缩放、选显示器、设层叠）。
4. **保存**，之后随时按布局的 **快捷键** 应用——窗口按屏幕相对位置还原，显示器组合变化时也能自适应。

## 设置

用 **⌘,** 或侧栏底部的 **Settings** 打开：常规 / 外观 / 菜单栏与启动 / 编辑器（含网格分割）/ 同步与备份（iCloud + 导入导出）/ 关于。

## 从源码构建

UI 使用 **HeroUI Pro**（`@heroui-pro/react`，付费包），构建需要你的 HeroUI Pro token；编译后的 app **运行时不需要** 它。

```sh
export HEROUI_AUTH_TOKEN=你的-heroui-cicd-token
npm install
npm run tauri dev
```

发布构建还需更新签名私钥（已开启自动更新工件）：

```sh
TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/workneat-updater.key)" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" \
npm run tauri build
```

## 发布与自动更新

通过 **GitHub Releases** + Tauri updater 分发更新。推送 `v*` tag 即由 `.github/workflows/release.yml` 自动构建、签名并发布**草稿** Release（DMG、更新工件、`latest.json`）。需先在仓库 Secrets 配置 `HEROUI_AUTH_TOKEN`、`TAURI_SIGNING_PRIVATE_KEY`、`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`，然后 `git tag v0.1.1 && git push origin v0.1.1`，CI 完成后到 Releases 点 Publish。

## 技术栈

Tauri 2（Rust 后端）· React 19 · HeroUI Pro v3 · Tailwind CSS v4 · Vite。窗口定位走 macOS 辅助功能 (AX) API，并以 AppleScript / System Events 兜底。

## 权限与隐私

需要 **辅助功能** 权限来检查/移动其它 App 窗口，并用 Apple Events 兜底。所有数据 **只在本机**，无账号、无遥测；iCloud 同步仅存到你自己的 iCloud Drive。
