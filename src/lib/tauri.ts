import { invoke } from "@tauri-apps/api/core";
import { mockRuntime } from "./mockData";
import type { PermissionStatus } from "../types/layout";
import type { AppConfig, AppSource, RuntimeSnapshot, WorkspaceProfile } from "../types/layout";

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

export async function applyWorkspaceProfile(profile: WorkspaceProfile) {
  try {
    return await invoke<string>("apply_workspace_profile", { profile });
  } catch (error) {
    console.warn("Unable to apply layout", error);
    return null;
  }
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
