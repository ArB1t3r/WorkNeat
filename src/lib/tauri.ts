import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { mockRuntime } from "./mockData";
import type { PermissionStatus } from "../types/layout";
import type {
  AppConfig,
  ApplyResult,
  AppSource,
  RuntimeSnapshot,
  WorkspaceProfile,
} from "../types/layout";

export async function getRuntimeSnapshot(): Promise<RuntimeSnapshot> {
  try {
    return await invoke<RuntimeSnapshot>("get_runtime_snapshot");
  } catch {
    return mockRuntime;
  }
}

export async function loadAppConfig(): Promise<AppConfig | null> {
  try {
    return await invoke<AppConfig | null>("load_app_config");
  } catch (error) {
    console.warn("Unable to load app config", error);
    return null;
  }
}

export async function saveAppConfig(config: AppConfig) {
  try {
    await invoke("save_app_config", { config });
  } catch (error) {
    console.warn("Unable to save app config", error);
  }
}

export async function minimizeMainWindow(hideDock: boolean) {
  try {
    await invoke("minimize_main_window", { hideDock });
  } catch (error) {
    console.warn("Unable to minimize main window", error);
  }
}

export async function captureCurrentLayout(): Promise<WorkspaceProfile | null> {
  try {
    return await invoke<WorkspaceProfile | null>("capture_current_layout");
  } catch (error) {
    console.warn("Unable to capture layout", error);
    return null;
  }
}

export async function registerProfileShortcuts(
  profiles: WorkspaceProfile[],
): Promise<string[]> {
  try {
    return await invoke<string[]>("register_profile_shortcuts", { profiles });
  } catch (error) {
    console.warn("Unable to register global shortcuts", error);
    return [];
  }
}

export async function applyWorkspaceProfile(profile: WorkspaceProfile): Promise<ApplyResult> {
  // Let failures surface (e.g. permission missing) so the UI can report them.
  return await invoke<ApplyResult>("apply_workspace_profile", { profile });
}

export async function exportConfigToFile(contents: string): Promise<boolean> {
  const path = await save({
    defaultPath: "workneat-layouts.json",
    filters: [{ name: "WorkNeat Layouts", extensions: ["json"] }],
  });
  if (!path) return false;

  await invoke("export_config", { path, contents });
  return true;
}

export async function importConfigFromFile(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "WorkNeat Layouts", extensions: ["json"] }],
  });
  if (!selected || Array.isArray(selected)) return null;

  return await invoke<string>("import_config", { path: selected });
}

export async function listWindowSources(): Promise<AppSource[]> {
  try {
    return await invoke<AppSource[]>("list_window_sources");
  } catch (error) {
    console.warn("Unable to list window sources", error);
    return [];
  }
}

export async function requestAccessibilityPermission(): Promise<PermissionStatus> {
  try {
    return await invoke<PermissionStatus>("request_accessibility_permission");
  } catch {
    return "unknown";
  }
}

export async function openAccessibilitySettings() {
  try {
    return await invoke("open_accessibility_settings");
  } catch {
    return null;
  }
}

export async function revealCurrentAppInFinder() {
  try {
    return await invoke("reveal_current_app_in_finder");
  } catch {
    return null;
  }
}

export async function isLaunchAtLoginEnabled(): Promise<boolean> {
  try {
    return await invoke<boolean>("is_launch_at_login_enabled");
  } catch (error) {
    console.warn("Unable to read launch-at-login state", error);
    return false;
  }
}

export async function setLaunchAtLogin(enable: boolean): Promise<void> {
  // Let failures surface so the settings UI can report why the login item
  // could not be written, instead of silently flipping back.
  await invoke("set_launch_at_login", { enable });
}
