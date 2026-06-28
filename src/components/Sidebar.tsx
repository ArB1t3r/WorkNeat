import { Button, Chip, Divider, Input, Listbox, ListboxItem, Switch } from "./heroui";
import { Command, Plus, Search } from "lucide-react";
import { AppIconMark, appIconOptions } from "./AppIcon";
import type { AppIconId, RuntimeSnapshot, WorkspaceProfile } from "../types/layout";

interface SidebarProps {
  profiles: WorkspaceProfile[];
  activeProfileId: string;
  runtime: RuntimeSnapshot;
  appIconId: AppIconId;
  snapToGrid: boolean;
  onSelectProfile: (profileId: string) => void;
  onCreateProfile: () => void;
  onAppIconChange: (iconId: AppIconId) => void;
  onSnapToGridChange: (enabled: boolean) => void;
}

export function Sidebar({
  profiles,
  activeProfileId,
  runtime,
  appIconId,
  snapToGrid,
  onSelectProfile,
  onCreateProfile,
  onAppIconChange,
  onSnapToGridChange,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand-row">
        <div className="brand-mark">
          <AppIconMark id={appIconId} size={36} />
        </div>
        <div>
          <div className="brand-name">WorkNeat</div>
          <div className="brand-meta">{runtime.displays.length} displays connected</div>
        </div>
      </div>

      <Input
        size="sm"
        radius="sm"
        placeholder="Search layouts"
        startContent={<Search size={16} />}
        classNames={{ inputWrapper: "input-shell" }}
      />

      <div className="section-heading">
        <span>Layouts</span>
        <Button
          isIconOnly
          size="sm"
          radius="sm"
          variant="flat"
          aria-label="Create layout"
          onPress={onCreateProfile}
        >
          <Plus size={16} />
        </Button>
      </div>

      <Listbox
        aria-label="Workspace profiles"
        selectedKeys={[activeProfileId]}
        selectionMode="single"
        onSelectionChange={(keys) => {
          const next = Array.from(keys)[0];
          if (next) onSelectProfile(String(next));
        }}
        className="profile-list"
      >
        {profiles.map((profile) => (
          <ListboxItem key={profile.id} textValue={profile.name} className="profile-item">
            <div className="profile-row">
              <div>
                <div className="profile-title">{profile.name}</div>
                <div className="profile-subtitle">{profile.appRules.length} apps</div>
              </div>
              <Chip size="sm" radius="sm" variant="flat" startContent={<Command size={12} />}>
                {profile.hotkey}
              </Chip>
            </div>
          </ListboxItem>
        ))}
      </Listbox>

      <Divider />

      <div className="sidebar-setting">
        <span>Snap to grid</span>
        <Switch
          size="sm"
          aria-label="Snap to grid"
          isSelected={snapToGrid}
          onValueChange={onSnapToGridChange}
        />
      </div>

      <Divider />

      <div className="icon-picker">
        <div className="section-heading compact">
          <span>App Icon</span>
        </div>
        <div className="icon-options" role="radiogroup" aria-label="App icon style">
          {appIconOptions.map((option) => (
            <button
              aria-checked={appIconId === option.id}
              aria-label={option.label}
              className={`icon-option ${appIconId === option.id ? "selected" : ""}`}
              key={option.id}
              onClick={() => onAppIconChange(option.id)}
              role="radio"
              type="button"
            >
              <AppIconMark id={option.id} size={30} />
            </button>
          ))}
        </div>
      </div>

      <div className="display-set">
        <div className="section-heading compact">
          <span>Display Set</span>
        </div>
        {runtime.displays.map((display) => (
          <div className="display-line" key={display.identity.id}>
            <span>{display.identity.name}</span>
            <span>
              {display.nativeFrame.width} × {display.nativeFrame.height}
            </span>
          </div>
        ))}
      </div>
    </aside>
  );
}
