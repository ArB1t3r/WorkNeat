import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button, Chip, Input, Tooltip } from "./heroui";
import { Download, Keyboard, LocateFixed, Play, Save, ShieldCheck } from "lucide-react";
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

  useEffect(() => {
    if (isRecordingHotkey) {
      hotkeyButtonRef.current?.focus();
    }
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

    if (hotkeyFromKeyTokens(recordedKeyTokensRef.current)) {
      scheduleHotkeyCommit();
    }
  }

  function handleHotkeyKeyUp(event: KeyboardEvent<HTMLButtonElement>) {
    if (!isRecordingHotkey) return;

    event.preventDefault();
    event.stopPropagation();
  }

  return (
    <header className="topbar">
      <div className="topbar-main">
        <div className="topbar-fields">
          <Input
            size="sm"
            radius="sm"
            label="Layout"
            value={profile.name}
            onValueChange={onNameChange}
            className="name-input"
          />
          <Button
            ref={hotkeyButtonRef}
            size="sm"
            radius="sm"
            variant={isRecordingHotkey ? "solid" : "flat"}
            color={isRecordingHotkey ? "primary" : "default"}
            className="hotkey-input"
            startContent={<Keyboard size={16} />}
            onPress={beginHotkeyRecording}
            onKeyDown={handleHotkeyKeyDown}
            onKeyUp={handleHotkeyKeyUp}
            onBlur={() => finishHotkeyRecording(true)}
          >
            <span>{isRecordingHotkey ? recordedHotkeyPreview || "Press keys" : profile.hotkey || "Set hotkey"}</span>
          </Button>
        </div>

        <div className="topbar-status">
          {shortcutFailures.length > 0
            ? `Shortcut unavailable: ${shortcutFailures.join(", ")}`
            : statusMessage || (hasUnsavedChanges ? "Unsaved changes" : "Saved locally")}
        </div>
      </div>

      <div className="topbar-actions">
        <Chip color={permissionTone} radius="sm" variant="flat" startContent={<ShieldCheck size={14} />}>
          Accessibility {accessibility}
        </Chip>
        <Tooltip content={`Mirror tracked apps on ${mirrorDisplayName}`}>
          <Button
            size="sm"
            radius="sm"
            variant="flat"
            className="mirror-button"
            startContent={<LocateFixed size={16} />}
            onPress={onMirror}
          >
            Mirror {mirrorDisplayName}
          </Button>
        </Tooltip>
        <Tooltip content="Export layout">
          <Button isIconOnly size="sm" radius="sm" variant="flat" aria-label="Export layout">
            <Download size={16} />
          </Button>
        </Tooltip>
        <Tooltip content="Save current layout locally">
          <Button
            isIconOnly
            size="sm"
            radius="sm"
            color={hasUnsavedChanges ? "primary" : "default"}
            variant={hasUnsavedChanges ? "solid" : "flat"}
            aria-label="Save layout"
            onPress={onSave}
          >
            <Save size={16} />
          </Button>
        </Tooltip>
        <Button size="sm" radius="sm" color="primary" startContent={<Play size={16} />} onPress={onApply}>
          Apply
        </Button>
      </div>
    </header>
  );
}
