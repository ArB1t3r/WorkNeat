import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button, Chip, Input, TextField, Tooltip } from "@heroui/react";
import { Keyboard, LocateFixed, Play, Save, ShieldCheck } from "lucide-react";
import type { PermissionStatus, WorkspaceProfile } from "../types/layout";
import {
  formatHotkeyDisplay,
  hotkeyFromKeyTokens,
  keyTokenFromKeyboardEvent,
  maxHotkeyKeys,
} from "../lib/hotkeys";

interface TopBarProps {
  profile: WorkspaceProfile;
  accessibility: PermissionStatus;
  onNameChange: (name: string) => void;
  onHotkeyChange: (hotkey: string) => void;
  onMirror: () => void;
  mirrorDisplayName: string;
  onSave: () => void;
  onApply: () => void;
  hasUnsavedChanges: boolean;
  shortcutFailures: string[];
  statusMessage: string | null;
}

export function TopBar({
  profile,
  accessibility,
  onNameChange,
  onHotkeyChange,
  onMirror,
  mirrorDisplayName,
  onSave,
  onApply,
  hasUnsavedChanges,
  shortcutFailures,
  statusMessage,
}: TopBarProps) {
  const [isRecordingHotkey, setIsRecordingHotkey] = useState(false);
  const [recordedHotkeyPreview, setRecordedHotkeyPreview] = useState("");
  const hotkeyButtonRef = useRef<HTMLButtonElement | null>(null);
  const recordedKeyTokensRef = useRef<string[]>([]);
  const commitTimerRef = useRef<number | null>(null);
  const permissionTone =
    accessibility === "granted" ? "success" : accessibility === "missing" ? "warning" : "default";
  const statusText =
    shortcutFailures.length > 0
      ? `Shortcut unavailable: ${shortcutFailures.join(", ")}`
      : statusMessage || (hasUnsavedChanges ? "Unsaved changes" : "Saved locally");

  useEffect(() => {
    if (isRecordingHotkey) hotkeyButtonRef.current?.focus();
  }, [isRecordingHotkey]);

  useEffect(() => {
    return () => clearHotkeyCommitTimer();
  }, []);

  function clearHotkeyCommitTimer() {
    if (commitTimerRef.current === null) return;
    window.clearTimeout(commitTimerRef.current);
    commitTimerRef.current = null;
  }

  function beginHotkeyRecording() {
    clearHotkeyCommitTimer();
    recordedKeyTokensRef.current = [];
    setRecordedHotkeyPreview("");
    setIsRecordingHotkey(true);
  }

  function finishHotkeyRecording(shouldCommit: boolean) {
    clearHotkeyCommitTimer();
    if (shouldCommit) {
      const captured = hotkeyFromKeyTokens(recordedKeyTokensRef.current);
      if (captured) onHotkeyChange(captured.hotkey);
    }
    recordedKeyTokensRef.current = [];
    setRecordedHotkeyPreview("");
    setIsRecordingHotkey(false);
  }

  function scheduleHotkeyCommit() {
    clearHotkeyCommitTimer();
    commitTimerRef.current = window.setTimeout(() => finishHotkeyRecording(true), 650);
  }

  function handleHotkeyKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!isRecordingHotkey) return;
    event.preventDefault();
    event.stopPropagation();

    if (event.key === "Escape") {
      finishHotkeyRecording(false);
      return;
    }
    if (event.repeat) return;

    const keyToken = keyTokenFromKeyboardEvent(event);
    if (!keyToken) return;

    const recordedTokens = recordedKeyTokensRef.current;
    if (!recordedTokens.includes(keyToken) && recordedTokens.length < maxHotkeyKeys) {
      recordedKeyTokensRef.current = [...recordedTokens, keyToken];
    }

    setRecordedHotkeyPreview(formatHotkeyDisplay(recordedKeyTokensRef.current.join("+")));
    if (hotkeyFromKeyTokens(recordedKeyTokensRef.current)) scheduleHotkeyCommit();
  }

  function handleHotkeyKeyUp(event: KeyboardEvent<HTMLButtonElement>) {
    if (!isRecordingHotkey) return;
    event.preventDefault();
    event.stopPropagation();
  }

  const hotkeyLabel = isRecordingHotkey
    ? recordedHotkeyPreview || "Press keys…"
    : profile.hotkey || "Set hotkey";

  return (
    <header
      data-tauri-drag-region
      className="app-drag-region work-surface flex items-center justify-between gap-4 border-b border-separator px-5 py-3"
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex items-center gap-2.5">
          <TextField
            aria-label="Layout name"
            className="w-[220px]"
            value={profile.name}
            onChange={onNameChange}
          >
            <Input placeholder="Layout name" />
          </TextField>

          <button
            ref={hotkeyButtonRef}
            type="button"
            data-recording={isRecordingHotkey}
            className={[
              "inline-flex h-9 min-w-[136px] items-center gap-2 rounded-lg border px-3 text-sm font-medium outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-focus",
              isRecordingHotkey
                ? "border-accent bg-accent text-accent-foreground"
                : "border-field-border bg-field text-foreground hover:bg-field-hover",
            ].join(" ")}
            onClick={beginHotkeyRecording}
            onKeyDown={handleHotkeyKeyDown}
            onKeyUp={handleHotkeyKeyUp}
            onBlur={() => finishHotkeyRecording(true)}
          >
            <Keyboard size={16} className="shrink-0 opacity-80" />
            <span className="truncate">{hotkeyLabel}</span>
          </button>
        </div>

        <div
          data-tauri-drag-region
          className="max-w-[560px] truncate text-xs text-muted"
          title={statusText}
        >
          {statusText}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        <Chip color={permissionTone} variant="soft">
          <ShieldCheck size={14} />
          <Chip.Label>Accessibility {accessibility}</Chip.Label>
        </Chip>

        <Tooltip delay={400}>
          <Button variant="secondary" className="max-w-[200px]" onPress={onMirror}>
            <LocateFixed size={16} />
            <span className="truncate">Mirror {mirrorDisplayName}</span>
          </Button>
          <Tooltip.Content showArrow>
            <Tooltip.Arrow />
            Mirror tracked apps on {mirrorDisplayName}
          </Tooltip.Content>
        </Tooltip>

        <Tooltip delay={400}>
          <Button
            isIconOnly
            variant={hasUnsavedChanges ? "primary" : "secondary"}
            aria-label="Save layout"
            onPress={onSave}
          >
            <Save size={16} />
          </Button>
          <Tooltip.Content showArrow>
            <Tooltip.Arrow />
            Save layout locally
          </Tooltip.Content>
        </Tooltip>

        <Button onPress={onApply}>
          <Play size={16} />
          Apply
        </Button>
      </div>
    </header>
  );
}
