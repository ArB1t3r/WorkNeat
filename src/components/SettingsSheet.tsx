import { useEffect, useState, type ReactNode } from "react";
import { Sheet, Segment } from "@heroui-pro/react";
import { Button, Chip, Input, Label, ScrollShadow, Separator, Switch, TextField } from "@heroui/react";
import {
  Cloud,
  Download,
  Info,
  LayoutGrid,
  PanelTopOpen,
  Palette,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import { AppIconMark, appIconOptions } from "./AppIcon";
import type { AppIconId, RuntimeSnapshot, ThemeMode } from "../types/layout";

interface SettingsSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  runtime: RuntimeSnapshot;
  appVersion: string;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  appIconId: AppIconId;
  onAppIconChange: (id: AppIconId) => void;
  hideDockWhenMinimized: boolean;
  onHideDockWhenMinimizedChange: (value: boolean) => void;
  snapToGrid: boolean;
  onSnapToGridChange: (value: boolean) => void;
  gridColumns: number;
  gridRows: number;
  onGridChange: (next: { columns: number; rows: number }) => void;
  suppressMoveWarnings: boolean;
  onSuppressMoveWarningsChange: (value: boolean) => void;
  launchAtLogin: boolean;
  onLaunchAtLoginChange: (value: boolean) => void;
  icloudSync: boolean;
  onIcloudSyncChange: (value: boolean) => void;
  onImportLayouts: () => void;
  onExportLayouts: () => void;
  onCheckForUpdates: () => void;
  onMinimizeApp: () => void;
  onOpenAccessibilitySettings: () => void;
  onRecheckAccessibility: () => void;
}

type SectionId = "general" | "appearance" | "menubar" | "editor" | "sync" | "about";

