import {
  Button,
  Divider,
  Input,
  Select,
  SelectItem,
  Slider,
  Switch,
  Tabs,
  Tab,
} from "./heroui";
import { useState } from "react";
import { AppWindow, CopyPlus, GripVertical, Layers, RefreshCcw, Trash2 } from "lucide-react";
import type {
  AppRule,
  AppSource,
  DisplayDescriptor,
  LaunchBehavior,
  RelativeFrame,
  StackMode,
  WorkspaceProfile,
} from "../types/layout";

interface InspectorProps {
  profile: WorkspaceProfile;
  displays: DisplayDescriptor[];
  selectedPlacementId: string | null;
  onUpdateAppRule: (rule: AppRule) => void;
  onUpdatePlacement: (placementId: string, frame: RelativeFrame) => void;
  onSelectPlacement: (placementId: string) => void;
  onAddWindow: (ruleId: string) => void;
  onDeleteAppRule: (ruleId: string) => void;
  onDeletePlacement: (placementId: string) => void;
  onReorderAppRule: (
    draggedRuleId: string,
    targetRuleId: string,
    position: "before" | "after",
  ) => void;
  onMovePlacementToDisplay: (placementId: string, displayId: string) => void;
  hideDockWhenMinimized: boolean;
  onHideDockWhenMinimizedChange: (enabled: boolean) => void;
  onMinimizeApp: () => void;
  appSources: AppSource[];
  onRefreshAppSources: () => void;
  onAddAppSource: (source: AppSource) => void;
}

const stackModes: Array<{ id: StackMode; label: string }> = [
  { id: "none", label: "None" },
  { id: "horizontal", label: "Horizontal" },
  { id: "vertical", label: "Vertical" },
  { id: "diagonal", label: "Diagonal" },
];

function sourceForDisplay(source: AppSource, display: DisplayDescriptor): AppSource | null {
  const windows = source.windows.filter((window) => window.displayId === display.identity.id);
  if (windows.length === 0) return null;

  return {
    ...source,
    id: `${source.id}-${display.identity.id}`,
    windowCount: windows.length,
    windows,
  };
}

function appKey(value: string) {
  return value.trim().toLowerCase();
}

