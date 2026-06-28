import { useEffect, useMemo, useState } from "react";
import type { AppRule, AppSource, RelativeFrame, RuntimeSnapshot, WorkspaceProfile } from "./types/layout";
import { DisplayCanvas } from "./components/DisplayCanvas";
import { Inspector } from "./components/Inspector";
import { PermissionGate } from "./components/PermissionGate";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import {
  applyWorkspaceProfile,
  getRuntimeSnapshot,
  loadAppConfig,
  listWindowSources,
  minimizeMainWindow,
  openAccessibilitySettings,
  registerProfileShortcuts,
  revealCurrentAppInFinder,
  requestAccessibilityPermission,
  saveAppConfig,
} from "./lib/tauri";
import { createAppConfig, loadLocalConfig, saveLocalConfig } from "./lib/storage";
import { mockRuntime } from "./lib/mockData";
import {
  ensureUniqueProfileHotkeys,
  isHotkeyAvailable,
  nextAvailableHotkey,
  normalizeHotkeyBinding,
} from "./lib/hotkeys";
import type { AppIconId } from "./types/layout";
import type { DisplayDescriptor } from "./types/layout";

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function configFingerprint(
  profiles: WorkspaceProfile[],
  appIconId: AppIconId,
  hideDockWhenMinimized: boolean,
  snapToGrid: boolean,
) {
  return JSON.stringify(createAppConfig(profiles, appIconId, hideDockWhenMinimized, snapToGrid));
}

function createProfile(displaySetSignature: string, profiles: WorkspaceProfile[]): WorkspaceProfile {
  const hotkey = nextAvailableHotkey(profiles);

  return {
    id: makeId("profile"),
    name: "New Layout",
    hotkey: hotkey.hotkey,
    hotkeyBinding: hotkey.hotkeyBinding,
    displaySetSignature,
    updatedAt: new Date().toISOString(),
    appRules: [],
  };
}

function updatePlacementFrame(
  profile: WorkspaceProfile,
  placementId: string,
  frame: RelativeFrame,
): WorkspaceProfile {
  return {
    ...profile,
    updatedAt: new Date().toISOString(),
    appRules: profile.appRules.map((rule) => ({
      ...rule,
      placements: rule.placements.map((placement) =>
        placement.id === placementId ? { ...placement, relativeFrame: frame } : placement,
      ),
    })),
  };
}

function updateRule(profile: WorkspaceProfile, nextRule: AppRule): WorkspaceProfile {
  return {
    ...profile,
    updatedAt: new Date().toISOString(),
    appRules: profile.appRules.map((rule) => (rule.id === nextRule.id ? nextRule : rule)),
  };
}

function appRuleKey(value: string) {
  return value.trim().toLowerCase();
}

function sourceMatchesRule(source: AppSource, rule: AppRule) {
  return (
    appRuleKey(source.bundleIdentifier) === appRuleKey(rule.bundleIdentifier) ||
    appRuleKey(source.appName) === appRuleKey(rule.appName)
  );
}

function reorderAppRule(
  profile: WorkspaceProfile,
  draggedRuleId: string,
  targetRuleId: string,
  position: "before" | "after",
): WorkspaceProfile {
  if (draggedRuleId === targetRuleId) return profile;

  const draggedRule = profile.appRules.find((rule) => rule.id === draggedRuleId);
  if (!draggedRule) return profile;

  const remainingRules = profile.appRules.filter((rule) => rule.id !== draggedRuleId);
  const targetIndex = remainingRules.findIndex((rule) => rule.id === targetRuleId);
  if (targetIndex === -1) return profile;

  const insertIndex = position === "after" ? targetIndex + 1 : targetIndex;
  const appRules = [...remainingRules];
  appRules.splice(insertIndex, 0, draggedRule);

  return {
    ...profile,
    updatedAt: new Date().toISOString(),
    appRules,
  };
}

