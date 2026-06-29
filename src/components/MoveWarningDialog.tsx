import { useState } from "react";
import { Button, Card, Switch } from "@heroui/react";
import { TriangleAlert } from "lucide-react";

interface MoveWarningDialogProps {
  apps: string[];
  onDismiss: (suppressFuture: boolean) => void;
}

export function MoveWarningDialog({ apps, onDismiss }: MoveWarningDialogProps) {
  const [suppress, setSuppress] = useState(false);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-8 backdrop-blur-sm">
      <Card className="w-[min(440px,100%)]">
        <Card.Header>
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-warning-soft text-warning">
              <TriangleAlert size={18} />
            </span>
            <div className="flex flex-col gap-1">
              <Card.Title>Some windows couldn’t be moved</Card.Title>
              <Card.Description>
                These apps may be on another Space, minimized to a different desktop, or not
                running:
              </Card.Description>
            </div>
          </div>
        </Card.Header>

        <Card.Content className="flex flex-col gap-4">
          <ul className="flex flex-wrap gap-1.5">
            {apps.map((app) => (
              <li
                key={app}
                className="rounded-md bg-surface-secondary px-2 py-1 text-sm font-medium text-foreground"
              >
                {app}
              </li>
            ))}
          </ul>

          <Switch
            aria-label="Don’t show this again"
            isSelected={suppress}
            onChange={setSuppress}
          >
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              Don’t show this again
            </Switch.Content>
          </Switch>
        </Card.Content>

        <Card.Footer className="justify-end">
          <Button onPress={() => onDismiss(suppress)}>Got it</Button>
        </Card.Footer>
      </Card>
    </div>
  );
}
