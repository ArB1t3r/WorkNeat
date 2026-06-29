import { Button, Card, Chip } from "@heroui/react";
import { CheckCircle2, FolderSearch, MonitorCog, RotateCcw, ShieldCheck } from "lucide-react";
import type { RuntimeSnapshot } from "../types/layout";

interface PermissionGateProps {
  runtime: RuntimeSnapshot;
  onOpenSettings: () => void;
  onRevealCurrentApp: () => void;
  onRequestPermission: () => void;
  onRefresh: () => void;
}

export function PermissionGate({
  runtime,
  onOpenSettings,
  onRevealCurrentApp,
  onRequestPermission,
  onRefresh,
}: PermissionGateProps) {
  const appPath = runtime.appIdentity.bundlePath || runtime.appIdentity.executablePath;

  return (
    <main
      data-tauri-drag-region
      className="app-drag-region traffic-light-safe grid h-screen place-items-center overflow-y-auto p-8"
    >
      <Card className="w-[min(620px,100%)]">
        <Card.Header>
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground shadow-surface">
              <MonitorCog size={20} />
            </span>
            <div className="flex flex-col gap-1">
              <Card.Title className="text-xl">WorkNeat needs Accessibility access</Card.Title>
              <Card.Description>
                Window mirroring and layout restore stay locked until macOS confirms permission.
              </Card.Description>
            </div>
          </div>
        </Card.Header>

        <Card.Content className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3 text-sm text-muted">
            <Chip color={runtime.accessibility === "granted" ? "success" : "warning"} variant="soft">
              <ShieldCheck size={14} />
              <Chip.Label>Accessibility {runtime.accessibility}</Chip.Label>
            </Chip>
            <span>{runtime.displays.length} displays detected</span>
          </div>

          <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-surface-secondary p-4 text-sm">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 size={16} className="shrink-0 text-accent" />
              <span>Use Add Current App to add this exact WorkNeat app to Accessibility.</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 size={16} className="shrink-0 text-accent" />
              <span>
                If an older WorkNeat is already listed, remove it or enable the current app path
                below.
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1 rounded-xl border border-border p-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              Current app
            </span>
            <code className="break-all font-mono text-xs text-foreground">{appPath}</code>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button onPress={onRequestPermission}>
              <ShieldCheck size={16} />
              Add Current App
            </Button>
            <Button variant="secondary" onPress={onOpenSettings}>
              Open Settings
            </Button>
            <Button variant="secondary" onPress={onRevealCurrentApp}>
              <FolderSearch size={16} />
              Reveal App
            </Button>
            <Button variant="tertiary" onPress={onRefresh}>
              <RotateCcw size={16} />
              Recheck
            </Button>
          </div>
        </Card.Content>
      </Card>
    </main>
  );
}