function applyStack(rule: AppRule): AppRule {
  if (rule.stackPolicy.mode === "none" || rule.placements.length < 2) {
    return rule;
  }

  const [base, ...rest] = rule.placements;
  const offset = rule.stackPolicy.offsetPercent / 100;

  return {
    ...rule,
    placements: [
      base,
      ...rest.map((placement, index) => {
        const multiplier = index + 1;
        const dx =
          rule.stackPolicy.mode === "horizontal" || rule.stackPolicy.mode === "diagonal"
            ? base.relativeFrame.width * offset * multiplier
            : 0;
        const dy =
          rule.stackPolicy.mode === "vertical" || rule.stackPolicy.mode === "diagonal"
            ? base.relativeFrame.height * offset * multiplier
            : 0;

        return {
          ...placement,
          displayId: base.displayId,
          relativeFrame: {
            ...base.relativeFrame,
            x: Math.min(base.relativeFrame.x + dx, 1 - base.relativeFrame.width),
            y: Math.min(base.relativeFrame.y + dy, 1 - base.relativeFrame.height),
          },
        };
      }),
    ],
  };
}

function mirrorTrackedApps(
  profile: WorkspaceProfile,
  sources: AppSource[],
  displaySetSignature: string,
  activeDisplayId?: string | null,
): { profile: WorkspaceProfile; mirroredApps: number; mirroredWindows: number } {
  let mirroredApps = 0;
  let mirroredWindows = 0;

  const mirroredRules = new Map<string, AppRule>();
  const visibleRuleIds: string[] = [];

  for (const source of sources) {
    const rule = profile.appRules.find(
      (item) => !visibleRuleIds.includes(item.id) && sourceMatchesRule(source, item),
    );
    const sourceWindows = activeDisplayId
      ? source.windows.filter((window) => window.displayId === activeDisplayId)
      : source.windows;

    if (!rule || sourceWindows.length === 0) continue;

    mirroredApps += 1;
    mirroredWindows += sourceWindows.length;

    visibleRuleIds.push(rule.id);
    const existingDisplayPlacements = activeDisplayId
      ? rule.placements.filter((placement) => placement.displayId === activeDisplayId)
      : rule.placements;
    const retainedPlacements = activeDisplayId
      ? rule.placements.filter((placement) => placement.displayId !== activeDisplayId)
      : [];
    const mirroredPlacements = sourceWindows.map((window, index) => ({
      id: existingDisplayPlacements[index]?.id ?? makeId("window"),
      appRuleId: rule.id,
      displayId: window.displayId,
      orderIndex: retainedPlacements.length + index,
      title: window.title || `${rule.appName} Window ${index + 1}`,
      relativeFrame: window.relativeFrame,
    }));

    mirroredRules.set(rule.id, {
      ...rule,
      placements: [...retainedPlacements, ...mirroredPlacements].map((placement, index) => ({
        ...placement,
        orderIndex: index,
      })),
    });
  }

  const visibleRules = visibleRuleIds
    .map((ruleId) => mirroredRules.get(ruleId))
    .filter((rule): rule is AppRule => Boolean(rule));
  const remainingRules = profile.appRules.filter((rule) => !visibleRuleIds.includes(rule.id));
  const appRules = [...visibleRules, ...remainingRules];

  return {
    mirroredApps,
    mirroredWindows,
    profile: {
      ...profile,
      displaySetSignature,
      updatedAt: new Date().toISOString(),
      appRules,
    },
  };
}

function resolveDisplayId(
  previousDisplayId: string,
  displays: DisplayDescriptor[],
  fallbackIndex: number,
) {
  if (displays.some((display) => display.identity.id === previousDisplayId)) {
    return previousDisplayId;
  }

  const normalized = previousDisplayId.toLowerCase();
  const directionalMatch = ["left", "right", "top", "bottom", "middle"].find((token) =>
    normalized.includes(token),
  );
  if (directionalMatch) {
    const display = displays.find(
      (item) =>
        item.identity.id.includes(directionalMatch) ||
        item.identity.name.toLowerCase().includes(directionalMatch),
    );
    if (display) return display.identity.id;
  }

  if (displays.length === 2) {
    const leftDisplay = displays.find((display) => display.identity.id.includes("left"));
    const rightDisplay = displays.find((display) => display.identity.id.includes("right"));
    const legacyNumber = normalized.match(/(?:^|[-\\s])([12])(?:[-\\s]|$)/)?.[1];

    if (legacyNumber === "2" && leftDisplay) return leftDisplay.identity.id;
    if (legacyNumber === "1" && rightDisplay) return rightDisplay.identity.id;
  }

  return displays[fallbackIndex % displays.length]?.identity.id ?? displays[0]?.identity.id ?? "";
}

