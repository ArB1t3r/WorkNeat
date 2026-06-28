import type { WorkspaceProfile } from "../types/layout";

const symbolMap: Array<[RegExp, string]> = [
  [/⌘/g, "Command+"],
  [/⌥/g, "Alt+"],
  [/⌃/g, "Control+"],
  [/⇧/g, "Shift+"],
];

const defaultHotkeys = [
  "⌥⌘1",
  "⌥⌘2",
  "⌥⌘3",
  "⌥⌘4",
  "⌥⌘5",
  "⌥⌘6",
  "⌥⌘7",
  "⌥⌘8",
  "⌥⌘9",
  "⌥⌘0",
  "⌥⌘A",
  "⌥⌘B",
  "⌥⌘C",
  "⌥⌘D",
  "⌥⌘E",
  "⌥⌘F",
  "⌥⌘G",
  "⌥⌘H",
  "⌥⌘J",
  "⌥⌘K",
  "⌥⌘L",
  "⌥⌘M",
  "⌥⌘N",
  "⌥⌘P",
  "⌥⌘Q",
  "⌥⌘R",
  "⌥⌘S",
  "⌥⌘T",
  "⌥⌘U",
  "⌥⌘V",
  "⌥⌘W",
  "⌥⌘X",
  "⌥⌘Y",
  "⌥⌘Z",
];

const displayModifierOrder = ["Control", "Alt", "Shift", "Command"] as const;
const bindingModifierOrder = ["Control", "Alt", "Shift", "Command"] as const;
const modifierNames = new Set<string>(bindingModifierOrder);

export const maxHotkeyKeys = 6;

type ModifierName = (typeof bindingModifierOrder)[number];

interface KeyboardShortcutEvent {
  altKey: boolean;
  code: string;
  ctrlKey: boolean;
  key: string;
  metaKey: boolean;
  shiftKey: boolean;
}

const keyAliases = new Map<string, string>([
  [" ", "Space"],
  ["Alt", "Alt"],
  ["ArrowUp", "ArrowUp"],
  ["ArrowDown", "ArrowDown"],
  ["ArrowLeft", "ArrowLeft"],
  ["ArrowRight", "ArrowRight"],
  ["Backspace", "Backspace"],
  ["Cmd", "Command"],
  ["Command", "Command"],
  ["Control", "Control"],
  ["Ctrl", "Control"],
  ["Delete", "Delete"],
  ["Enter", "Enter"],
  ["Escape", "Escape"],
  ["Home", "Home"],
  ["End", "End"],
  ["PageUp", "PageUp"],
  ["PageDown", "PageDown"],
  ["Meta", "Command"],
  ["Option", "Alt"],
  ["OS", "Command"],
  ["Shift", "Shift"],
  ["Tab", "Tab"],
  ["Spacebar", "Space"],
  ["Esc", "Escape"],
]);

export function normalizeHotkeyBinding(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  let normalized = trimmed;
  for (const [pattern, replacement] of symbolMap) {
    normalized = normalized.replace(pattern, replacement);
  }

  const tokens = normalized
    .replace(/\s+/g, "")
    .split("+")
    .map(normalizeKeyToken)
    .filter((token): token is string => Boolean(token));
  const uniqueTokens = Array.from(new Set(tokens)).slice(0, maxHotkeyKeys);

  return orderHotkeyTokens(uniqueTokens).join("+");
}

export function formatHotkeyDisplay(value: string): string {
  const binding = normalizeHotkeyBinding(value);
  if (!binding) return "";

  const tokens = binding.split("+").filter(Boolean);
  const modifiers = new Set(tokens.filter(isModifierKeyToken));
  const keys = tokens.filter((token) => !isModifierKeyToken(token));
  const modifierText = displayModifierOrder
    .filter((modifier) => modifiers.has(modifier))
    .map((modifier) => {
      if (modifier === "Command") return "⌘";
      if (modifier === "Alt") return "⌥";
      if (modifier === "Control") return "⌃";
      return "⇧";
    })
    .join("");
  const keyText = keys.map(formatKeyDisplay).join("+");

  return `${modifierText}${keyText}`;
}

export function hotkeyFromKeyboardEvent(
  event: KeyboardShortcutEvent,
): { hotkey: string; hotkeyBinding: string } | null {
  const modifiers = modifiersFromEvent(event);
  const key = keyTokenFromKeyboardEvent(event);
  if (!key || modifiers.length === 0) return null;
  if (isModifierKeyToken(key)) return null;
  if (modifiers.length === 1 && modifiers[0] === "Shift") return null;

  return hotkeyFromKeyTokens([...modifiers, key]);
}

export function hotkeyFromKeyTokens(
  keyTokens: string[],
): { hotkey: string; hotkeyBinding: string } | null {
  const tokens = orderHotkeyTokens(
    Array.from(
      new Set(keyTokens.map(normalizeKeyToken).filter((token): token is string => Boolean(token))),
    ),
  ).slice(0, maxHotkeyKeys);
  const modifiers = tokens.filter(isModifierKeyToken);
  const keys = tokens.filter((token) => !isModifierKeyToken(token));

  if (keys.length === 0) return null;
  if (modifiers.length === 0 && keys.length < 2) return null;
  if (modifiers.length === 1 && modifiers[0] === "Shift" && keys.length === 1) return null;

  const hotkeyBinding = tokens.join("+");
  return {
    hotkey: formatHotkeyDisplay(hotkeyBinding),
    hotkeyBinding,
  };
}

export function isModifierKeyToken(key: string): key is ModifierName {
  return modifierNames.has(key);
}

