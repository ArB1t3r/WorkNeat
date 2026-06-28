import { Button, Card, CardBody, CardHeader, Chip } from "./heroui";
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
  return (
    <main className="permission-shell">
      <Card radius="sm" className="permission-card">
        <CardHeader className="permission-header">
          <div className="brand-mark">
            <MonitorCog size={18} />
          </div>
          <div>
            <h1>WorkNeat needs Accessibility access</h1>
            <p>Window mirroring and layout restore stay locked until macOS confirms permission.</p>
          </div>
        </CardHeader>

        <CardBody className="permission-body">
          <div className="permission-status-row">
            <Chip
              color={runtime.accessibility === "granted" ? "success" : "warning"}
              radius="sm"
              variant="flat"
              startContent={<ShieldCheck size={14} />}
            >
              Accessibility {runtime.accessibility}
            </Chip>
            <span>{runtime.displays.length} displays detected</span>
          </div>

          <div className="permission-steps">
            <div>
              <CheckCircle2 size={17} />
              <span>Use Add Current App to add this exact WorkNeat app to Accessibility.</span>
            </div>
            <div>
              <CheckCircle2 size={17} />
              <span>If an older WorkNeat is already listed, remove it or enable the current app path below.</span>
            </div>
          </div>

          <div className="permission-path">
            <span>Current app</span>
            <code>{runtime.appIdentity.bundlePath || runtime.appIdentity.executablePath}</code>
          </div>

          <div className="permission-actions">
            <Button radius="sm" color="primary" startContent={<ShieldCheck size={16} />} onPress={onRequestPermission}>
              Add Current App
            </Button>
            <Button radius="sm" variant="flat" onPress={onOpenSettings}>
              Open Settings
            </Button>
            <Button radius="sm" variant="flat" startContent={<FolderSearch size={16} />} onPress={onRevealCurrentApp}>
              Reveal App
            </Button>
            <Button radius="sm" variant="light" startContent={<RotateCcw size={16} />} onPress={onRefresh}>
              Recheck
            </Button>
          </div>
        </CardBody>
      </Card>
    </main>
  );
}
