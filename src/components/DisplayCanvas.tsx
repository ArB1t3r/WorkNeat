import { Chip } from "@heroui/react";
import { MousePointer2 } from "lucide-react";
import {
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type {
  AppRule,
  DisplayDescriptor,
  RelativeFrame,
  WindowPlacement,
  WorkspaceProfile,
} from "../types/layout";

interface DisplayCanvasProps {
  profile: WorkspaceProfile;
  displays: DisplayDescriptor[];
  selectedPlacementId: string | null;
  activeDisplayId: string;
  snapToGrid: boolean;
  gridColumns: number;
  gridRows: number;
  onSelectPlacement: (placementId: string) => void;
  onActivateDisplay: (displayId: string) => void;
  onUpdatePlacement: (placementId: string, frame: RelativeFrame) => void;
}

interface DisplayScale {
  minX: number;
  minY: number;
  scale: number;
  width: number;
  height: number;
}

function getDisplayScale(displays: DisplayDescriptor[]): DisplayScale {
  const minX = Math.min(...displays.map((display) => display.frame.x));
  const minY = Math.min(...displays.map((display) => display.frame.y));
  const maxX = Math.max(...displays.map((display) => display.frame.x + display.frame.width));
  const maxY = Math.max(...displays.map((display) => display.frame.y + display.frame.height));
  const width = maxX - minX;
  const height = maxY - minY;
  const scale = Math.min(920 / width, 560 / height);

  return { minX, minY, width, height, scale };
}

function clampFrame(frame: RelativeFrame): RelativeFrame {
  const width = Math.min(Math.max(frame.width, 0.12), 1);
  const height = Math.min(Math.max(frame.height, 0.12), 1);
  return {
    width,
    height,
    x: Math.min(Math.max(frame.x, 0), 1 - width),
    y: Math.min(Math.max(frame.y, 0), 1 - height),
  };
}

function snapToLine(value: number, divisions: number): number {
  return Math.round(value * divisions) / divisions;
}

function snapPosition(value: number, size: number, divisions: number): number {
  const max = Math.max(0, 1 - size);
  const snapped = snapToLine(value, divisions);
  if (snapped <= max) return Math.max(0, snapped);

  return Math.floor(max * divisions) / divisions;
}

function snapFrame(
  frame: RelativeFrame,
  mode: "move" | "resize",
  columns: number,
  rows: number,
): RelativeFrame {
  if (mode === "move") {
    return clampFrame({
      ...frame,
      x: snapPosition(frame.x, frame.width, columns),
      y: snapPosition(frame.y, frame.height, rows),
    });
  }

  return clampFrame({
    ...frame,
    width: snapToLine(frame.x + frame.width, columns) - frame.x,
    height: snapToLine(frame.y + frame.height, rows) - frame.y,
  });
}

function findRule(profile: WorkspaceProfile, placement: WindowPlacement): AppRule {
  return profile.appRules.find((rule) => rule.id === placement.appRuleId) ?? profile.appRules[0];
}

export function DisplayCanvas({
  profile,
  displays,
  selectedPlacementId,
  activeDisplayId,
  snapToGrid,
  gridColumns,
  gridRows,
  onSelectPlacement,
  onActivateDisplay,
  onUpdatePlacement,
}: DisplayCanvasProps) {
  const [draggingDisplayId, setDraggingDisplayId] = useState<string | null>(null);
  const displayScale = getDisplayScale(displays);
  const placements = profile.appRules.flatMap((rule) => rule.placements);

  function updateByPointer(
    event: ReactPointerEvent,
    placement: WindowPlacement,
    display: DisplayDescriptor,
    mode: "move" | "resize",
  ) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    onActivateDisplay(display.identity.id);
    setDraggingDisplayId(display.identity.id);

    const startX = event.clientX;
    const startY = event.clientY;
    const startFrame = placement.relativeFrame;
    const displayWidth = display.frame.width * displayScale.scale;
    const displayHeight = display.frame.height * displayScale.scale;

    const move = (pointerEvent: PointerEvent) => {
      const dx = (pointerEvent.clientX - startX) / displayWidth;
      const dy = (pointerEvent.clientY - startY) / displayHeight;

      if (mode === "move") {
        onUpdatePlacement(
          placement.id,
          applyGrid({
            ...startFrame,
            x: startFrame.x + dx,
            y: startFrame.y + dy,
          }),
        );
      } else {
        onUpdatePlacement(
          placement.id,
          applyGrid({
            ...startFrame,
            width: startFrame.width + dx,
            height: startFrame.height + dy,
          }),
        );
      }
    };

    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      setDraggingDisplayId(null);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);

    function applyGrid(frame: RelativeFrame) {
      return snapToGrid ? snapFrame(frame, mode, gridColumns, gridRows) : clampFrame(frame);
    }
  }

  return (
    <main className="canvas-shell">
      <div className="canvas-toolbar">
        <Chip size="sm" variant="secondary">
          <MousePointer2 size={14} />
          <Chip.Label>Drag windows and resize from the lower-right handle</Chip.Label>
        </Chip>
        <span>{profile.displaySetSignature}</span>
      </div>

      <div
        className="display-stage"
        style={{
          width: displayScale.width * displayScale.scale,
          height: displayScale.height * displayScale.scale,
        }}
      >
        {displays.map((display) => {
          const left = (display.frame.x - displayScale.minX) * displayScale.scale;
          const top = (display.frame.y - displayScale.minY) * displayScale.scale;
          const width = display.frame.width * displayScale.scale;
          const height = display.frame.height * displayScale.scale;
          const displayPlacements = placements.filter(
            (placement) => placement.displayId === display.identity.id,
          );
          const isActive = activeDisplayId === display.identity.id;
          const isDragging = draggingDisplayId === display.identity.id;

          return (
            <section
              className={`display-frame ${isActive ? "active" : ""} ${
                isDragging ? "dragging" : ""
              }`}
              key={display.identity.id}
              aria-label={`Activate ${display.identity.name}`}
              onPointerDown={() => onActivateDisplay(display.identity.id)}
              onKeyDown={(event: ReactKeyboardEvent<HTMLElement>) => {
                if (event.key !== "Enter" && event.key !== " ") return;

                event.preventDefault();
                onActivateDisplay(display.identity.id);
              }}
              role="group"
              style={{ left, top, width, height }}
              tabIndex={0}
            >
              {isDragging ? (
                <div
                  className="display-grid"
                  style={{
                    backgroundSize: `calc(100% / ${gridColumns}) calc(100% / ${gridRows})`,
                  }}
                />
              ) : null}
              <div className="display-label">
                <strong>{display.identity.name}</strong>
                <span>
                  {display.nativeFrame.width} × {display.nativeFrame.height}
                </span>
              </div>

              {displayPlacements.map((placement) => {
                const rule = findRule(profile, placement);
                const ruleIndex = Math.max(
                  profile.appRules.findIndex((item) => item.id === rule.id),
                  0,
                );
                const frame = placement.relativeFrame;
                const selected = selectedPlacementId === placement.id;

                return (
                  <div
                    key={placement.id}
                    className={`window-block ${selected ? "selected" : ""}`}
                    style={{
                      left: `${frame.x * 100}%`,
                      top: `${frame.y * 100}%`,
                      width: `${frame.width * 100}%`,
                      height: `${frame.height * 100}%`,
                      zIndex: profile.appRules.length - ruleIndex,
                    }}
                    onPointerDown={(event) => {
                      onSelectPlacement(placement.id);
                      updateByPointer(event, placement, display, "move");
                    }}
                  >
                    <div className="window-chrome">
                      <span />
                      <span />
                      <span />
                    </div>
                    <div className="window-content">
                      <strong>{rule.appName}</strong>
                      <span>Window {placement.orderIndex + 1}</span>
                    </div>
                    <button
                      aria-label="Resize window"
                      className="resize-handle"
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        onSelectPlacement(placement.id);
                        updateByPointer(event, placement, display, "resize");
                      }}
                    />
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </main>
  );
}
