# UI System

WorkNeat's product interface is built with **HeroUI Pro (v3)**.

## Current status (2026-06-29)

- The app uses `@heroui-pro/react` (Pro) on top of `@heroui/react` + `@heroui/styles` (v3), React 19, and Tailwind CSS v4.
- Pro components in use: `Sheet` (the unified Settings panel) and `Segment` (segmented controls, e.g. the theme switch). The rest of the UI uses HeroUI v3 base components (Button, TextField, Switch, Select, Tabs, Slider, Chip, Tooltip, Separator, ScrollShadow, ListBox, Card, Toast).
- No `<HeroUIProvider>` — v3 works without a provider. Toasts require a single `<Toast.Provider />` mounted in `main.tsx`.
- Styles are imported in `src/styles.css` in order: `tailwindcss` → `@heroui/styles` → `@heroui-pro/react/css`, followed by a teal-accent override and the bespoke (token-driven) canvas styles.
- Theming uses HeroUI's CSS-variable system; light/dark is toggled via the `class` + `data-theme` attributes on `<html>` (see `src/lib/theme.ts`).

## Tooling

- **MCP:** the `heroui-pro` server (`https://mcp.heroui.pro/mcp`) is the source of truth for component APIs, CSS, and theme variables. Always `list_components` → `get_component_docs` before building.
- **Skills:** the official `heroui-react-pro` and `heroui-pro-design-taste` skills are installed for v3 conventions and design taste.
- **Auth:** Pro packages install via the CLI with `HEROUI_AUTH_TOKEN` (CI/CD token); the MCP/skills use the personal token.

## Migration note

This replaced the previous local compatibility shim (`src/components/heroui.ts`) that pointed at the public `@heroui/react` v2 package. Adopting Pro required a one-shot migration: React 18→19, Tailwind v3→v4 (now via `@tailwindcss/vite`, no `tailwind.config.ts`/`postcss.config.js`), HeroUI v2→v3, and rewriting every component to the v3 compound API.
