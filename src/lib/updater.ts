import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

interface UpdateAvailable {
  available: true;
  version: string;
  notes?: string;
  /** Downloads + installs the update, then relaunches the app. */
  install: () => Promise<void>;
}

interface UpdateUnavailable {
  available: false;
}

type UpdateCheck = UpdateAvailable | UpdateUnavailable;

/**
 * Checks the configured update endpoint for a newer signed release.
 * Throws on network/endpoint errors so the caller can surface them.
 */
export async function checkForUpdate(): Promise<UpdateCheck> {
  const update = await check();
  if (!update) return { available: false };

  return {
    available: true,
    version: update.version,
    notes: update.body,
    install: async () => {
      await update.downloadAndInstall();
      await relaunch();
    },
  };
}