function reconcileProfileDisplays(
  profile: WorkspaceProfile,
  runtime: RuntimeSnapshot,
): WorkspaceProfile {
  const displayIds = runtime.displays.map((display) => display.identity.id);
  if (displayIds.length === 0) return profile;

  let changed = profile.displaySetSignature !== runtime.displaySetSignature;

  const appRules = profile.appRules.map((rule) => ({
    ...rule,
    placements: rule.placements.map((placement, index) => {
      const displayId = resolveDisplayId(placement.displayId, runtime.displays, index);
      if (placement.displayId === displayId) return placement;

      changed = true;
      return {
        ...placement,
        displayId,
      };
    }),
  }));

  if (!changed) return profile;

  return {
    ...profile,
    displaySetSignature: runtime.displaySetSignature,
    updatedAt: new Date().toISOString(),
    appRules,
  };
}

export default function App() {
  const initialConfig = useMemo(() => loadLocalConfig(), []);
  const [runtime, setRuntime] = useState<RuntimeSnapshot>(mockRuntime);
  const [profiles, setProfiles] = useState<WorkspaceProfile[]>(() => initialConfig.profiles);
  const [appIconId, setAppIconId] = useState<AppIconId>(initialConfig.appIconId);
  const [hideDockWhenMinimized, setHideDockWhenMinimized] = useState(
    initialConfig.hideDockWhenMinimized,
  );
  const [snapToGrid, setSnapToGrid] = useState(initialConfig.snapToGrid);
  const [savedConfigFingerprint, setSavedConfigFingerprint] = useState(() =>
    configFingerprint(
      initialConfig.profiles,
      initialConfig.appIconId,
      initialConfig.hideDockWhenMinimized,
      initialConfig.snapToGrid,
    ),
  );
  const [shortcutFailures, setShortcutFailures] = useState<string[]>([]);
  const [activeProfileId, setActiveProfileId] = useState(initialConfig.profiles[0]?.id ?? "");
  const [appSources, setAppSources] = useState<AppSource[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(
    profiles[0]?.appRules[0]?.placements[0]?.id ?? null,
  );
  const [activeDisplayId, setActiveDisplayId] = useState(
    profiles[0]?.appRules[0]?.placements[0]?.displayId ?? mockRuntime.displays[0]?.identity.id ?? "",
  );

  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0],
    [activeProfileId, profiles],
  );
  const currentConfigFingerprint = useMemo(
    () => configFingerprint(profiles, appIconId, hideDockWhenMinimized, snapToGrid),
    [appIconId, hideDockWhenMinimized, profiles, snapToGrid],
  );
  const hasUnsavedChanges = currentConfigFingerprint !== savedConfigFingerprint;
  const activeDisplay = runtime.displays.find((display) => display.identity.id === activeDisplayId);
  const activeDisplayName = activeDisplay?.identity.name ?? "display";

  useEffect(() => {
    getRuntimeSnapshot().then(setRuntime);
    listWindowSources().then(setAppSources);

    loadAppConfig().then((config) => {
      if (config) {
        const hydratedConfig = createAppConfig(
          config.profiles,
          config.appIconId,
          config.hideDockWhenMinimized,
          config.snapToGrid,
        );
        const nextProfiles = hydratedConfig.profiles;
        setProfiles(nextProfiles);
        setAppIconId(hydratedConfig.appIconId);
        setHideDockWhenMinimized(hydratedConfig.hideDockWhenMinimized);
        setSnapToGrid(hydratedConfig.snapToGrid);
        setSavedConfigFingerprint(
          configFingerprint(
            nextProfiles,
            hydratedConfig.appIconId,
            hydratedConfig.hideDockWhenMinimized,
            hydratedConfig.snapToGrid,
          ),
        );
        setActiveProfileId((current) =>
          nextProfiles.some((profile) => profile.id === current)
            ? current
            : (nextProfiles[0]?.id ?? ""),
        );
        const nextPlacement = nextProfiles[0]?.appRules[0]?.placements[0] ?? null;
        setSelectedPlacementId(nextPlacement?.id ?? null);
        setActiveDisplayId(nextPlacement?.displayId ?? runtime.displays[0]?.identity.id ?? "");
      }
    });
  }, []);

  useEffect(() => {
    if (runtime.displays.length === 0) return;

    setProfiles((current) =>
      current.map((profile) => reconcileProfileDisplays(profile, runtime)),
    );
    setActiveDisplayId((current) =>
      runtime.displays.some((display) => display.identity.id === current)
        ? current
        : (runtime.displays[0]?.identity.id ?? ""),
    );
  }, [runtime]);

  useEffect(() => {
    // Hand the profiles to the Rust backend, which both registers the OS-level
    // global shortcuts and applies the matching layout directly when triggered.
    // Keeping the trigger path in Rust avoids a webview IPC round-trip, so the
    // window repositioning starts with noticeably lower latency.
    registerProfileShortcuts(ensureUniqueProfileHotkeys(profiles)).then((failures) => {
      setShortcutFailures(failures);
      if (failures.length > 0) {
        setStatusMessage(`Shortcut unavailable: ${failures.join(", ")}`);
      }
    });
  }, [profiles]);

  function replaceActiveProfile(nextProfile: WorkspaceProfile) {
    setProfiles((current) =>
      current.map((profile) => (profile.id === nextProfile.id ? nextProfile : profile)),
    );
  }

  async function refreshRuntime() {
    const nextRuntime = await getRuntimeSnapshot();
    setRuntime(nextRuntime);
    return nextRuntime;
  }

  function handleUpdatePlacement(placementId: string, frame: RelativeFrame) {
    replaceActiveProfile(updatePlacementFrame(activeProfile, placementId, frame));
  }

  function handleSelectPlacement(placementId: string) {
    setSelectedPlacementId(placementId);
    const placement = activeProfile.appRules
      .flatMap((rule) => rule.placements)
      .find((item) => item.id === placementId);
    if (placement) setActiveDisplayId(placement.displayId);
  }

  function handleUpdateRule(rule: AppRule) {
    replaceActiveProfile(updateRule(activeProfile, applyStack(rule)));
  }

  function handleAppIconChange(nextIconId: AppIconId) {
    setAppIconId(nextIconId);
    setStatusMessage("Updated app icon style.");
  }

  async function handleSaveLayout() {
    const config = createAppConfig(profiles, appIconId, hideDockWhenMinimized, snapToGrid);
    saveLocalConfig(config);
    await saveAppConfig(config);
    setSavedConfigFingerprint(
      configFingerprint(
        config.profiles,
        config.appIconId,
        config.hideDockWhenMinimized,
        config.snapToGrid,
      ),
    );
    setStatusMessage(`Saved ${activeProfile.name} locally.`);
  }

  async function handleMinimizeApp() {
    await minimizeMainWindow(hideDockWhenMinimized);
  }

  function handleReorderAppRule(
    draggedRuleId: string,
    targetRuleId: string,
    position: "before" | "after",
  ) {
    replaceActiveProfile(reorderAppRule(activeProfile, draggedRuleId, targetRuleId, position));
    setStatusMessage("Updated front-to-back layer order.");
  }

  function handleMovePlacementToDisplay(placementId: string, displayId: string) {
    const nextProfile: WorkspaceProfile = {
      ...activeProfile,
      updatedAt: new Date().toISOString(),
      appRules: activeProfile.appRules.map((rule) => ({
        ...rule,
        placements: rule.placements.map((placement) =>
          placement.id === placementId ? { ...placement, displayId } : placement,
        ),
      })),
    };

    replaceActiveProfile(nextProfile);
    setActiveDisplayId(displayId);
  }

  function handleAddAppSource(source: AppSource) {
    const fallbackDisplayId = runtime.displays[0]?.identity.id ?? "";
    const existingRule = activeProfile.appRules.find(
      (rule) => rule.bundleIdentifier === source.bundleIdentifier,
    );

    if (existingRule) {
      const existingDisplayIds = new Set(
        existingRule.placements.map((placement) => placement.displayId),
      );
      const nextPlacements = source.windows
        .filter((window) => !existingDisplayIds.has(window.displayId))
        .map((window, index) => ({
          id: makeId("window"),
          appRuleId: existingRule.id,
          displayId: window.displayId,
          orderIndex: existingRule.placements.length + index,
          title: window.title,
          relativeFrame: window.relativeFrame,
        }));

      if (nextPlacements.length === 0) {
        setStatusMessage(`${source.appName} is already in this display group.`);
        return;
      }

      replaceActiveProfile(
        updateRule(activeProfile, {
          ...existingRule,
          placements: [...existingRule.placements, ...nextPlacements],
        }),
      );
      setSelectedPlacementId(nextPlacements[0]?.id ?? null);
      setStatusMessage(`Added ${source.appName} windows from this display.`);
      return;
    }

    const ruleId = makeId("app");
    const placements =
      source.windows.length > 0
        ? source.windows.map((window, index) => ({
            id: makeId("window"),
            appRuleId: ruleId,
            displayId: window.displayId,
            orderIndex: index,
            title: window.title,
            relativeFrame: window.relativeFrame,
          }))
        : [
            {
              id: makeId("window"),
              appRuleId: ruleId,
              displayId: fallbackDisplayId,
              orderIndex: 0,
              title: `${source.appName} Window 1`,
              relativeFrame: { x: 0.08, y: 0.08, width: 0.84, height: 0.84 },
            },
          ];

    const nextRule: AppRule = {
      id: ruleId,
      appName: source.appName,
      bundleIdentifier: source.bundleIdentifier,
      launchBehavior: "skip",
      windowOrderPolicy: "front-to-back",
      stackPolicy: { mode: "none", offsetPercent: 0 },
      placements,
    };

    replaceActiveProfile({
      ...activeProfile,
      updatedAt: new Date().toISOString(),
      appRules: [...activeProfile.appRules, nextRule],
    });
    setSelectedPlacementId(placements[0]?.id ?? null);
    setStatusMessage(`Added ${source.appName}. Mirror will refresh its current frames.`);
  }

  function handleAddWindow(ruleId: string) {
    const rule = activeProfile.appRules.find((item) => item.id === ruleId);
    const lastPlacement = rule?.placements[rule.placements.length - 1];
    if (!rule || !lastPlacement) return;

    const nextRule: AppRule = applyStack({
      ...rule,
      placements: [
        ...rule.placements,
        {
          ...lastPlacement,
          id: makeId("window"),
          orderIndex: rule.placements.length,
          title: `${rule.appName} Window ${rule.placements.length + 1}`,
        },
      ],
    });

    replaceActiveProfile(updateRule(activeProfile, nextRule));
  }

  function handleDeletePlacement(placementId: string) {
    const nextProfile: WorkspaceProfile = {
      ...activeProfile,
      appRules: activeProfile.appRules.map((rule) => ({
        ...rule,
        placements: rule.placements
          .filter((placement) => placement.id !== placementId)
          .map((placement, index) => ({ ...placement, orderIndex: index })),
      })),
    };

    replaceActiveProfile(nextProfile);
    setSelectedPlacementId(nextProfile.appRules.flatMap((rule) => rule.placements)[0]?.id ?? null);
  }

  function handleDeleteAppRule(ruleId: string) {
    const nextProfile: WorkspaceProfile = {
      ...activeProfile,
      updatedAt: new Date().toISOString(),
      appRules: activeProfile.appRules.filter((rule) => rule.id !== ruleId),
    };

    replaceActiveProfile(nextProfile);
    setSelectedPlacementId(nextProfile.appRules.flatMap((rule) => rule.placements)[0]?.id ?? null);
  }

  async function handleMirror() {
    if (runtime.accessibility === "missing") {
      setStatusMessage("Grant Accessibility before mirroring current positions.");
      return;
    }

    if (activeProfile.appRules.length === 0) {
      setStatusMessage("Add apps to this layout before mirroring.");
      return;
    }

    const sources = await listWindowSources();
    setAppSources(sources);
    const mirrorDisplayId = activeDisplayId || runtime.displays[0]?.identity.id || null;
    const mirrorDisplayName =
      runtime.displays.find((display) => display.identity.id === mirrorDisplayId)?.identity.name ??
      "active display";
    const mirrored = mirrorTrackedApps(
      activeProfile,
      sources,
      runtime.displaySetSignature,
      mirrorDisplayId,
    );
    replaceActiveProfile(mirrored.profile);
    setSelectedPlacementId(
      mirrored.profile.appRules
        .flatMap((rule) => rule.placements)
        .find((placement) => placement.displayId === mirrorDisplayId)?.id ??
        mirrored.profile.appRules.flatMap((rule) => rule.placements)[0]?.id ??
        null,
    );

    if (mirrored.mirroredWindows === 0) {
      setStatusMessage(`No tracked app windows are visible on ${mirrorDisplayName}.`);
    } else {
      setStatusMessage(
        `Mirrored ${mirrored.mirroredWindows} windows from ${mirrored.mirroredApps} tracked apps on ${mirrorDisplayName}.`,
      );
    }
  }

  async function handleApply() {
    if (runtime.accessibility === "missing") {
      setStatusMessage("Grant Accessibility before applying layouts.");
      return;
    }

    await applyWorkspaceProfile(activeProfile);
    setStatusMessage(`Applied ${activeProfile.name}.`);
  }

  async function handleRefreshAppSources() {
    const sources = await listWindowSources();
    setAppSources(sources);
    const windowCount = sources.reduce((sum, source) => sum + source.windowCount, 0);
    setStatusMessage(`Found ${sources.length} running apps with ${windowCount} visible windows.`);
  }

  if (!activeProfile) {
    return null;
  }

  if (runtime.accessibility === "missing") {
    return (
      <PermissionGate
        runtime={runtime}
        onOpenSettings={openAccessibilitySettings}
        onRevealCurrentApp={revealCurrentAppInFinder}
        onRequestPermission={async () => {
          await requestAccessibilityPermission();
          await refreshRuntime();
        }}
        onRefresh={refreshRuntime}
      />
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        profiles={profiles}
        activeProfileId={activeProfile.id}
        runtime={runtime}
        onSelectProfile={(profileId) => {
          const nextProfile = profiles.find((profile) => profile.id === profileId);
          const nextPlacement = nextProfile?.appRules[0]?.placements[0] ?? null;
          setActiveProfileId(profileId);
          setSelectedPlacementId(nextPlacement?.id ?? null);
          setActiveDisplayId(nextPlacement?.displayId ?? runtime.displays[0]?.identity.id ?? "");
        }}
        onCreateProfile={() => {
          const nextProfile = createProfile(runtime.displaySetSignature, profiles);
          setProfiles((current) => [nextProfile, ...current]);
          setActiveProfileId(nextProfile.id);
          setSelectedPlacementId(null);
          setActiveDisplayId(runtime.displays[0]?.identity.id ?? "");
        }}
        appIconId={appIconId}
        snapToGrid={snapToGrid}
        onAppIconChange={handleAppIconChange}
        onSnapToGridChange={setSnapToGrid}
      />

      <section className="workspace">
        <TopBar
          profile={activeProfile}
          accessibility={runtime.accessibility}
          onNameChange={(name) => replaceActiveProfile({ ...activeProfile, name })}
          onHotkeyChange={(hotkey) => {
            if (!isHotkeyAvailable(profiles, hotkey, activeProfile.id)) {
              setStatusMessage("That hotkey is already used by another layout.");
              return;
            }

            replaceActiveProfile({
              ...activeProfile,
              hotkey,
              hotkeyBinding: normalizeHotkeyBinding(hotkey),
            });
          }}
          onMirror={handleMirror}
          mirrorDisplayName={activeDisplayName}
          onSave={handleSaveLayout}
          onApply={handleApply}
          hasUnsavedChanges={hasUnsavedChanges}
          shortcutFailures={shortcutFailures}
          statusMessage={statusMessage}
        />

        <div className="workspace-body">
          <DisplayCanvas
            profile={activeProfile}
            displays={runtime.displays}
            selectedPlacementId={selectedPlacementId}
            activeDisplayId={activeDisplayId}
            snapToGrid={snapToGrid}
            onSelectPlacement={handleSelectPlacement}
            onActivateDisplay={setActiveDisplayId}
            onUpdatePlacement={handleUpdatePlacement}
          />
          <Inspector
            profile={activeProfile}
            displays={runtime.displays}
            selectedPlacementId={selectedPlacementId}
            onUpdateAppRule={handleUpdateRule}
            onUpdatePlacement={handleUpdatePlacement}
            onSelectPlacement={handleSelectPlacement}
            onAddWindow={handleAddWindow}
            onDeletePlacement={handleDeletePlacement}
            onDeleteAppRule={handleDeleteAppRule}
            onReorderAppRule={handleReorderAppRule}
            onMovePlacementToDisplay={handleMovePlacementToDisplay}
            hideDockWhenMinimized={hideDockWhenMinimized}
            onHideDockWhenMinimizedChange={setHideDockWhenMinimized}
            onMinimizeApp={handleMinimizeApp}
            appSources={appSources}
            onRefreshAppSources={handleRefreshAppSources}
            onAddAppSource={handleAddAppSource}
          />
        </div>
      </section>
    </div>
  );
}
