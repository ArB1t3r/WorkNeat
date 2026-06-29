import { starterProfile } from "./mockData";
import { ensureUniqueProfileHotkeys } from "./hotkeys";
import type { AppConfig, AppIconId, ThemeMode, WorkspaceProfile } from "../types/layout";

const STORAGE_KEY = "workneat.profiles.v1";
const CONFIG_STORAGE_KEY = "workneat.config.v1";
const DEFAULT_ICON_ID: AppIconId = "display";
const DEFAULT_THEME: ThemeMode = "system";
const DEFAULT_GRID = 12;
const MIN_GRID = 2;
const MAX_GRID = 48;
const iconIds: AppIconId[] = ["display", "tiles", "layers", "focus"];
const themeModes: ThemeMode[] = ["light", "dark", "system"];

/** Clamps a grid division count into a sane, usable range. */
function clampGrid(value: number | undefined): number {
  const rounded = Math.round(Number(value));
  if (!Number.isFinite(rounded)) return DEFAULT_GRID;
  return Math.min(MAX_GRID, Math.max(MIN_GRID, rounded));
}

interface AppConfigInput {
  profiles: WorkspaceProfile[];
  appIconId?: AppIconId;
  hideDockWhenMinimized?: boolean;
  snapToGrid?: boolean;
  theme?: ThemeMode;
  launchAtLogin?: boolean;
  gridColumns?: number;
  gridRows?: number;
  suppressMoveWarnings?: boolean;
  icloudSync?: boolean;
}

export function createAppConfig({
  profiles,
  appIconId = DEFAULT_ICON_ID,
  hideDockWhenMinimized = false,
  snapToGrid = true,
  theme = DEFAULT_THEME,
  launchAtLogin = false,
  gridColumns,
  gridRows,
  suppressMoveWarnings = false,
  icloudSync = false,
}: AppConfigInput): AppConfig {
  return {
    version: 1,
    profiles: ensureUniqueProfileHotkeys(profiles.length > 0 ? profiles : [starterProfile]),
    appIconId: iconIds.includes(appIconId) ? appIconId : DEFAULT_ICON_ID,
    hideDockWhenMinimized,
    snapToGrid,
    theme: themeModes.includes(theme) ? theme : DEFAULT_THEME,
    launchAtLogin,
    gridColumns: clampGrid(gridColumns),
    gridRows: clampGrid(gridRows),
    suppressMoveWarnings,
    icloudSync,
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
      return createAppConfig({
        profiles: parsed.profiles ?? [starterProfile],
        appIconId: parsed.appIconId,
        hideDockWhenMinimized: parsed.hideDockWhenMinimized,
        snapToGrid: parsed.snapToGrid,
        theme: parsed.theme,
        launchAtLogin: parsed.launchAtLogin,
        gridColumns: parsed.gridColumns,
        gridRows: parsed.gridRows,
        suppressMoveWarnings: parsed.suppressMoveWarnings,
        icloudSync: parsed.icloudSync,
      });
    } catch {
      return createAppConfig({ profiles: [starterProfile] });
    }
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return createAppConfig({ profiles: [starterProfile] });

  try {
    const parsed = JSON.parse(raw) as WorkspaceProfile[];
    const migrated = parsed.map((profile) => ({
      ...profile,
      hotkeyBinding: profile.hotkeyBinding ?? profile.hotkey,
    }));
    return createAppConfig({ profiles: migrated.length > 0 ? migrated : [starterProfile] });
  } catch {
    return createAppConfig({ profiles: [starterProfile] });
  }
}

export function saveProfiles(profiles: WorkspaceProfile[]) {
  saveLocalConfig(createAppConfig({ profiles }));
}

export function saveLocalConfig(config: AppConfig) {
  window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config.profiles));
}