export function Inspector({
  profile,
  displays,
  selectedPlacementId,
  onUpdateAppRule,
  onUpdatePlacement,
  onSelectPlacement,
  onAddWindow,
  onDeleteAppRule,
  onDeletePlacement,
  onReorderAppRule,
  onMovePlacementToDisplay,
  hideDockWhenMinimized,
  onHideDockWhenMinimizedChange,
  onMinimizeApp,
  appSources,
  onRefreshAppSources,
  onAddAppSource,
}: InspectorProps) {
  const [draggedRuleId, setDraggedRuleId] = useState<string | null>(null);
  const placements = profile.appRules.flatMap((rule) => rule.placements);
  const selectedPlacement =
    placements.find((placement) => placement.id === selectedPlacementId) ?? placements[0] ?? null;
  const selectedRule = selectedPlacement
    ? profile.appRules.find((rule) => rule.id === selectedPlacement.appRuleId) ?? null
    : null;
  const trackedAppKeys = new Set(
    profile.appRules.flatMap((rule) => [
      appKey(rule.bundleIdentifier),
      appKey(rule.appName),
    ]),
  );

  return (
    <aside className="inspector">
      <Tabs size="sm" radius="sm" aria-label="Inspector tabs">
        <Tab key="apps" title="Apps">
          <div className="inspector-section">
            <div className="section-heading compact">
              <span>Tracked Apps</span>
              <span>{profile.appRules.length} apps</span>
            </div>

            {profile.appRules.length === 0 ? (
              <div className="source-empty">Add running apps below to start tracking a layout</div>
            ) : (
              profile.appRules.map((rule, index) => (
                <div
                  className={`app-rule ${draggedRuleId === rule.id ? "dragging" : ""}`}
                  data-rule-id={rule.id}
                  key={rule.id}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const sourceRuleId =
                      draggedRuleId || event.dataTransfer.getData("text/plain");
                    if (!sourceRuleId || sourceRuleId === rule.id) return;

                    const rect = event.currentTarget.getBoundingClientRect();
                    const position =
                      event.clientY < rect.top + rect.height / 2 ? "before" : "after";
                    onReorderAppRule(sourceRuleId, rule.id, position);
                    setDraggedRuleId(null);
                  }}
                >
                  <div className="app-rule-top">
                    <span
                      aria-label={`Drag ${rule.appName} layer`}
                      className="drag-handle"
                      draggable
                      onClick={(event) => event.stopPropagation()}
                      onDragStart={(event) => {
                        setDraggedRuleId(rule.id);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", rule.id);
                      }}
                      onDragEnd={() => setDraggedRuleId(null)}
                      role="button"
                      title="Drag to reorder layer"
                    >
                      <GripVertical size={15} />
                    </span>
                    <button
                      className="app-rule-header"
                      onClick={() => {
                        const first = rule.placements[0];
                        if (first) onSelectPlacement(first.id);
                      }}
                    >
                      <span className="app-icon">
                        <AppWindow size={16} />
                      </span>
                      <span>
                        <strong>{rule.appName}</strong>
                        <em>{rule.placements.length} windows</em>
                      </span>
                    </button>
                  </div>
                  <div className="app-rule-actions">
                    <Switch
                      size="sm"
                      isSelected={rule.launchBehavior === "launch"}
                      onValueChange={(enabled) =>
                        onUpdateAppRule({
                          ...rule,
                          launchBehavior: (enabled ? "launch" : "skip") as LaunchBehavior,
                        })
                      }
                    >
                      Launch
                    </Switch>
                    <Button
                      isIconOnly
                      size="sm"
                      radius="sm"
                      variant="flat"
                      isDisabled={index === 0}
                      aria-label={`Move ${rule.appName} forward`}
                      onPress={() => {
                        const previousRule = profile.appRules[index - 1];
                        if (previousRule) onReorderAppRule(rule.id, previousRule.id, "before");
                      }}
                    >
                      ↑
                    </Button>
                    <Button
                      isIconOnly
                      size="sm"
                      radius="sm"
                      variant="flat"
                      isDisabled={index === profile.appRules.length - 1}
                      aria-label={`Move ${rule.appName} backward`}
                      onPress={() => {
                        const nextRule = profile.appRules[index + 1];
                        if (nextRule) onReorderAppRule(rule.id, nextRule.id, "after");
                      }}
                    >
                      ↓
                    </Button>
                    <Button
                      isIconOnly
                      size="sm"
                      radius="sm"
                      variant="flat"
                      aria-label={`Add ${rule.appName} window`}
                      onPress={() => onAddWindow(rule.id)}
                    >
                      <CopyPlus size={15} />
                    </Button>
                    <Button
                      isIconOnly
                      size="sm"
                      radius="sm"
                      color="danger"
                      variant="light"
                      aria-label={`Remove ${rule.appName}`}
                      onPress={() => onDeleteAppRule(rule.id)}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </div>
              ))
            )}

            <Divider />

            <div className="section-heading compact">
              <span>Available Apps</span>
              <Button
                isIconOnly
                size="sm"
                radius="sm"
                variant="flat"
                aria-label="Refresh running apps"
                onPress={onRefreshAppSources}
              >
                <RefreshCcw size={15} />
              </Button>
            </div>

            <div className="source-list">
              {displays.map((display) => {
                const displaySources = appSources
                  .map((source) => sourceForDisplay(source, display))
                  .filter((source): source is AppSource => Boolean(source))
                  .filter(
                    (source) =>
                      !trackedAppKeys.has(appKey(source.bundleIdentifier)) &&
                      !trackedAppKeys.has(appKey(source.appName)),
                  );

                return (
                  <section className="source-display-group" key={display.identity.id}>
                    <div className="source-display-title">
                      <strong>{display.identity.name}</strong>
                      <span>{displaySources.length} apps</span>
                    </div>

                    {displaySources.length === 0 ? (
                      <div className="source-empty">No untracked visible apps on this display</div>
                    ) : (
                      displaySources.map((source) => (
                        <div className="source-row" key={source.id}>
                          <span>
                            <strong>{source.appName}</strong>
                            <em>{source.windowCount} windows</em>
                          </span>
                          <Button
                            size="sm"
                            radius="sm"
                            variant="flat"
                            onPress={() => onAddAppSource(source)}
                          >
                            Add
                          </Button>
                        </div>
                      ))
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        </Tab>

        <Tab key="window" title="Window">
          {selectedPlacement && selectedRule ? (
            <div className="inspector-section">
              <div className="selected-title">
                <Layers size={17} />
                <div>
                  <strong>{selectedRule.appName}</strong>
                  <span>Window {selectedPlacement.orderIndex + 1}</span>
                </div>
              </div>

              <Select
                size="sm"
                radius="sm"
                label="Display"
                selectedKeys={[selectedPlacement.displayId]}
                onSelectionChange={(keys) => {
                  const displayId = String(Array.from(keys)[0]);
                  onMovePlacementToDisplay(selectedPlacement.id, displayId);
                }}
              >
                {displays.map((display) => (
                  <SelectItem key={display.identity.id}>{display.identity.name}</SelectItem>
                ))}
              </Select>

              <div className="metric-grid">
                {(["x", "y", "width", "height"] as const).map((key) => (
                  <Input
                    key={key}
                    size="sm"
                    radius="sm"
                    label={key.toUpperCase()}
                    value={Math.round(selectedPlacement.relativeFrame[key] * 100).toString()}
                    endContent="%"
                    onValueChange={(value) => {
                      const number = Number(value);
                      if (Number.isNaN(number)) return;
                      onUpdatePlacement(selectedPlacement.id, {
                        ...selectedPlacement.relativeFrame,
                        [key]: number / 100,
                      });
                    }}
                  />
                ))}
              </div>

              <Divider />

              <Select
                size="sm"
                radius="sm"
                label="Stack"
                selectedKeys={[selectedRule.stackPolicy.mode]}
                onSelectionChange={(keys) => {
                  const mode = String(Array.from(keys)[0]) as StackMode;
                  onUpdateAppRule({
                    ...selectedRule,
                    stackPolicy: {
                      ...selectedRule.stackPolicy,
                      mode,
                    },
                  });
                }}
              >
                {stackModes.map((mode) => (
                  <SelectItem key={mode.id}>{mode.label}</SelectItem>
                ))}
              </Select>

              <Slider
                size="sm"
                label="Offset"
                minValue={0}
                maxValue={30}
                value={selectedRule.stackPolicy.offsetPercent}
                onChange={(value) =>
                  onUpdateAppRule({
                    ...selectedRule,
                    stackPolicy: {
                      ...selectedRule.stackPolicy,
                      offsetPercent: Array.isArray(value) ? value[0] : value,
                    },
                  })
                }
              />

              <Button
                size="sm"
                radius="sm"
                color="danger"
                variant="flat"
                startContent={<Trash2 size={15} />}
                onPress={() => onDeletePlacement(selectedPlacement.id)}
              >
                Remove window
              </Button>
            </div>
          ) : (
            <div className="empty-inspector">No window selected</div>
          )}
        </Tab>

        <Tab key="settings" title="Settings">
          <div className="inspector-section">
            <div className="settings-row">
              <div>
                <strong>Run from the menu bar</strong>
                <span>
                  When minimized, hide WorkNeat from the Dock and keep it in the menu bar. Click
                  the menu bar icon to apply layouts or reopen the window.
                </span>
              </div>
              <Switch
                size="sm"
                isSelected={hideDockWhenMinimized}
                onValueChange={onHideDockWhenMinimizedChange}
              />
            </div>
            <Button size="sm" radius="sm" variant="flat" onPress={onMinimizeApp}>
              {hideDockWhenMinimized ? "Hide to menu bar" : "Minimize WorkNeat"}
            </Button>
          </div>
        </Tab>
      </Tabs>
    </aside>
  );
}
