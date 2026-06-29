import { useMemo, useState } from "react";
import { Button, Chip, Input, ScrollShadow, Separator, TextField, Tooltip } from "@heroui/react";
import { Plus, Search, Settings, Trash2 } from "lucide-react";
import { AppIconMark } from "./AppIcon";
import type { AppIconId, RuntimeSnapshot, WorkspaceProfile } from "../types/layout";

interface SidebarProps {
  profiles: WorkspaceProfile[];
  activeProfileId: string;
  runtime: RuntimeSnapshot;
  appIconId: AppIconId;
  onSelectProfile: (profileId: string) => void;
  onCreateProfile: () => void;
  onDeleteProfile: (profileId: string) => void;
  onOpenSettings: () => void;
}

export function Sidebar({
  profiles,
  activeProfileId,
  runtime,
  appIconId,
  onSelectProfile,
  onCreateProfile,
  onDeleteProfile,
  onOpenSettings,
}: SidebarProps) {
  const [query, setQuery] = useState("");

  const filteredProfiles = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return profiles;
    return profiles.filter((profile) => profile.name.toLowerCase().includes(trimmed));
  }, [profiles, query]);

  const canDelete = profiles.length > 1;

  return (
    <aside className="app-drag-region frost-panel flex h-screen flex-col gap-4 border-r border-separator p-4">
      <div data-tauri-drag-region className="traffic-light-safe flex items-center gap-3 px-1">
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] shadow-surface">
          <AppIconMark id={appIconId} size={36} />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-bold leading-tight">WorkNeat</div>
          <div className="truncate text-xs text-muted">
            {runtime.displays.length} {runtime.displays.length === 1 ? "display" : "displays"} connected
          </div>
        </div>
      </div>

      <TextField aria-label="Search layouts" className="w-full" value={query} onChange={setQuery}>
        <div className="relative w-full">
          <Search
            size={15}
            className="pointer-events-none absolute left-2.5 top-1/2 z-10 -translate-y-1/2 text-muted"
          />
          <Input placeholder="Search layouts" className="w-full pl-8" />
        </div>
      </TextField>

      <div className="flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wide text-muted">
        <span>Layouts</span>
        <Tooltip delay={300}>
          <Button isIconOnly size="sm" variant="tertiary" aria-label="Create layout" onPress={onCreateProfile}>
            <Plus size={16} />
          </Button>
          <Tooltip.Content showArrow>
            <Tooltip.Arrow />
            New layout
          </Tooltip.Content>
        </Tooltip>
      </div>

      <ScrollShadow hideScrollBar className="-mx-1 min-h-0 flex-1 px-1">
        {filteredProfiles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-3 py-4 text-xs text-muted">
            No layouts match “{query}”.
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {filteredProfiles.map((profile) => {
              const isActive = profile.id === activeProfileId;

              return (
                <div
                  key={profile.id}
                  className={[
                    "group flex items-center gap-1 rounded-lg pr-1 transition-colors",
                    isActive ? "bg-surface shadow-surface" : "hover:bg-surface-secondary",
                  ].join(" ")}
                >
                  <button
                    type="button"
                    aria-current={isActive ? "page" : undefined}
                    className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left"
                    onClick={() => onSelectProfile(profile.id)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{profile.name}</span>
                      <span className="block text-xs text-muted">
                        {profile.appRules.length} {profile.appRules.length === 1 ? "app" : "apps"}
                      </span>
                    </span>
                    {profile.hotkey ? (
                      <Chip size="sm" variant="secondary">
                        <Chip.Label>{profile.hotkey}</Chip.Label>
                      </Chip>
                    ) : null}
                  </button>

                  {canDelete ? (
                    <Tooltip delay={400}>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="danger-soft"
                        aria-label={`Delete ${profile.name}`}
                        className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                        onPress={() => onDeleteProfile(profile.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                      <Tooltip.Content showArrow>
                        <Tooltip.Arrow />
                        Delete layout
                      </Tooltip.Content>
                    </Tooltip>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </ScrollShadow>

      <div className="flex flex-col gap-3">
        <Separator />
        <div className="flex flex-col gap-1.5 px-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Displays</span>
          {runtime.displays.map((display) => (
            <div key={display.identity.id} className="flex items-center justify-between gap-3 text-xs">
              <span className="truncate text-foreground">{display.identity.name}</span>
              <span className="shrink-0 tabular-nums text-muted">
                {display.nativeFrame.width} × {display.nativeFrame.height}
              </span>
            </div>
          ))}
        </div>
        <Button variant="secondary" fullWidth onPress={onOpenSettings}>
          <Settings size={16} />
          Settings
          <span className="ml-auto text-xs text-muted">⌘,</span>
        </Button>
      </div>
    </aside>
  );
}
