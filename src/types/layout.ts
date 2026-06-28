export type LaunchBehavior = "launch" | "skip";

export type StackMode = "none" | "horizontal" | "vertical" | "diagonal";

export type WindowOrderPolicy = "front-to-back";

export type PermissionStatus = "unknown" | "granted" | "missing";

export type AppIconId = "display" | "tiles" | "layers" | "focus";

export interface RelativeFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DisplayIdentity {
  id: string;
  name: string;
  vendorId?: number;
  productId?: number;
  serialNumber?: number;
  isBuiltIn: boolean;
}

export interface DisplayDescriptor {
  identity: DisplayIdentity;
  frame: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  nativeFrame: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  scaleFactor: number;
}

export interface WindowPlacement {
  id: string;
  appRuleId: string;
  displayId: string;
  orderIndex: number;
  title: string;
  relativeFrame: RelativeFrame;
}

export interface StackPolicy {
  mode: StackMode;
  offsetPercent: number;
}

export interface AppRule {
  id: string;
  appName: string;
  bundleIdentifier: string;
  launchBehavior: LaunchBehavior;
  windowOrderPolicy: WindowOrderPolicy;
  stackPolicy: StackPolicy;
  placements: WindowPlacement[];
}

export interface WorkspaceProfile {
  id: string;
  name: string;
  hotkey: string;
  hotkeyBinding: string;
  displaySetSignature: string;
  appRules: AppRule[];
  updatedAt: string;
}

export interface AppConfig {
  version: number;
  profiles: WorkspaceProfile[];
  appIconId: AppIconId;
  hideDockWhenMinimized: boolean;
  snapToGrid: boolean;
}

export interface RuntimeSnapshot {
  displays: DisplayDescriptor[];
  displaySetSignature: string;
  accessibility: PermissionStatus;
  appIdentity: AppIdentity;
}

export interface AppIdentity {
  bundleIdentifier: string;
  bundlePath: string;
  executablePath: string;
}

export interface WindowSource {
  id: string;
  title: string;
  displayId: string;
  orderIndex: number;
  relativeFrame: RelativeFrame;
}

export interface AppSource {
  id: string;
  appName: string;
  bundleIdentifier: string;
  windowCount: number;
  windows: WindowSource[];
}
