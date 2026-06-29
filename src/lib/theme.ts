import type { ThemeMode } from "../types/layout";

const THEME_STORAGE_KEY = "workneat.theme.v1";
const themeModes: ThemeMode[] = ["light", "dark", "system"];

type Appearance = "light" | "dark";

/**
 * Resolves a theme mode to a concrete appearance, following the OS preference
 * when the mode is "system".
 * @param mode - The selected theme mode
 */
function resolveAppearance({ mode }: { mode: ThemeMode }): Appearance {
  if (mode !== "system") return mode;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Applies a theme mode to the document root using HeroUI v3's `class` +
 * `data-theme` convention, and remembers the choice for the next launch.
 * @param mode - The theme mode to apply
 */
export function applyThemeMode({ mode }: { mode: ThemeMode }): Appearance {
  const appearance = resolveAppearance({ mode });
  const root = document.documentElement;

  root.classList.toggle("dark", appearance === "dark");
  root.classList.toggle("light", appearance === "light");
  root.dataset.theme = appearance;
  window.localStorage.setItem(THEME_STORAGE_KEY, mode);

  return appearance;
}

/** Reads the persisted theme mode, defaulting to "system". */
export function loadThemeMode(): ThemeMode {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return themeModes.includes(stored as ThemeMode) ? (stored as ThemeMode) : "system";
}

/**
 * Subscribes to OS appearance changes so a "system" theme tracks the OS live.
 * @param getMode - Returns the current theme mode at notification time
 * @returns An unsubscribe function
 */
export function watchSystemAppearance({ getMode }: { getMode: () => ThemeMode }): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const handleChange = () => {
    if (getMode() === "system") applyThemeMode({ mode: "system" });
  };

  media.addEventListener("change", handleChange);
  return () => media.removeEventListener("change", handleChange);
}
