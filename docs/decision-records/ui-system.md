# UI System

WorkNeat is intended to use HeroUI Pro components for the product interface.

Current status:

- The project uses a local compatibility export at `src/components/heroui.ts`.
- That compatibility layer currently points to the public `@heroui/react` package.
- `npm view @heroui/pro version` returned 404 on June 26, 2026, so HeroUI Pro does not appear to be a public npm package under that name.
- No HeroUI Pro MCP resource or tool is visible in the current Codex MCP/tool list.

When the HeroUI Pro MCP, registry, or source bundle is available, replace the exports in `src/components/heroui.ts` or add generated Pro components behind the same local import boundary.