function modifiersFromEvent(event: KeyboardShortcutEvent): ModifierName[] {
  const active = new Set<ModifierName>();
  if (event.ctrlKey) active.add("Control");
  if (event.altKey) active.add("Alt");
  if (event.shiftKey) active.add("Shift");
  if (event.metaKey) active.add("Command");
  return bindingModifierOrder.filter((modifier) => active.has(modifier));
}

export function keyTokenFromKeyboardEvent(event: KeyboardShortcutEvent): string | null {
  if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3);
  if (/^Digit\d$/.test(event.code)) return event.code.slice(5);
  if (/^Numpad\d$/.test(event.code)) return event.code;
  if (/^F\d{1,2}$/.test(event.code)) return event.code;

  const aliased = keyAliases.get(event.key) ?? keyAliases.get(event.code);
  if (aliased) return aliased;
  if (event.key.length === 1) return event.key.toUpperCase();
  return normalizeKeyToken(event.code) || null;
}

function normalizeKeyToken(value: string | null | undefined): string | null {
  if (!value) return null;

  const token = value.trim();
  if (!token) return null;

  if (/^cmd$/i.test(token) || /^commandorcontrol$/i.test(token) || /^meta$/i.test(token)) {
    return "Command";
  }
  if (/^command$/i.test(token)) return "Command";
  if (/^ctrl$/i.test(token) || /^control$/i.test(token)) return "Control";
  if (/^alt$/i.test(token) || /^opt$/i.test(token) || /^option$/i.test(token)) return "Alt";
  if (/^shift$/i.test(token)) return "Shift";
  if (/^Control(Left|Right)$/i.test(token)) return "Control";
  if (/^Alt(Left|Right)$/i.test(token) || /^Option(Left|Right)$/i.test(token)) return "Alt";
  if (/^Shift(Left|Right)$/i.test(token)) return "Shift";
  if (/^(Meta|Command|OS)(Left|Right)$/i.test(token)) return "Command";
  if (/^Key[A-Z]$/i.test(token)) return token.slice(3).toUpperCase();
  if (/^Digit\d$/i.test(token)) return token.slice(5);
  if (/^Numpad\d$/i.test(token)) return `Numpad${token.slice(-1)}`;
  if (/^F\d{1,2}$/i.test(token)) return token.toUpperCase();

  const aliased = keyAliases.get(token);
  if (aliased) return aliased;
  if (/^\d$/.test(token)) return token;
  if (/^[a-z]$/i.test(token)) return token.toUpperCase();

  return token;
}

function orderHotkeyTokens(tokens: string[]): string[] {
  const modifierTokens = bindingModifierOrder.filter((modifier) => tokens.includes(modifier));
  const keyTokens = tokens.filter((token) => !isModifierKeyToken(token));

  return [...modifierTokens, ...keyTokens];
}

function formatKeyDisplay(key: string): string {
  if (key === "Space") return "Space";
  if (key === "ArrowUp") return "↑";
  if (key === "ArrowDown") return "↓";
  if (key === "ArrowLeft") return "←";
  if (key === "ArrowRight") return "→";
  if (key.startsWith("Numpad")) return key.replace("Numpad", "Num ");
  return key.replace(/^Key/, "").replace(/^Digit/, "");
}

export function profilesWithBindings(profiles: WorkspaceProfile[]): WorkspaceProfile[] {
  return profiles.map((profile) => ({
    ...profile,
    hotkeyBinding: normalizeHotkeyBinding(profile.hotkeyBinding || profile.hotkey),
    hotkey: formatHotkeyDisplay(profile.hotkeyBinding || profile.hotkey),
  }));
}

export function isHotkeyAvailable(
  profiles: WorkspaceProfile[],
  hotkey: string,
  currentProfileId?: string,
): boolean {
  const binding = normalizeHotkeyBinding(hotkey);
  if (!binding) return true;

  return !profiles.some(
    (profile) =>
      profile.id !== currentProfileId &&
      normalizeHotkeyBinding(profile.hotkeyBinding || profile.hotkey) === binding,
  );
}

export function nextAvailableHotkey(profiles: WorkspaceProfile[]): {
  hotkey: string;
  hotkeyBinding: string;
} {
  const used = new Set(
    profiles.map((profile) => normalizeHotkeyBinding(profile.hotkeyBinding || profile.hotkey)),
  );
  const hotkey = defaultHotkeys.find((candidate) => !used.has(normalizeHotkeyBinding(candidate))) ?? "";

  return {
    hotkey: formatHotkeyDisplay(hotkey),
    hotkeyBinding: normalizeHotkeyBinding(hotkey),
  };
}

export function ensureUniqueProfileHotkeys(profiles: WorkspaceProfile[]): WorkspaceProfile[] {
  const used = new Set<string>();
  const normalizedProfiles = profilesWithBindings(profiles);

  return normalizedProfiles.map((profile) => {
    const binding = normalizeHotkeyBinding(profile.hotkeyBinding || profile.hotkey);
    if (binding && !used.has(binding)) {
      used.add(binding);
      return { ...profile, hotkeyBinding: binding };
    }

    const replacementHotkey =
      defaultHotkeys.find((candidate) => !used.has(normalizeHotkeyBinding(candidate))) ?? "";
    const replacement = {
      hotkey: replacementHotkey,
      hotkeyBinding: normalizeHotkeyBinding(replacementHotkey),
    };
    if (replacement.hotkeyBinding) used.add(replacement.hotkeyBinding);

    return {
      ...profile,
      hotkey: replacement.hotkey || formatHotkeyDisplay(profile.hotkey),
      hotkeyBinding: replacement.hotkeyBinding,
    };
  });
}
