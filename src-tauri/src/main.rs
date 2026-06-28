use core_foundation::array::{CFArray, CFArrayRef};
use core_foundation::base::{CFRelease, CFTypeRef, TCFType};
use core_foundation::boolean::CFBoolean;
use core_foundation::dictionary::{CFDictionary, CFDictionaryRef};
use core_foundation::number::CFNumber;
use core_foundation::string::{CFString, CFStringRef};
use core_graphics::geometry::{CGPoint, CGRect, CGSize};
use core_graphics::window::{
    copy_window_info, kCGNullWindowID, kCGWindowBounds, kCGWindowLayer,
    kCGWindowListExcludeDesktopElements, kCGWindowListOptionOnScreenOnly, kCGWindowName,
    kCGWindowOwnerName, kCGWindowOwnerPID,
};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::env;
use std::ffi::c_void;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::ptr;
use std::str::FromStr;
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::image::Image;
use tauri::menu::{Menu, MenuBuilder, MenuItem};
use tauri::tray::{TrayIcon, TrayIconBuilder};
use tauri::{ActivationPolicy, AppHandle, Manager, Wry, WindowEvent};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

/// Shared runtime state used by the global-shortcut handler and the menu bar tray.
///
/// Keeping the profile list and shortcut map in Rust lets a hotkey apply a layout
/// directly on the backend — without a webview IPC round-trip — which removes the
/// latency that was previously incurred by routing every trigger through JavaScript.
#[derive(Default)]
struct AppState {
    profiles: Mutex<Vec<WorkspaceProfile>>,
    shortcuts: Mutex<Vec<(Shortcut, String)>>,
    hide_dock: Mutex<bool>,
    tray: Mutex<Option<TrayIcon>>,
    /// Cache of the slow `system_profiler` lookup, keyed by a fast monitor
    /// geometry signature. Re-running `system_profiler` on every layout apply
    /// could add up to a second of latency; we only refresh it when the
    /// physical display arrangement actually changes.
    display_profiles_cache: Mutex<Option<(String, Vec<SystemDisplayProfile>)>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeSnapshot {
    displays: Vec<DisplayDescriptor>,
    display_set_signature: String,
    accessibility: PermissionStatus,
    app_identity: AppIdentity,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppIdentity {
    bundle_identifier: String,
    bundle_path: String,
    executable_path: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppConfig {
    #[serde(default = "default_config_version")]
    version: u32,
    #[serde(default)]
    profiles: Vec<WorkspaceProfile>,
    #[serde(default = "default_app_icon_id")]
    app_icon_id: String,
    #[serde(default)]
    hide_dock_when_minimized: bool,
    #[serde(default = "default_snap_to_grid")]
    snap_to_grid: bool,
}

fn default_config_version() -> u32 {
    1
}

fn default_app_icon_id() -> String {
    "display".to_string()
}

fn default_snap_to_grid() -> bool {
    true
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DisplayDescriptor {
    identity: DisplayIdentity,
    frame: DisplayFrame,
    native_frame: DisplayFrame,
    scale_factor: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DisplayIdentity {
    id: String,
    name: String,
    vendor_id: Option<u32>,
    product_id: Option<u32>,
    serial_number: Option<u32>,
    is_built_in: bool,
}

#[derive(Debug, Serialize)]
struct DisplayFrame {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "lowercase")]
enum PermissionStatus {
    Granted,
    Missing,
}

#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    fn AXIsProcessTrusted() -> bool;
    fn AXIsProcessTrustedWithOptions(options: CFDictionaryRef) -> bool;
    static kAXTrustedCheckOptionPrompt: CFStringRef;
    fn CGRectMakeWithDictionaryRepresentation(dict: CFDictionaryRef, rect: *mut CGRect) -> bool;
    fn AXUIElementCreateApplication(pid: i32) -> AXUIElementRef;
    fn AXUIElementCopyAttributeValue(
        element: AXUIElementRef,
        attribute: CFStringRef,
        value: *mut CFTypeRef,
    ) -> i32;
    fn AXUIElementSetAttributeValue(
        element: AXUIElementRef,
        attribute: CFStringRef,
        value: CFTypeRef,
    ) -> i32;
    fn AXUIElementPerformAction(element: AXUIElementRef, action: CFStringRef) -> i32;
    fn AXValueCreate(value_type: i32, value: *const c_void) -> CFTypeRef;
}

type AXUIElementRef = *const c_void;
const AX_ERROR_SUCCESS: i32 = 0;
const AX_VALUE_CGPOINT_TYPE: i32 = 1;
const AX_VALUE_CGSIZE_TYPE: i32 = 2;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceProfile {
    id: String,
    name: String,
    hotkey: String,
    hotkey_binding: String,
    display_set_signature: String,
    app_rules: Vec<AppRule>,
    updated_at: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppRule {
    id: String,
    app_name: String,
    bundle_identifier: String,
    launch_behavior: String,
    window_order_policy: String,
    stack_policy: StackPolicy,
    placements: Vec<WindowPlacement>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct StackPolicy {
    mode: String,
    offset_percent: f64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct WindowPlacement {
    id: String,
    app_rule_id: String,
    display_id: String,
    order_index: usize,
    title: String,
    relative_frame: RelativeFrame,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct RelativeFrame {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppSource {
    id: String,
    app_name: String,
    bundle_identifier: String,
    window_count: usize,
    windows: Vec<WindowSource>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WindowSource {
    id: String,
    title: String,
    display_id: String,
    order_index: usize,
    relative_frame: RelativeFrame,
}

fn accessibility_status() -> PermissionStatus {
    let trusted = unsafe { AXIsProcessTrusted() };

    if trusted {
        PermissionStatus::Granted
    } else {
        PermissionStatus::Missing
    }
}

#[tauri::command]
fn get_runtime_snapshot(app: AppHandle) -> RuntimeSnapshot {
    let displays = get_displays(&app);
    let display_set_signature = display_set_signature(&displays);

    RuntimeSnapshot {
        displays,
        display_set_signature,
        accessibility: accessibility_status(),
        app_identity: current_app_identity(),
    }
}

#[tauri::command]
fn request_accessibility_permission() -> PermissionStatus {
    request_current_process_accessibility_prompt();
    open_accessibility_settings();
    accessibility_status()
}

#[tauri::command]
fn reveal_current_app_in_finder() {
    let identity = current_app_identity();
    let path = if identity.bundle_path.is_empty() {
        identity.executable_path
    } else {
        identity.bundle_path
    };

    if !path.is_empty() {
        let _ = Command::new("open").arg("-R").arg(path).status();
    }
}

#[tauri::command]
fn load_app_config(app: AppHandle) -> Result<Option<AppConfig>, String> {
    let path = app_config_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }

    let raw = fs::read_to_string(&path)
        .map_err(|error| format!("Failed to read config file: {error}"))?;
    let config = serde_json::from_str::<AppConfig>(&raw)
        .map_err(|error| format!("Failed to parse config file: {error}"))?;

    Ok(Some(config))
}

#[tauri::command]
fn save_app_config(app: AppHandle, config: AppConfig) -> Result<(), String> {
    let path = app_config_path(&app)?;
    let Some(parent) = path.parent() else {
        return Err("Unable to resolve config directory.".to_string());
    };

    let hide_dock = config.hide_dock_when_minimized;

    fs::create_dir_all(parent)
        .map_err(|error| format!("Failed to create config directory: {error}"))?;
    let raw = serde_json::to_string_pretty(&config)
        .map_err(|error| format!("Failed to serialize config file: {error}"))?;
    fs::write(&path, raw).map_err(|error| format!("Failed to write config file: {error}"))?;

    *app.state::<AppState>().hide_dock.lock().unwrap() = hide_dock;

    Ok(())
}

#[tauri::command]
fn minimize_main_window(app: AppHandle, hide_dock: bool) -> Result<(), String> {
    let Some(window) = app.get_webview_window("main") else {
        return Err("Main window is unavailable.".to_string());
    };

    *app.state::<AppState>().hide_dock.lock().unwrap() = hide_dock;

    // When the Dock icon should disappear, become a true menu-bar accessory:
    // hide the window entirely (a minimized window has no Dock slot to live in
    // once the Dock icon is gone) and switch the activation policy. The tray
    // icon remains the way back into the app.
    if hide_dock {
        window
            .hide()
            .map_err(|error| format!("Failed to hide window: {error}"))?;
        app.set_activation_policy(ActivationPolicy::Accessory)
            .map_err(|error| format!("Failed to hide Dock icon: {error}"))?;
        return Ok(());
    }

    window
        .set_minimizable(true)
        .map_err(|error| format!("Failed to enable minimize: {error}"))?;
    window
        .minimize()
        .map_err(|error| format!("Failed to minimize window: {error}"))?;

    Ok(())
}

fn app_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_config_dir()
        .map_err(|error| format!("Failed to resolve config directory: {error}"))?;

    Ok(directory.join("workneat-config.json"))
}

#[tauri::command]
fn open_accessibility_settings() {
    let _ = Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
        .status();
}

fn request_current_process_accessibility_prompt() -> bool {
    unsafe {
        let prompt_key = CFString::wrap_under_get_rule(kAXTrustedCheckOptionPrompt);
        let prompt_value = CFBoolean::true_value();
        let options = CFDictionary::from_CFType_pairs(&[(prompt_key, prompt_value)]);
        AXIsProcessTrustedWithOptions(options.as_concrete_TypeRef())
    }
}

fn current_app_identity() -> AppIdentity {
    let executable_path = env::current_exe()
        .ok()
        .map(path_to_string)
        .unwrap_or_default();
    let bundle_path = env::current_exe()
        .ok()
        .and_then(find_app_bundle)
        .map(path_to_string)
        .unwrap_or_default();

    AppIdentity {
        bundle_identifier: "app.workneat.desktop".to_string(),
        bundle_path,
        executable_path,
    }
}

fn find_app_bundle(path: PathBuf) -> Option<PathBuf> {
    for ancestor in path.ancestors() {
        if ancestor
            .extension()
            .is_some_and(|extension| extension == "app")
        {
            return Some(ancestor.to_path_buf());
        }
    }

    None
}

fn path_to_string(path: PathBuf) -> String {
    path.to_string_lossy().to_string()
}

#[tauri::command]
fn capture_current_layout(app: AppHandle) -> Result<Option<WorkspaceProfile>, String> {
    if !matches!(accessibility_status(), PermissionStatus::Granted) {
        return Err("Accessibility permission is required to capture windows.".to_string());
    }

    let displays = get_displays(&app);
    if displays.is_empty() {
        return Ok(None);
    }

    let windows = capture_visible_windows()?;
    if windows.is_empty() {
        return Ok(None);
    }

    let mut apps: Vec<CapturedApp> = Vec::new();

    for window in windows {
        let display = display_for_window(&displays, &window);
        let relative_frame = relative_frame_for_window(display, &window);
        let key = if window.bundle_identifier.is_empty() {
            window.app_name.clone()
        } else {
            window.bundle_identifier.clone()
        };

        push_captured_window(
            &mut apps,
            key,
            window.app_name,
            CapturedWindowPlacement {
                title: window.title,
                display_id: display.identity.id.clone(),
                relative_frame,
            },
        );
    }

    let app_rules = apps
        .into_iter()
        .enumerate()
        .map(|(app_index, app)| {
            let rule_id = stable_id("app", &app.bundle_identifier, app_index);
            let placements = app
                .windows
                .into_iter()
                .enumerate()
                .map(|(window_index, window)| WindowPlacement {
                    id: stable_id(
                        "window",
                        &format!("{}-{}", rule_id, window_index),
                        window_index,
                    ),
                    app_rule_id: rule_id.clone(),
                    display_id: window.display_id,
                    order_index: window_index,
                    title: if window.title.is_empty() {
                        format!("{} Window {}", app.app_name, window_index + 1)
                    } else {
                        window.title
                    },
                    relative_frame: window.relative_frame,
                })
                .collect();

            AppRule {
                id: rule_id,
                app_name: app.app_name,
                bundle_identifier: app.bundle_identifier,
                launch_behavior: "skip".to_string(),
                window_order_policy: "front-to-back".to_string(),
                stack_policy: StackPolicy {
                    mode: "none".to_string(),
                    offset_percent: 0.0,
                },
                placements,
            }
        })
        .collect::<Vec<_>>();

    Ok(Some(WorkspaceProfile {
        id: format!("captured-{}", now_seconds()),
        name: "Captured Layout".to_string(),
        hotkey: "⌥⌘1".to_string(),
        hotkey_binding: "Alt+Command+Digit1".to_string(),
        display_set_signature: display_set_signature(&displays),
        app_rules,
        updated_at: now_seconds().to_string(),
    }))
}

#[tauri::command]
fn list_window_sources(app: AppHandle) -> Result<Vec<AppSource>, String> {
    if !matches!(accessibility_status(), PermissionStatus::Granted) {
        return Err("Accessibility permission is required to list windows.".to_string());
    }

    let displays = get_displays(&app);
    if displays.is_empty() {
        return Ok(Vec::new());
    }

    let windows = capture_visible_windows()?;
    let mut apps: Vec<CapturedApp> = Vec::new();

    for window in windows {
        let display = display_for_window(&displays, &window);
        let key = if window.bundle_identifier.is_empty() {
            window.app_name.clone()
        } else {
            window.bundle_identifier.clone()
        };
        let relative_frame = relative_frame_for_window(display, &window);

        push_captured_window(
            &mut apps,
            key,
            window.app_name,
            CapturedWindowPlacement {
                title: window.title,
                display_id: display.identity.id.clone(),
                relative_frame,
            },
        );
    }

    Ok(apps
        .into_iter()
        .map(|app| AppSource {
            id: app.bundle_identifier.clone(),
            app_name: app.app_name,
            bundle_identifier: app.bundle_identifier,
            window_count: app.windows.len(),
            windows: app
                .windows
                .into_iter()
                .enumerate()
                .map(|(index, window)| WindowSource {
                    id: stable_id("source-window", &window.title, index),
                    title: window.title,
                    display_id: window.display_id,
                    order_index: index,
                    relative_frame: window.relative_frame,
                })
                .collect(),
        })
        .collect())
}

#[tauri::command]
fn apply_workspace_profile(app: AppHandle, profile: WorkspaceProfile) -> Result<String, String> {
    apply_profile_internal(&app, &profile)
}

/// Core layout-application routine shared by the IPC command, the global-shortcut
/// handler, and the tray menu. It prefers the direct Accessibility (AX) path and
/// only falls back to the slower AppleScript path when no window could be moved.
fn apply_profile_internal(app: &AppHandle, profile: &WorkspaceProfile) -> Result<String, String> {
    if !matches!(accessibility_status(), PermissionStatus::Granted) {
        return Err("Accessibility permission is required to apply layouts.".to_string());
    }

    let displays = get_displays(app);
    if displays.is_empty() {
        return Err("No displays are available.".to_string());
    }

    let launched_apps = launch_requested_apps(profile)?;
    if launched_apps {
        thread::sleep(Duration::from_millis(250));
    }

    let moved_windows = apply_profile_with_accessibility(profile, &displays)?;
    if moved_windows == 0 {
        let script = build_apply_script(profile, &displays)?;
        run_applescript(&script)?;
    }

    Ok(format!("Applied layout {}", profile.name))
}

/// Registers every profile hotkey directly on the backend and records the
/// shortcut -> profile mapping. The returned list contains the display labels of
/// any bindings that could not be registered (e.g. already claimed by the OS or
/// another app) so the UI can surface them.
#[tauri::command]
fn register_profile_shortcuts(
    app: AppHandle,
    profiles: Vec<WorkspaceProfile>,
) -> Result<Vec<String>, String> {
    let global = app.global_shortcut();
    let _ = global.unregister_all();

    let mut mapping: Vec<(Shortcut, String)> = Vec::new();
    let mut failed: Vec<String> = Vec::new();

    for profile in &profiles {
        if profile.hotkey_binding.trim().is_empty() {
            continue;
        }

        let Ok(shortcut) = Shortcut::from_str(&profile.hotkey_binding) else {
            failed.push(profile.hotkey.clone());
            continue;
        };

        if mapping.iter().any(|(existing, _)| existing == &shortcut) {
            continue;
        }

        match global.register(shortcut) {
            Ok(()) => mapping.push((shortcut, profile.id.clone())),
            Err(_) => failed.push(profile.hotkey.clone()),
        }
    }

    {
        let state = app.state::<AppState>();
        *state.shortcuts.lock().unwrap() = mapping;
        *state.profiles.lock().unwrap() = profiles;
    }

    refresh_tray_menu(&app);

    Ok(failed)
}

/// Looks up a profile by id and applies it on a background thread so neither the
/// shortcut handler nor the menu event loop is blocked by AX/AppleScript work.
fn apply_profile_by_id(app: &AppHandle, profile_id: &str) {
    let profile = {
        let state = app.state::<AppState>();
        let profiles = state.profiles.lock().unwrap();
        profiles
            .iter()
            .find(|profile| profile.id == profile_id)
            .cloned()
    };

    let Some(profile) = profile else {
        return;
    };

    let app = app.clone();
    thread::spawn(move || {
        let _ = apply_profile_internal(&app, &profile);
    });
}

/// Brings the main window back to the foreground and restores the regular
/// (Dock-visible) activation policy.
fn show_main_window(app: &AppHandle) {
    let _ = app.set_activation_policy(ActivationPolicy::Regular);

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Reads the persisted "hide Dock when minimized" preference from disk so the
/// backend knows how to behave before the frontend has finished booting.
fn stored_hide_dock(app: &AppHandle) -> bool {
    let Ok(path) = app_config_path(app) else {
        return false;
    };
    let Ok(raw) = fs::read_to_string(&path) else {
        return false;
    };

    serde_json::from_str::<AppConfig>(&raw)
        .map(|config| config.hide_dock_when_minimized)
        .unwrap_or(false)
}

fn tray_template_icon() -> Image<'static> {
    Image::from_bytes(include_bytes!("../icons/menubar-icon.png"))
        .expect("failed to load menu bar icon")
}

/// Builds the tray menu: a Show entry, one quick-apply entry per saved layout,
/// and Quit. macOS auto-fits the template icon to the menu bar height.
fn build_tray_menu(app: &AppHandle, profiles: &[WorkspaceProfile]) -> tauri::Result<Menu<Wry>> {
    let show_item = MenuItem::with_id(app, "show", "Show WorkNeat", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit WorkNeat", true, None::<&str>)?;

    let profile_items = profiles
        .iter()
        .map(|profile| {
            let label = if profile.hotkey.trim().is_empty() {
                profile.name.clone()
            } else {
                format!("{}  ·  {}", profile.name, profile.hotkey)
            };
            MenuItem::with_id(app, format!("apply::{}", profile.id), label, true, None::<&str>)
        })
        .collect::<tauri::Result<Vec<_>>>()?;

    let mut builder = MenuBuilder::new(app).item(&show_item);
    if !profile_items.is_empty() {
        builder = builder.separator();
        for item in &profile_items {
            builder = builder.item(item);
        }
    }

    builder.separator().item(&quit_item).build()
}

/// Rebuilds the tray menu from the current profile list (called whenever the
/// frontend re-registers shortcuts after editing layouts).
fn refresh_tray_menu(app: &AppHandle) {
    let profiles = {
        let state = app.state::<AppState>();
        let profiles = state.profiles.lock().unwrap();
        profiles.clone()
    };

    let Ok(menu) = build_tray_menu(app, &profiles) else {
        return;
    };

    let tray = {
        let state = app.state::<AppState>();
        let guard = state.tray.lock().unwrap();
        guard.clone()
    };

    if let Some(tray) = tray {
        let _ = tray.set_menu(Some(menu));
    }
}

fn get_displays(app: &AppHandle) -> Vec<DisplayDescriptor> {
    let Some(window) = app.get_webview_window("main") else {
        return Vec::new();
    };

    let Ok(monitors) = window.available_monitors() else {
        return Vec::new();
    };

    let monitors_signature = monitors
        .iter()
        .map(|monitor| {
            let position = monitor.position();
            let size = monitor.size();
            format!("{},{},{}x{}", position.x, position.y, size.width, size.height)
        })
        .collect::<Vec<_>>()
        .join("|");
    let display_profiles = cached_system_display_profiles(app, &monitors_signature);
    let mut snapshots = monitors
        .into_iter()
        .enumerate()
        .map(|(index, monitor)| {
            let position = monitor.position();
            let size = monitor.size();
            let scale_factor = monitor.scale_factor();
            let logical_x = position.x as f64 / scale_factor;
            let logical_y = position.y as f64 / scale_factor;
            let logical_width = size.width as f64 / scale_factor;
            let logical_height = size.height as f64 / scale_factor;
            let monitor_name = monitor
                .name()
                .map(ToString::to_string)
                .unwrap_or_else(|| format!("Display {}", index + 1));
            let profile = display_profiles
                .iter()
                .filter(|profile| {
                    profile.width == size.width as u64 && profile.height == size.height as u64
                })
                .next()
                .or_else(|| display_profiles.get(index));
            let model_name = profile
                .map(|profile| profile.name.clone())
                .filter(|name| !name.is_empty())
                .unwrap_or(monitor_name);

            DisplaySnapshot {
                index,
                model_name,
                profile,
                frame: DisplayFrame {
                    x: logical_x,
                    y: logical_y,
                    width: logical_width,
                    height: logical_height,
                },
                native_frame: DisplayFrame {
                    x: position.x as f64,
                    y: position.y as f64,
                    width: size.width as f64,
                    height: size.height as f64,
                },
                scale_factor,
            }
        })
        .collect::<Vec<_>>();

    let topology_labels = display_topology_labels(&snapshots);
    let mut model_counts: BTreeMap<String, usize> = BTreeMap::new();
    for snapshot in &snapshots {
        *model_counts.entry(snapshot.model_name.clone()).or_insert(0) += 1;
    }

    snapshots
        .drain(..)
        .enumerate()
        .map(|(index, snapshot)| {
            let topology_label = topology_labels
                .get(index)
                .cloned()
                .unwrap_or_else(|| format!("display-{}", snapshot.index + 1));
            let duplicate_model_count = model_counts
                .get(&snapshot.model_name)
                .copied()
                .unwrap_or_default();
            let name = if duplicate_model_count > 1 {
                format!("{} {}", snapshot.model_name, title_case(&topology_label))
            } else {
                snapshot.model_name.clone()
            };
            let id = normalize_id(&format!(
                "display-{}-{}x{}-{}",
                snapshot.model_name,
                snapshot.native_frame.width as u32,
                snapshot.native_frame.height as u32,
                topology_label
            ));

            DisplayDescriptor {
                identity: DisplayIdentity {
                    id,
                    name,
                    vendor_id: snapshot.profile.and_then(|profile| profile.vendor_id),
                    product_id: snapshot.profile.and_then(|profile| profile.product_id),
                    serial_number: None,
                    is_built_in: snapshot.index == 0,
                },
                frame: snapshot.frame,
                native_frame: snapshot.native_frame,
                scale_factor: snapshot.scale_factor,
            }
        })
        .collect()
}

struct DisplaySnapshot<'a> {
    index: usize,
    model_name: String,
    profile: Option<&'a SystemDisplayProfile>,
    frame: DisplayFrame,
    native_frame: DisplayFrame,
    scale_factor: f64,
}

fn display_topology_labels(displays: &[DisplaySnapshot]) -> Vec<String> {
    if displays.len() <= 1 {
        return vec!["main".to_string(); displays.len()];
    }

    let min_x = displays
        .iter()
        .map(|display| display.frame.x)
        .fold(f64::INFINITY, f64::min);
    let max_x = displays
        .iter()
        .map(|display| display.frame.x)
        .fold(f64::NEG_INFINITY, f64::max);
    let min_y = displays
        .iter()
        .map(|display| display.frame.y)
        .fold(f64::INFINITY, f64::min);
    let max_y = displays
        .iter()
        .map(|display| display.frame.y)
        .fold(f64::NEG_INFINITY, f64::max);
    let horizontal_span = max_x - min_x;
    let vertical_span = max_y - min_y;
    let mut ordered = displays
        .iter()
        .enumerate()
        .map(|(index, display)| (index, display.frame.x, display.frame.y))
        .collect::<Vec<_>>();

    if horizontal_span >= vertical_span {
        ordered.sort_by(|left, right| {
            left.1
                .partial_cmp(&right.1)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| {
                    left.2
                        .partial_cmp(&right.2)
                        .unwrap_or(std::cmp::Ordering::Equal)
                })
        });
        topology_names_from_order(displays.len(), ordered, "left", "right", "middle")
    } else {
        ordered.sort_by(|left, right| {
            left.2
                .partial_cmp(&right.2)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| {
                    left.1
                        .partial_cmp(&right.1)
                        .unwrap_or(std::cmp::Ordering::Equal)
                })
        });
        topology_names_from_order(displays.len(), ordered, "top", "bottom", "middle")
    }
}

fn topology_names_from_order(
    display_count: usize,
    ordered: Vec<(usize, f64, f64)>,
    first: &str,
    last: &str,
    middle: &str,
) -> Vec<String> {
    let mut labels = vec![String::new(); display_count];

    for (position, (index, _, _)) in ordered.into_iter().enumerate() {
        let label = if position == 0 {
            first.to_string()
        } else if position == display_count - 1 {
            last.to_string()
        } else if display_count == 3 {
            middle.to_string()
        } else {
            format!("{}-{}", middle, position)
        };
        labels[index] = label;
    }

    labels
}

#[derive(Debug, Clone)]
struct SystemDisplayProfile {
    name: String,
    vendor_id: Option<u32>,
    product_id: Option<u32>,
    width: u64,
    height: u64,
}

/// Returns the cached `system_profiler` display profiles, refreshing only when
/// the monitor geometry signature changes (i.e. a display was plugged, unplugged
/// or rearranged). This keeps the hot layout-apply path off the very slow
/// `system_profiler` invocation.
fn cached_system_display_profiles(
    app: &AppHandle,
    monitors_signature: &str,
) -> Vec<SystemDisplayProfile> {
    let state = app.state::<AppState>();

    {
        let cache = state.display_profiles_cache.lock().unwrap();
        if let Some((signature, profiles)) = cache.as_ref() {
            if signature == monitors_signature {
                return profiles.clone();
            }
        }
    }

    let profiles = system_display_profiles();
    *state.display_profiles_cache.lock().unwrap() =
        Some((monitors_signature.to_string(), profiles.clone()));

    profiles
}

fn system_display_profiles() -> Vec<SystemDisplayProfile> {
    let Ok(output) = Command::new("system_profiler")
        .arg("SPDisplaysDataType")
        .arg("-json")
        .output()
    else {
        return Vec::new();
    };

    if !output.status.success() {
        return Vec::new();
    }

    let Ok(value) = serde_json::from_slice::<serde_json::Value>(&output.stdout) else {
        return Vec::new();
    };

    value
        .get("SPDisplaysDataType")
        .and_then(|items| items.as_array())
        .into_iter()
        .flatten()
        .flat_map(|gpu| {
            gpu.get("spdisplays_ndrvs")
                .and_then(|displays| displays.as_array())
                .into_iter()
                .flatten()
        })
        .filter(|display| {
            display
                .get("spdisplays_online")
                .and_then(|online| online.as_str())
                == Some("spdisplays_yes")
        })
        .filter_map(|display| {
            let name = display
                .get("_name")
                .and_then(|name| name.as_str())
                .unwrap_or("Display")
                .to_string();
            let pixels = display
                .get("_spdisplays_pixels")
                .or_else(|| display.get("spdisplays_pixelresolution"))
                .and_then(|pixels| pixels.as_str())
                .unwrap_or("");
            let (width, height) = parse_pixel_size(pixels)?;

            Some(SystemDisplayProfile {
                name,
                vendor_id: display
                    .get("_spdisplays_display-vendor-id")
                    .and_then(|id| id.as_str())
                    .and_then(|id| u32::from_str_radix(id, 16).ok()),
                product_id: display
                    .get("_spdisplays_display-product-id")
                    .and_then(|id| id.as_str())
                    .and_then(|id| u32::from_str_radix(id, 16).ok()),
                width,
                height,
            })
        })
        .collect()
}

fn parse_pixel_size(value: &str) -> Option<(u64, u64)> {
    let compact = value.replace(' ', "");
    let (width, height) = compact.split_once('x')?;
    Some((width.parse().ok()?, height.parse().ok()?))
}

fn display_set_signature(displays: &[DisplayDescriptor]) -> String {
    let mut parts = displays
        .iter()
        .map(|display| {
            format!(
                "{}-{}x{}",
                display.identity.id,
                display.native_frame.width as u32,
                display.native_frame.height as u32
            )
        })
        .collect::<Vec<_>>();
    parts.sort();
    parts.join("__")
}

#[derive(Debug)]
struct CapturedWindow {
    bundle_identifier: String,
    app_name: String,
    title: String,
    owner_pid: i32,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

#[derive(Debug)]
struct CapturedApp {
    app_name: String,
    bundle_identifier: String,
    windows: Vec<CapturedWindowPlacement>,
}

#[derive(Debug)]
struct CapturedWindowPlacement {
    title: String,
    display_id: String,
    relative_frame: RelativeFrame,
}

fn push_captured_window(
    apps: &mut Vec<CapturedApp>,
    bundle_identifier: String,
    app_name: String,
    window: CapturedWindowPlacement,
) {
    if let Some(app) = apps
        .iter_mut()
        .find(|app| app.bundle_identifier == bundle_identifier)
    {
        app.windows.push(window);
        return;
    }

    apps.push(CapturedApp {
        app_name,
        bundle_identifier,
        windows: vec![window],
    });
}

fn capture_visible_windows() -> Result<Vec<CapturedWindow>, String> {
    let Some(info) = copy_window_info(
        kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements,
        kCGNullWindowID,
    ) else {
        return Ok(Vec::new());
    };

    let windows = info
        .iter()
        .filter_map(|window_ref| {
            let window_dict = unsafe {
                CFDictionary::<CFString, *const std::ffi::c_void>::wrap_under_get_rule(
                    *window_ref as CFDictionaryRef,
                )
            };
            let layer = dict_get_i32(&window_dict, unsafe { kCGWindowLayer })?;
            if layer != 0 {
                return None;
            }

            let app_name = dict_get_string(&window_dict, unsafe { kCGWindowOwnerName })?;
            if app_name == "WorkNeat" || app_name == "Window Server" || app_name == "Dock" {
                return None;
            }
            let owner_pid = dict_get_i32(&window_dict, unsafe { kCGWindowOwnerPID })?;

            let rect = dict_get_rect(&window_dict, unsafe { kCGWindowBounds })?;
            if rect.size.width < 80.0 || rect.size.height < 80.0 {
                return None;
            }

            let title = dict_get_string(&window_dict, unsafe { kCGWindowName }).unwrap_or_default();
            Some(CapturedWindow {
                bundle_identifier: app_name.clone(),
                app_name,
                title,
                owner_pid,
                x: rect.origin.x,
                y: rect.origin.y,
                width: rect.size.width,
                height: rect.size.height,
            })
        })
        .collect();

    Ok(windows)
}

fn dict_get_string(
    dict: &CFDictionary<CFString, *const std::ffi::c_void>,
    key: CFStringRef,
) -> Option<String> {
    let value = dict.find(unsafe { CFString::wrap_under_get_rule(key) })?;
    let string = unsafe { CFString::wrap_under_get_rule(*value as CFStringRef) };
    Some(string.to_string())
}

fn dict_get_i32(
    dict: &CFDictionary<CFString, *const std::ffi::c_void>,
    key: CFStringRef,
) -> Option<i32> {
    let value = dict.find(unsafe { CFString::wrap_under_get_rule(key) })?;
    let number = unsafe { CFNumber::wrap_under_get_rule(*value as _) };
    number.to_i32()
}

fn dict_get_rect(
    dict: &CFDictionary<CFString, *const std::ffi::c_void>,
    key: CFStringRef,
) -> Option<CGRect> {
    let value = dict.find(unsafe { CFString::wrap_under_get_rule(key) })?;
    let mut rect = CGRect::new(&Default::default(), &Default::default());
    let ok =
        unsafe { CGRectMakeWithDictionaryRepresentation(*value as CFDictionaryRef, &mut rect) };
    if ok {
        Some(rect)
    } else {
        None
    }
}

fn launch_requested_apps(profile: &WorkspaceProfile) -> Result<bool, String> {
    let launch_lines = profile
        .app_rules
        .iter()
        .filter(|rule| rule.launch_behavior == "launch" && !rule.bundle_identifier.is_empty())
        .map(|rule| {
            if rule.bundle_identifier.contains('.') {
                format!(
                    "try\n  tell application id \"{}\" to launch\nend try",
                    escape_applescript(&rule.bundle_identifier)
                )
            } else {
                format!(
                    "try\n  tell application \"{}\" to launch\nend try",
                    escape_applescript(&rule.app_name)
                )
            }
        })
        .collect::<Vec<_>>();

    if launch_lines.is_empty() {
        return Ok(false);
    }

    run_applescript(&launch_lines.join("\n"))?;
    Ok(true)
}

fn apply_profile_with_accessibility(
    profile: &WorkspaceProfile,
    displays: &[DisplayDescriptor],
) -> Result<usize, String> {
    let windows = capture_visible_windows()?;
    let mut app_pids: BTreeMap<String, Vec<i32>> = BTreeMap::new();

    for window in windows {
        for key in [
            app_lookup_key(&window.bundle_identifier),
            app_lookup_key(&window.app_name),
        ] {
            if key.is_empty() {
                continue;
            }

            let entry = app_pids.entry(key).or_default();
            if !entry.contains(&window.owner_pid) {
                entry.push(window.owner_pid);
            }
        }
    }

    let mut moved_windows = 0;
    for rule in profile.app_rules.iter().rev() {
        let pids = app_pids
            .get(&app_lookup_key(&rule.bundle_identifier))
            .or_else(|| app_pids.get(&app_lookup_key(&rule.app_name)));

        let Some(pids) = pids else {
            continue;
        };

        for pid in pids {
            let moved_for_pid = move_ax_windows_for_pid(*pid, &rule.placements, displays);
            moved_windows += moved_for_pid;
            if moved_for_pid > 0 {
                break;
            }
        }
    }

    Ok(moved_windows)
}

fn move_ax_windows_for_pid(
    pid: i32,
    placements: &[WindowPlacement],
    displays: &[DisplayDescriptor],
) -> usize {
    if placements.is_empty() {
        return 0;
    }

    unsafe {
        let app_element = AXUIElementCreateApplication(pid);
        if app_element.is_null() {
            return 0;
        }

        let windows_attribute = CFString::new("AXWindows");
        let mut windows_value: CFTypeRef = ptr::null();
        let copy_error = AXUIElementCopyAttributeValue(
            app_element,
            windows_attribute.as_concrete_TypeRef(),
            &mut windows_value,
        );
        if copy_error != AX_ERROR_SUCCESS || windows_value.is_null() {
            CFRelease(app_element as CFTypeRef);
            return 0;
        }

        let windows = CFArray::<*const c_void>::wrap_under_create_rule(windows_value as CFArrayRef);
        let window_values = windows.get_all_values();
        let mut moved_windows = 0;

        for placement in placements.iter().rev() {
            let Some(target) = target_frame_for_placement(displays, placement) else {
                continue;
            };
            let Some(window_element) = window_values.get(placement.order_index) else {
                continue;
            };

            if set_ax_window_frame(*window_element, &target) {
                raise_ax_window(*window_element);
                moved_windows += 1;
            }
        }

        CFRelease(app_element as CFTypeRef);
        moved_windows
    }
}

fn raise_ax_window(window: AXUIElementRef) -> bool {
    unsafe {
        let raise_action = CFString::new("AXRaise");
        AXUIElementPerformAction(window, raise_action.as_concrete_TypeRef()) == AX_ERROR_SUCCESS
    }
}

fn set_ax_window_frame(window: AXUIElementRef, target: &TargetFrame) -> bool {
    unsafe {
        let minimized_attribute = CFString::new("AXMinimized");
        let position_attribute = CFString::new("AXPosition");
        let size_attribute = CFString::new("AXSize");
        let minimized = CFBoolean::false_value();
        let _ = AXUIElementSetAttributeValue(
            window,
            minimized_attribute.as_concrete_TypeRef(),
            minimized.as_CFTypeRef(),
        );

        let position = CGPoint::new(target.x.round(), target.y.round());
        let size = CGSize::new(target.width.round(), target.height.round());
        let position_value = AXValueCreate(
            AX_VALUE_CGPOINT_TYPE,
            &position as *const CGPoint as *const c_void,
        );
        let size_value = AXValueCreate(
            AX_VALUE_CGSIZE_TYPE,
            &size as *const CGSize as *const c_void,
        );

        if position_value.is_null() || size_value.is_null() {
            if !position_value.is_null() {
                CFRelease(position_value);
            }
            if !size_value.is_null() {
                CFRelease(size_value);
            }
            return false;
        }

        let size_error =
            AXUIElementSetAttributeValue(window, size_attribute.as_concrete_TypeRef(), size_value);
        let position_error = AXUIElementSetAttributeValue(
            window,
            position_attribute.as_concrete_TypeRef(),
            position_value,
        );

        CFRelease(position_value);
        CFRelease(size_value);

        size_error == AX_ERROR_SUCCESS || position_error == AX_ERROR_SUCCESS
    }
}

fn app_lookup_key(value: &str) -> String {
    value.trim().to_lowercase()
}

fn build_apply_script(
    profile: &WorkspaceProfile,
    displays: &[DisplayDescriptor],
) -> Result<String, String> {
    let mut launch_lines = Vec::new();
    let mut move_lines = Vec::new();

    for rule in profile.app_rules.iter().rev() {
        if rule.launch_behavior == "launch" && !rule.bundle_identifier.is_empty() {
            if rule.bundle_identifier.contains('.') {
                launch_lines.push(format!(
                    "try\n  tell application id \"{}\" to launch\nend try",
                    escape_applescript(&rule.bundle_identifier)
                ));
            } else {
                launch_lines.push(format!(
                    "try\n  tell application \"{}\" to launch\nend try",
                    escape_applescript(&rule.app_name)
                ));
            }
        }

        if rule.placements.is_empty() {
            continue;
        }

        move_lines.push(format!(
            "try\n  if exists application process \"{}\" then\n    tell application process \"{}\"",
            escape_applescript(&rule.app_name),
            escape_applescript(&rule.app_name)
        ));

        for placement in rule.placements.iter().rev() {
            let Some(target) = target_frame_for_placement(displays, placement) else {
                continue;
            };
            let window_number = placement.order_index + 1;
            move_lines.push(format!(
                "      if (count of windows) >= {window_number} then\n        try\n          set value of attribute \"AXMinimized\" of window {window_number} to false\n        end try\n        set size of window {window_number} to {{{width}, {height}}}\n        set position of window {window_number} to {{{x}, {y}}}\n      end if",
                window_number = window_number,
                x = target.x.round() as i64,
                y = target.y.round() as i64,
                width = target.width.round() as i64,
                height = target.height.round() as i64,
            ));
        }

        move_lines.push("    end tell\n  end if\nend try".to_string());
    }

    if launch_lines.is_empty() && move_lines.is_empty() {
        return Err("This layout has no windows to apply.".to_string());
    }

    let mut script = String::new();
    if !launch_lines.is_empty() {
        script.push_str(&launch_lines.join("\n"));
        script.push_str("\ndelay 0.8\n");
    }
    script.push_str("tell application \"System Events\"\n");
    script.push_str(&move_lines.join("\n"));
    script.push_str("\nend tell\n");

    Ok(script)
}

struct TargetFrame {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

fn target_frame_for_placement(
    displays: &[DisplayDescriptor],
    placement: &WindowPlacement,
) -> Option<TargetFrame> {
    let display = resolve_display_for_placement(displays, &placement.display_id)?;

    Some(TargetFrame {
        x: display.frame.x + placement.relative_frame.x * display.frame.width,
        y: display.frame.y + placement.relative_frame.y * display.frame.height,
        width: placement.relative_frame.width * display.frame.width,
        height: placement.relative_frame.height * display.frame.height,
    })
}

fn resolve_display_for_placement<'a>(
    displays: &'a [DisplayDescriptor],
    previous_display_id: &str,
) -> Option<&'a DisplayDescriptor> {
    if let Some(display) = displays
        .iter()
        .find(|display| display.identity.id == previous_display_id)
    {
        return Some(display);
    }

    let normalized = previous_display_id.to_lowercase();
    for token in ["left", "right", "top", "bottom", "middle"] {
        if normalized.contains(token) {
            if let Some(display) = displays.iter().find(|display| {
                display.identity.id.contains(token)
                    || display.identity.name.to_lowercase().contains(token)
            }) {
                return Some(display);
            }
        }
    }

    if displays.len() == 2 {
        let left_display = displays
            .iter()
            .find(|display| display.identity.id.contains("left"));
        let right_display = displays
            .iter()
            .find(|display| display.identity.id.contains("right"));

        if legacy_display_number(&normalized) == Some(2) {
            if let Some(display) = left_display {
                return Some(display);
            }
        }

        if legacy_display_number(&normalized) == Some(1) {
            if let Some(display) = right_display {
                return Some(display);
            }
        }
    }

    displays.first()
}

fn legacy_display_number(value: &str) -> Option<u8> {
    let bytes = value.as_bytes();
    for (index, byte) in bytes.iter().enumerate() {
        if *byte != b'1' && *byte != b'2' {
            continue;
        }

        let previous_is_boundary = index == 0 || matches!(bytes[index - 1], b'-' | b' ' | b'_');
        let next_is_boundary =
            index + 1 == bytes.len() || matches!(bytes[index + 1], b'-' | b' ' | b'_');

        if previous_is_boundary && next_is_boundary {
            return Some(byte - b'0');
        }
    }

    None
}

fn run_applescript(script: &str) -> Result<String, String> {
    let output = Command::new("osascript")
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|error| format!("Failed to run AppleScript: {error}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn escape_applescript(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

fn display_for_window<'a>(
    displays: &'a [DisplayDescriptor],
    window: &CapturedWindow,
) -> &'a DisplayDescriptor {
    let center_x = window.x + window.width / 2.0;
    let center_y = window.y + window.height / 2.0;

    displays
        .iter()
        .find(|display| {
            center_x >= display.frame.x
                && center_x <= display.frame.x + display.frame.width
                && center_y >= display.frame.y
                && center_y <= display.frame.y + display.frame.height
        })
        .unwrap_or(&displays[0])
}

fn relative_frame_for_window(
    display: &DisplayDescriptor,
    window: &CapturedWindow,
) -> RelativeFrame {
    RelativeFrame {
        x: clamp((window.x - display.frame.x) / display.frame.width, 0.0, 1.0),
        y: clamp(
            (window.y - display.frame.y) / display.frame.height,
            0.0,
            1.0,
        ),
        width: clamp(window.width / display.frame.width, 0.05, 1.0),
        height: clamp(window.height / display.frame.height, 0.05, 1.0),
    }
}

fn stable_id(prefix: &str, value: &str, index: usize) -> String {
    format!("{}-{}-{}", prefix, normalize_id(value), index)
}

fn title_case(value: &str) -> String {
    value
        .split('-')
        .filter(|part| !part.is_empty())
        .map(|part| {
            let mut characters = part.chars();
            match characters.next() {
                Some(first) => format!(
                    "{}{}",
                    first.to_uppercase(),
                    characters.as_str().to_lowercase()
                ),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn normalize_id(value: &str) -> String {
    let normalized = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>();

    normalized
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

fn clamp(value: f64, min: f64, max: f64) -> f64 {
    value.max(min).min(max)
}

fn now_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() != ShortcutState::Pressed {
                        return;
                    }

                    let profile_id = {
                        let state = app.state::<AppState>();
                        let shortcuts = state.shortcuts.lock().unwrap();
                        shortcuts
                            .iter()
                            .find(|(registered, _)| registered == shortcut)
                            .map(|(_, id)| id.clone())
                    };

                    if let Some(profile_id) = profile_id {
                        apply_profile_by_id(app, &profile_id);
                    }
                })
                .build(),
        )
        .manage(AppState::default())
        .setup(|app| {
            let handle = app.handle();
            *handle.state::<AppState>().hide_dock.lock().unwrap() = stored_hide_dock(handle);

            let menu = build_tray_menu(handle, &[])?;
            let tray = TrayIconBuilder::with_id("workneat-tray")
                .icon(tray_template_icon())
                .icon_as_template(true)
                .tooltip("WorkNeat")
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => show_main_window(app),
                    "quit" => app.exit(0),
                    other => {
                        if let Some(profile_id) = other.strip_prefix("apply::") {
                            apply_profile_by_id(app, profile_id);
                        }
                    }
                })
                .build(handle)?;

            handle.state::<AppState>().tray.lock().unwrap().replace(tray);
            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::Focused(true) => {
                let _ = window
                    .app_handle()
                    .set_activation_policy(ActivationPolicy::Regular);
            }
            // When the user runs WorkNeat as a menu-bar app, the red close button
            // should tuck it back into the tray instead of quitting it.
            WindowEvent::CloseRequested { api, .. } => {
                let app = window.app_handle();
                let hide_dock = *app.state::<AppState>().hide_dock.lock().unwrap();
                if hide_dock {
                    api.prevent_close();
                    let _ = window.hide();
                    let _ = app.set_activation_policy(ActivationPolicy::Accessory);
                }
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            get_runtime_snapshot,
            load_app_config,
            save_app_config,
            minimize_main_window,
            register_profile_shortcuts,
            request_accessibility_permission,
            reveal_current_app_in_finder,
            open_accessibility_settings,
            capture_current_layout,
            list_window_sources,
            apply_workspace_profile
        ])
        .run(tauri::generate_context!())
        .expect("failed to run WorkNeat");
}

fn main() {
    run();
}
