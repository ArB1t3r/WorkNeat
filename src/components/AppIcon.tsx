import type { AppIconId } from "../types/layout";

export const appIconOptions: Array<{ id: AppIconId; label: string }> = [
  { id: "display", label: "Display" },
  { id: "tiles", label: "Tiles" },
  { id: "layers", label: "Layers" },
  { id: "focus", label: "Focus" },
];

interface AppIconMarkProps {
  id: AppIconId;
  size?: number;
}

export function AppIconMark({ id, size = 36 }: AppIconMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className="app-icon-svg"
      fill="none"
      height={size}
      viewBox="0 0 48 48"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="4" y="4" width="40" height="40" rx="10" fill="#0c7069" />
      {id === "display" ? (
        <>
          <rect x="11" y="15" width="24" height="5" rx="2.5" fill="#eef9f6" />
          <rect x="14" y="23" width="24" height="5" rx="2.5" fill="#d8eee9" />
          <rect x="11" y="31" width="24" height="5" rx="2.5" fill="#eef9f6" />
          <circle cx="36" cy="17.5" r="2.5" fill="#a8dbd1" />
          <circle cx="12" cy="25.5" r="2.5" fill="#a8dbd1" />
          <circle cx="36" cy="33.5" r="2.5" fill="#a8dbd1" />
        </>
      ) : null}
      {id === "tiles" ? (
        <>
          <rect x="12" y="14" width="24" height="5" rx="2.5" fill="#eef9f6" />
          <rect x="12" y="23" width="18" height="5" rx="2.5" fill="#d8eee9" />
          <rect x="12" y="32" width="24" height="5" rx="2.5" fill="#eef9f6" />
        </>
      ) : null}
      {id === "layers" ? (
        <>
          <rect x="14" y="14" width="20" height="6" rx="3" fill="#eef9f6" />
          <rect x="18" y="23" width="20" height="6" rx="3" fill="#d8eee9" />
          <rect x="10" y="32" width="20" height="6" rx="3" fill="#eef9f6" />
        </>
      ) : null}
      {id === "focus" ? (
        <>
          <circle cx="24" cy="24" r="11" stroke="#eef9f6" strokeWidth="4" />
          <circle cx="24" cy="24" r="3" fill="#a8dbd1" />
        </>
      ) : null}
    </svg>
  );
}
