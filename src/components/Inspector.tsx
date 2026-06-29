import { useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  Button,
  Input,
  Label,
  ListBox,
  Select,
  Separator,
  Slider,
  Switch,
  Tabs,
  TextField,
} from "@heroui/react";
import { AppWindow, ChevronDown, ChevronUp, CopyPlus, GripVertical, Layers, RefreshCcw, Trash2 } from "lucide-react";
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
  appSources: AppSource[];
  onRefreshAppSources: () => void;
  onAddAppSource: (source: AppSource) => void;
}

const metricKeys = ["x", "y", "width", "height"] as const;
const metricLabels: Record<(typeof metricKeys)[number], string> = {
  x: "X",
  y: "Y",
  width: "W",
  height: "H",
};

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
  appSources,
  onRefreshAppSources,
  onAddAppSource,
}: InspectorProps) {
  const [draggingRuleId, setDraggingRuleId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    ruleId: string;
    position: "before" | "after";
  } | null>(null);
  const placements = profile.appRules.flatMap((rule) => rule.placements);
  const selectedPlacement =
    placements.find((placement) => placement.id === selectedPlacementId) ?? placements[0] ?? null;
  const selectedRule = selectedPlacement
    ? profile.appRules.find((rule) => rule.id === selectedPlacement.appRuleId) ?? null
    : null;
  const trackedAppKeys = new Set(
    profile.appRules.flatMap((rule) => [appKey(rule.bundleIdentifier), appKey(rule.appName)]),
  );

  function findDropTarget(clientY: number): { ruleId: string; position: "before" | "after" } | null {
    const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-rule-id]"));
    if (rows.length === 0) return null;

    for (const row of rows) {
      const rect = row.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) {
        return {
          ruleId: row.dataset.ruleId ?? "",
          position: clientY < rect.top + rect.height / 2 ? "before" : "after",
        };
      }
    }

    const firstRect = rows[0].getBoundingClientRect();
    if (clientY < firstRect.top) return { ruleId: rows[0].dataset.ruleId ?? "", position: "before" };
    const lastRow = rows[rows.length - 1];
    return { ruleId: lastRow.dataset.ruleId ?? "", position: "after" };
  }

  // Pointer-based layer reordering. HTML5 drag-and-drop is unreliable inside the
  // macOS WKWebView (the drag image shows but `drop` never fires), so the reorder
  // is driven with pointer events instead.
  function startReorder(event: ReactPointerEvent<HTMLElement>, ruleId: string) {
    event.preventDefault();
    event.stopPropagation();
    setDraggingRuleId(ruleId);

    const handleMove = (moveEvent: PointerEvent) => {
      const target = findDropTarget(moveEvent.clientY);
      setDropTarget(target && target.ruleId !== ruleId ? target : null);
    };
    const handleUp = (upEvent: PointerEvent) => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      const target = findDropTarget(upEvent.clientY);
      setDraggingRuleId(null);
      setDropTarget(null);
      if (target && target.ruleId !== ruleId) {
        onReorderAppRule(ruleId, target.ruleId, target.position);
      }
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

  return (
    <aside className="frost-panel flex min-h-0 flex-col border-l border-separator">
      <Tabs defaultSelectedKey="apps" className="flex min-h-0 flex-1 flex-col">
        <div className="px-4 pt-4">
          <Tabs.ListContainer>
            <Tabs.List aria-label="Inspector">
              <Tabs.Tab id="apps">
                Apps
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="window">
                Window
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
        </div>

        <Tabs.Panel id="apps" className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto p-4">
          <SectionHeading title="Tracked Apps" trailing={`${profile.appRules.length} apps`} />

          {profile.appRules.length === 0 ? (
            <EmptyHint>Add running apps below to start tracking a layout.</EmptyHint>
          ) : (
            profile.appRules.map((rule, index) => (
              <div
                key={rule.id}
                data-rule-id={rule.id}
                className={[
                  "flex flex-col gap-2.5 rounded-xl border border-border bg-surface-secondary p-3 transition-all",
                  draggingRuleId === rule.id ? "opacity-50" : "",
                  dropTarget?.ruleId === rule.id
                    ? dropTarget.position === "before"
                      ? "shadow-[inset_0_2px_0_0_var(--accent)]"
                      : "shadow-[inset_0_-2px_0_0_var(--accent)]"
                    : "",
                ].join(" ")}
              >
                <div className="flex w-full min-w-0 items-center gap-2.5">
                  <span
                    aria-label={`Drag ${rule.appName} layer`}
                    role="button"
                    title="Drag to reorder layer"
                    className="grid h-8 w-6 shrink-0 cursor-grab touch-none select-none place-items-center rounded-md text-muted hover:bg-accent-soft hover:text-accent active:cursor-grabbing"
                    onPointerDown={(event) => startReorder(event, rule.id)}
                  >
                    <GripVertical size={15} />
                  </span>
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    onClick={() => {
                      const first = rule.placements[0];
                      if (first) onSelectPlacement(first.id);
                    }}
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                      <AppWindow size={16} />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <strong className="truncate text-sm font-medium">{rule.appName}</strong>
                      <span className="text-xs text-muted">
                        {rule.placements.length} {rule.placements.length === 1 ? "window" : "windows"}
                      </span>
                    </span>
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <Switch
                    size="sm"
                    isSelected={rule.launchBehavior === "launch"}
                    onChange={(enabled) =>
                      onUpdateAppRule({
                        ...rule,
                        launchBehavior: (enabled ? "launch" : "skip") as LaunchBehavior,
                      })
                    }
                  >
                    <Switch.Content>
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                      Launch
                    </Switch.Content>
                  </Switch>

                  <div className="flex items-center gap-1.5">
                    <Button
                      isIconOnly
                      size="sm"
                      variant="tertiary"
                      isDisabled={index === 0}
                      aria-label={`Move ${rule.appName} forward`}
                      onPress={() => {
                        const previousRule = profile.appRules[index - 1];
                        if (previousRule) onReorderAppRule(rule.id, previousRule.id, "before");
                      }}
                    >
                      <ChevronUp size={15} />
                    </Button>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="tertiary"
                      isDisabled={index === profile.appRules.length - 1}
                      aria-label={`Move ${rule.appName} backward`}
                      onPress={() => {
                        const nextRule = profile.appRules[index + 1];
                        if (nextRule) onReorderAppRule(rule.id, nextRule.id, "after");
                      }}
                    >
                      <ChevronDown size={15} />
                    </Button>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="tertiary"
                      aria-label={`Add ${rule.appName} window`}
                      onPress={() => onAddWindow(rule.id)}
                    >
                      <CopyPlus size={15} />
                    </Button>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="danger-soft"
                      aria-label={`Remove ${rule.appName}`}
                      onPress={() => onDeleteAppRule(rule.id)}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}

          <Separator />

          <div className="flex items-center justify-between">
            <SectionHeading title="Available Apps" />
            <Button
              isIconOnly
              size="sm"
              variant="tertiary"
              aria-label="Refresh running apps"
              onPress={onRefreshAppSources}
            >
              <RefreshCcw size={15} />
            </Button>
          </div>

          <div className="flex flex-col gap-3">
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
                <section key={display.identity.id} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <strong className="font-semibold text-foreground">{display.identity.name}</strong>
                    <span className="text-muted">{displaySources.length} apps</span>
                  </div>

                  {displaySources.length === 0 ? (
                    <EmptyHint>No untracked visible apps on this display.</EmptyHint>
                  ) : (
                    displaySources.map((source) => (
                      <div
                        key={source.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-secondary py-2 pl-3 pr-2"
                      >
                        <span className="flex min-w-0 flex-col">
                          <strong className="truncate text-sm font-medium">{source.appName}</strong>
                          <span className="text-xs text-muted">
                            {source.windowCount} {source.windowCount === 1 ? "window" : "windows"}
                          </span>
                        </span>
                        <Button size="sm" variant="secondary" onPress={() => onAddAppSource(source)}>
                          Add
                        </Button>
                      </div>
                    ))
                  )}
                </section>
              );
            })}
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="window" className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto p-4">
          {selectedPlacement && selectedRule ? (
            <>
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                  <Layers size={17} />
                </span>
                <div className="flex min-w-0 flex-col">
                  <strong className="truncate text-sm font-medium">{selectedRule.appName}</strong>
                  <span className="text-xs text-muted">Window {selectedPlacement.orderIndex + 1}</span>
                </div>
              </div>

              <Select
                variant="secondary"
                value={selectedPlacement.displayId}
                onChange={(value) => {
                  if (value) onMovePlacementToDisplay(selectedPlacement.id, String(value));
                }}
              >
                <Label>Display</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {displays.map((display) => (
                      <ListBox.Item
                        key={display.identity.id}
                        id={display.identity.id}
                        textValue={display.identity.name}
                      >
                        {display.identity.name}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>

              <div className="grid grid-cols-2 gap-2.5">
                {metricKeys.map((key) => (
                  <TextField
                    key={key}
                    variant="secondary"
                    value={Math.round(selectedPlacement.relativeFrame[key] * 100).toString()}
                    onChange={(value) => {
                      const number = Number(value);
                      if (Number.isNaN(number)) return;
                      onUpdatePlacement(selectedPlacement.id, {
                        ...selectedPlacement.relativeFrame,
                        [key]: number / 100,
                      });
                    }}
                  >
                    <Label>{metricLabels[key]} %</Label>
                    <Input inputMode="numeric" />
                  </TextField>
                ))}
              </div>

              <Separator />

              <Select
                variant="secondary"
                value={selectedRule.stackPolicy.mode}
                onChange={(value) => {
                  if (!value) return;
                  onUpdateAppRule({
                    ...selectedRule,
                    stackPolicy: { ...selectedRule.stackPolicy, mode: String(value) as StackMode },
                  });
                }}
              >
                <Label>Stack</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {stackModes.map((mode) => (
                      <ListBox.Item key={mode.id} id={mode.id} textValue={mode.label}>
                        {mode.label}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>

              <Slider
                minValue={0}
                maxValue={30}
                step={1}
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
              >
                <Label>Offset</Label>
                <Slider.Output />
                <Slider.Track>
                  <Slider.Fill />
                  <Slider.Thumb />
                </Slider.Track>
              </Slider>

              <Button
                variant="danger-soft"
                onPress={() => onDeletePlacement(selectedPlacement.id)}
              >
                <Trash2 size={15} />
                Remove window
              </Button>
            </>
          ) : (
            <EmptyHint>No window selected.</EmptyHint>
          )}
        </Tabs.Panel>
      </Tabs>
    </aside>
  );
}

function SectionHeading({ title, trailing }: { title: string; trailing?: string }) {
  return (
    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted">
      <span>{title}</span>
      {trailing ? <span className="normal-case">{trailing}</span> : null}
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-3 py-2.5 text-xs text-muted">
      {children}
    </div>
  );
}

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

const stackModes: Array<{ id: StackMode; label: string }> = [
  { id: "none", label: "None" },
  { id: "horizontal", label: "Horizontal" },
  { id: "vertical", label: "Vertical" },
  { id: "diagonal", label: "Diagonal" },
];
