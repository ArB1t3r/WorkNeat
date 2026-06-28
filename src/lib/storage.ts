import { starterProfile } from "./mockData";
import { ensureUniqueProfileHotkeys } from "./hotkeys";
import type { AppConfig, AppIconId, WorkspaceProfile } from "../types/layout";

const STORAGE_KEY = "workneat.profiles.v1";
const CONFIG_STORAGE_KEY = "workneat.config.v1";
const DEFAULT_ICON_ID: AppIconId = "display";
const DEFAULT_HIDE_DOCK_WHEN_MINIMIZED = false;
const DEFAULT_SNAP_TO_GRID = true;
const iconIds: AppIconId[] = ["display", "tiles", "layers", "focus"];

export function createAppConfig(
  profiles: WorkspaceProfile[],
  appIconId: AppIconId = DEFAULT_ICON_ID,
  hideDockWhenMinimized = DEFAULT_HIDE_DOCK_WHEN_MINIMIZED,
  snapToGrid = DEFAULT_SNAP_TO_GRID,
): AppConfig {
  return {
    version: 1,
    profiles: ensureUniqueProfileHotkeys(profiles.length > 0 ? profiles : [starterProfile]),
    appIconId: iconIds.includes(appIconId) ? appIconId : DEFAULT_ICON_ID,
    hideDockWhenMinimized,
    snapToGrid,
  };
}

export function loadProfiles(): WorkspaceProfile[] {
  return loadLocalConfig().profiles;
}

export function loadLocalConfig(): AppConfig {
  const configRaw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
  if (configRaw) {
    try {
      const parsed = JSON.parse(configRaw) as Partial<AppConfig>;
      return createAppConfig(
        parsed.profiles ?? [starterProfile],
        (parsed.appIconId as AppIconId | undefined) ?? DEFAULT_ICON_ID,
        parsed.hideDockWhenMinimized ?? DEFAULT_HIDE_DOCK_WHEN_MINIMIZED,
        parsed.snapToGrid ?? DEFAULT_SNAP_TO_GRID,
      );
    } catch {
      return createAppConfig([starterProfile]);
    }
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return createAppConfig([starterProfile]);
  }
  try {
    const parsed = JSON.parse(raw) as WorkspaceProfile[];
    const migrated = parsed.map((profile) => ({
      ...profile,
      hotkeyBinding: profile.hotkeyBinding ?? profile.hotkey,
    }));
    return createAppConfig(migrated.length > 0 ? migrated : [starterProfile]);
  } catch {
    return createAppConfig([starterProfile]);
  }
}

export function saveProfiles(profiles: WorkspaceProfile[]) {
  saveLocalConfig(createAppConfig(profiles));
}

export function saveLocalConfig(config: AppConfig) {
  window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config.profiles));
}