export function SettingsSheet({
  isOpen,
  onOpenChange,
  runtime,
  appVersion,
  theme,
  onThemeChange,
  appIconId,
  onAppIconChange,
  hideDockWhenMinimized,
  onHideDockWhenMinimizedChange,
  snapToGrid,
  onSnapToGridChange,
  gridColumns,
  gridRows,
  onGridChange,
  suppressMoveWarnings,
  onSuppressMoveWarningsChange,
  launchAtLogin,
  onLaunchAtLoginChange,
  icloudSync,
  onIcloudSyncChange,
  onImportLayouts,
  onExportLayouts,
  onCheckForUpdates,
  onMinimizeApp,
  onOpenAccessibilitySettings,
  onRecheckAccessibility,
}: SettingsSheetProps) {
  const [section, setSection] = useState<SectionId>("general");
  const accessibilityTone =
    runtime.accessibility === "granted"
      ? "success"
      : runtime.accessibility === "missing"
        ? "warning"
        : "default";

  return (
    <Sheet isOpen={isOpen} onOpenChange={onOpenChange} placement="right">
      <Sheet.Backdrop variant="blur">
        <Sheet.Content className="h-dvh w-[min(720px,94vw)]">
          <Sheet.Dialog className="flex h-full flex-col">
            <Sheet.CloseTrigger />
            <Sheet.Header>
              <Sheet.Heading>Settings</Sheet.Heading>
            </Sheet.Header>

            <Sheet.Body className="flex min-h-0 flex-1 gap-0 p-0">
              <nav className="flex w-48 shrink-0 flex-col gap-1 border-r border-separator p-3">
                {sections.map((item) => {
                  const isActive = section === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-current={isActive ? "page" : undefined}
                      className={[
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                        isActive
                          ? "bg-surface text-foreground shadow-surface"
                          : "text-muted hover:bg-surface-secondary hover:text-foreground",
                      ].join(" ")}
                      onClick={() => setSection(item.id)}
                    >
                      <item.icon size={16} className="shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </nav>

              <ScrollShadow className="min-h-0 flex-1">
                <div className="flex flex-col gap-6 p-6">
                  {section === "general" ? (
                    <>
                      <Section title="General" description="Permissions and core behavior.">
                        <Row
                          title="Accessibility access"
                          description="Required to inspect and move other apps' windows."
                        >
                          <Chip color={accessibilityTone} variant="soft">
                            <ShieldCheck size={14} />
                            <Chip.Label>{runtime.accessibility}</Chip.Label>
                          </Chip>
                        </Row>
                        <div className="flex flex-wrap gap-2.5">
                          <Button variant="secondary" onPress={onOpenAccessibilitySettings}>
                            Open System Settings
                          </Button>
                          <Button variant="tertiary" onPress={onRecheckAccessibility}>
                            <RotateCcw size={15} />
                            Re-check
                          </Button>
                        </div>
                      </Section>

                      <Section title="Updates" description="Keep WorkNeat up to date.">
                        <Button variant="secondary" onPress={onCheckForUpdates}>
                          <RefreshCw size={15} />
                          Check for Updates
                        </Button>
                      </Section>
                    </>
                  ) : null}

                  {section === "appearance" ? (
                    <>
                      <Section
                        title="Appearance"
                        description="Match macOS automatically, or pick a fixed theme."
                      >
                        <Row title="Theme" description="System follows your macOS appearance.">
                          <Segment
                            selectedKey={theme}
                            onSelectionChange={(key) => onThemeChange(key as ThemeMode)}
                          >
                            <Segment.Item id="system">System</Segment.Item>
                            <Segment.Item id="light">Light</Segment.Item>
                            <Segment.Item id="dark">Dark</Segment.Item>
                          </Segment>
                        </Row>
                      </Section>

                      <Section title="App Icon" description="Choose the WorkNeat mark.">
                        <div
                          role="radiogroup"
                          aria-label="App icon style"
                          className="grid grid-cols-4 gap-2.5"
                        >
                          {appIconOptions.map((option) => {
                            const isSelected = appIconId === option.id;
                            return (
                              <button
                                key={option.id}
                                type="button"
                                role="radio"
                                aria-checked={isSelected}
                                aria-label={option.label}
                                onClick={() => onAppIconChange(option.id)}
                                className={[
                                  "grid h-14 place-items-center rounded-xl border transition-shadow",
                                  isSelected
                                    ? "border-accent ring-2 ring-accent/35"
                                    : "border-border hover:border-accent/50",
                                ].join(" ")}
                              >
                                <AppIconMark id={option.id} size={32} />
                              </button>
                            );
                          })}
                        </div>
                      </Section>
                    </>
                  ) : null}

                  {section === "menubar" ? (
                    <Section
                      title="Menu Bar & Startup"
                      description="Control how WorkNeat lives in the background."
                    >
                      <Row
                        title="Launch at login"
                        description="Open WorkNeat automatically when you sign in to your Mac."
                      >
                        <Toggle
                          label="Launch at login"
                          isSelected={launchAtLogin}
                          onChange={onLaunchAtLoginChange}
                        />
                      </Row>
                      <Separator />
                      <Row
                        title="Run from the menu bar"
                        description="When minimized or closed, hide the Dock icon and keep WorkNeat in the menu bar."
                      >
                        <Toggle
                          label="Run from the menu bar"
                          isSelected={hideDockWhenMinimized}
                          onChange={onHideDockWhenMinimizedChange}
                        />
                      </Row>
                      <Button variant="secondary" onPress={onMinimizeApp}>
                        <PanelTopOpen size={15} />
                        {hideDockWhenMinimized ? "Hide to menu bar now" : "Minimize WorkNeat now"}
                      </Button>
                    </Section>
                  ) : null}

                  {section === "editor" ? (
                    <Section title="Editor" description="Layout editing helpers.">
                      <Row
                        title="Snap to grid"
                        description="Snap windows to the grid while dragging and resizing."
                      >
                        <Toggle
                          label="Snap to grid"
                          isSelected={snapToGrid}
                          onChange={onSnapToGridChange}
                        />
                      </Row>

                      <div className="flex flex-col gap-2.5">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium text-foreground">Grid divisions</span>
                          <span className="text-xs text-muted">
                            How many columns and rows each display is split into (2–48).
                          </span>
                        </div>
                        <GridDivisions columns={gridColumns} rows={gridRows} onChange={onGridChange} />
                      </div>

                      <Separator />

                      <Row
                        title="Warn when windows can't be moved"
                        description="Show a notice listing apps that couldn't be placed (e.g. on another Space)."
                      >
                        <Toggle
                          label="Warn when windows can't be moved"
                          isSelected={!suppressMoveWarnings}
                          onChange={(enabled) => onSuppressMoveWarningsChange(!enabled)}
                        />
                      </Row>
                    </Section>
                  ) : null}

                  {section === "sync" ? (
                    <>
                      <Section
                        title="iCloud Sync"
                        description="Roam your layouts across Macs via iCloud Drive."
                      >
                        <Row
                          title="Sync layouts via iCloud"
                          description="Stores layouts in iCloud Drive; the most recently saved Mac wins."
                        >
                          <Toggle
                            label="Sync layouts via iCloud"
                            isSelected={icloudSync}
                            onChange={onIcloudSyncChange}
                          />
                        </Row>
                      </Section>

                      <Section title="Backup" description="Export or import all layouts as a JSON file.">
                        <div className="flex flex-wrap gap-2.5">
                          <Button variant="secondary" onPress={onExportLayouts}>
                            <Download size={15} />
                            Export layouts…
                          </Button>
                          <Button variant="secondary" onPress={onImportLayouts}>
                            <Upload size={15} />
                            Import layouts…
                          </Button>
                        </div>
                      </Section>
                    </>
                  ) : null}

                  {section === "about" ? (
                    <Section title="About" description="WorkNeat — macOS window layout manager.">
                      <AboutRow label="Version" value={appVersion} />
                      <AboutRow label="Identifier" value={runtime.appIdentity.bundleIdentifier} />
                      <AboutRow
                        label="Displays connected"
                        value={String(runtime.displays.length)}
                      />
                    </Section>
                  ) : null}
                </div>
              </ScrollShadow>
            </Sheet.Body>
          </Sheet.Dialog>
        </Sheet.Content>
      </Sheet.Backdrop>
    </Sheet>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description ? <p className="text-sm text-muted">{description}</p> : null}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Row({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{title}</span>
        {description ? <span className="text-xs text-muted">{description}</span> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({
  label,
  isSelected,
  onChange,
}: {
  label: string;
  isSelected: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Switch aria-label={label} isSelected={isSelected} onChange={onChange}>
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch.Content>
    </Switch>
  );
}

function GridDivisions({
  columns,
  rows,
  onChange,
}: {
  columns: number;
  rows: number;
  onChange: (next: { columns: number; rows: number }) => void;
}) {
  const isActive = (preset: { columns: number; rows: number }) =>
    preset.columns === columns && preset.rows === rows;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {gridPresets.map((preset) => (
          <Button
            key={preset.label}
            size="sm"
            variant={isActive(preset) ? "primary" : "secondary"}
            onPress={() => onChange({ columns: preset.columns, rows: preset.rows })}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      <div className="flex items-end gap-3">
        <NumberField
          label="Columns"
          value={columns}
          onCommit={(value) => onChange({ columns: value, rows })}
        />
        <NumberField
          label="Rows"
          value={rows}
          onCommit={(value) => onChange({ columns, rows: value })}
        />
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  const commit = () => {
    const parsed = Math.round(Number(text));
    const next = Number.isFinite(parsed) ? Math.min(48, Math.max(2, parsed)) : value;
    // Always resync the field to the effective value so it never shows stale or
    // out-of-range text, even when the clamped value equals the current one.
    setText(String(next));
    if (next !== value) onCommit(next);
  };

  return (
    <TextField aria-label={label} className="w-24" value={text} onChange={setText}>
      <Label>{label}</Label>
      <Input
        inputMode="numeric"
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
        }}
      />
    </TextField>
  );
}

function AboutRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-separator pb-3 text-sm last:border-0">
      <span className="text-muted">{label}</span>
      <span className="truncate font-medium text-foreground">{value}</span>
    </div>
  );
}

const gridPresets = [
  { label: "12 × 12", columns: 12, rows: 12 },
  { label: "16 × 9", columns: 16, rows: 9 },
  { label: "10 × 6", columns: 10, rows: 6 },
  { label: "24 × 24", columns: 24, rows: 24 },
];

const sections: Array<{ id: SectionId; label: string; icon: typeof Info }> = [
  { id: "general", label: "General", icon: SlidersHorizontal },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "menubar", label: "Menu Bar & Startup", icon: PanelTopOpen },
  { id: "editor", label: "Editor", icon: LayoutGrid },
  { id: "sync", label: "Sync & Backup", icon: Cloud },
  { id: "about", label: "About", icon: Info },
];
