import type { AppSource, RuntimeSnapshot, WorkspaceProfile } from "../types/layout";

export const mockRuntime: RuntimeSnapshot = {
  displaySetSignature: "builtin-retina__studio-display",
  accessibility: "unknown",
  appIdentity: {
    bundleIdentifier: "app.workneat.desktop",
    bundlePath: "/Applications/WorkNeat.app",
    executablePath: "/Applications/WorkNeat.app/Contents/MacOS/workneat",
  },
  displays: [
    {
      identity: {
        id: "builtin-retina",
        name: "MacBook Pro",
        isBuiltIn: true,
      },
      frame: { x: 0, y: 220, width: 1512, height: 982 },
      nativeFrame: { x: 0, y: 440, width: 3024, height: 1964 },
      scaleFactor: 2,
    },
    {
      identity: {
        id: "studio-display",
        name: "Studio Display",
        vendorId: 1552,
        productId: 41037,
        serialNumber: 100001,
        isBuiltIn: false,
      },
      frame: { x: 1512, y: 0, width: 2560, height: 1440 },
      nativeFrame: { x: 3024, y: 0, width: 5120, height: 2880 },
      scaleFactor: 2,
    },
  ],
};

export const starterProfile: WorkspaceProfile = {
  id: "office-focus",
  name: "Office Focus",
  hotkey: "⌥⌘1",
  hotkeyBinding: "Alt+Command+Digit1",
  displaySetSignature: mockRuntime.displaySetSignature,
  updatedAt: new Date().toISOString(),
  appRules: [
    {
      id: "arc-rule",
      appName: "Arc",
      bundleIdentifier: "company.thebrowser.Browser",
      launchBehavior: "launch",
      windowOrderPolicy: "front-to-back",
      stackPolicy: {
        mode: "horizontal",
        offsetPercent: 8,
      },
      placements: [
        {
          id: "arc-window-1",
          appRuleId: "arc-rule",
          displayId: "studio-display",
          orderIndex: 0,
          title: "Arc Window 1",
          relativeFrame: { x: 0.04, y: 0.07, width: 0.44, height: 0.86 },
        },
        {
          id: "arc-window-2",
          appRuleId: "arc-rule",
          displayId: "studio-display",
          orderIndex: 1,
          title: "Arc Window 2",
          relativeFrame: { x: 0.075, y: 0.07, width: 0.44, height: 0.86 },
        },
      ],
    },
    {
      id: "cursor-rule",
      appName: "Cursor",
      bundleIdentifier: "com.todesktop.230313mzl4w4u92",
      launchBehavior: "launch",
      windowOrderPolicy: "front-to-back",
      stackPolicy: {
        mode: "none",
        offsetPercent: 0,
      },
      placements: [
        {
          id: "cursor-window-1",
          appRuleId: "cursor-rule",
          displayId: "studio-display",
          orderIndex: 0,
          title: "Cursor Window 1",
          relativeFrame: { x: 0.52, y: 0.07, width: 0.44, height: 0.86 },
        },
      ],
    },
    {
      id: "notion-rule",
      appName: "Notion",
      bundleIdentifier: "notion.id",
      launchBehavior: "skip",
      windowOrderPolicy: "front-to-back",
      stackPolicy: {
        mode: "diagonal",
        offsetPercent: 6,
      },
      placements: [
        {
          id: "notion-window-1",
          appRuleId: "notion-rule",
          displayId: "builtin-retina",
          orderIndex: 0,
          title: "Notion Window 1",
          relativeFrame: { x: 0.08, y: 0.1, width: 0.84, height: 0.8 },
        },
      ],
    },
  ],
};

export const mockAppSources: AppSource[] = starterProfile.appRules.map((rule) => ({
  id: rule.bundleIdentifier,
  appName: rule.appName,
  bundleIdentifier: rule.bundleIdentifier,
  windowCount: rule.placements.length,
  windows: rule.placements.map((placement) => ({
    id: placement.id,
    title: placement.title,
    displayId: placement.displayId,
    orderIndex: placement.orderIndex,
    relativeFrame: placement.relativeFrame,
  })),
}));
