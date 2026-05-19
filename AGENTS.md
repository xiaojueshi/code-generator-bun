# AGENTS.md — Code Generator (Bun + ElysiaJS)

## Commands

| Action | Command |
|--------|---------|
| Install | `bun install` |
| Dev server (hot reload) | `bun run dev` (expands to `bun run --watch src/index.ts`) |
| Build all platforms | `bun run build` |
| Build single platform | `bun run build:win` / `build:linux` / `bun run build:mac` / `bun run build:mac-x64` |

No test runner, linter, formatter, typechecker, or CI is configured. `bun run test` is a placeholder. The only verification is `bun run dev` (hot-reload server).

## Architecture

- **Runtime**: Bun (not Node.js). Uses Bun SQL for MySQL/PostgreSQL/SQLite; `dmdb` npm package for DMDB 8.
- **Web framework**: ElysiaJS v1.4 with `@elysiajs/html` (TSX SSR) and `@elysiajs/cors`. Note: `@elysiajs/static` is listed in `package.json` but unused — static files are served in-memory.
- **Code generation**: Handlebars templates → preview JSON or ZIP via JSZip.
- **Frontend**: Vanilla JS + CSS (no framework). SPA served via SSR layout.
- **Local storage**: SQLite (`data.sqlite`) for connection configs and templates. Created at runtime, gitignored.

## Key Files

| Path | Purpose |
|------|---------|
| `src/index.ts` | Entry point. Initializes local DB, loads saved connections, seeds default templates, registers routes, listens on port 3000 |
| `src/database/local.ts` | SQLite persistence (connections, template_groups, templates tables) |
| `src/database/connector.ts` | Remote DB manager. **Short-connection pattern**: creates connection per operation, closes immediately after. Handles MySQL/PostgreSQL/SQLite via Bun SQL, DMDB via `dmdb` |
| `src/routes/database.ts` | `/api/database/*` — data source CRUD |
| `src/routes/generator.ts` | `/api/generator/*` — preview and ZIP generation |
| `src/routes/template.ts` | `/api/template/*` — template and group management |
| `src/utils/template.ts` | Handlebars compilation, default template seeding |
| `src/utils/stringUtils.ts` | String cleaning utilities |
| `src/pages/layout.tsx` | Shared HTML layout (head, nav tabs, toast container) |
| `src/pages/index.tsx` | Full SPA page (all tabs, modals) via TSX |
| `src/public/app.js` | Frontend interaction logic |
| `src/public/style.css` | Dark glassmorphism theme |
| `src/templates/*.hbs` | Default Handlebars templates (6 files) |
| `src/assets.d.ts` | Type declarations for `.hbs`, `.css`, `.js` text imports |

## Important Notes

- **Static files are inlined**: `app.js` and `style.css` are imported as text in `index.ts` with `with { type: "text" }` so they embed into compiled binaries. Don't serve them from disk in production.
- **DMDB uses `require()`**: The `dmdb` package is loaded via CommonJS `require()` inside async functions, not ESM `import`. This is intentional — `dmdb` is a native Node.js addon.
- **Database connections are ephemeral**: Every `listTables`, `getTableInfo`, `listDatabases` call creates a new connection and closes it in a `finally` block. No connection pooling.
- **DMDB timeouts**: 10s connect, 30s query. Wrapped via `withTimeout()`.
- **Template variables**: `tableName`, `tableComment`, `fieldsList` (array of column objects). See `src/types/index.ts` for full shape.
- **Handlebars `{{#raw}}`**: Used in templates to avoid Vue `{{ }}` syntax conflicts.
- **JSX config**: Uses `@kitajs/html` — `jsxFactory: "Html.createElement"`, not React. Don't import React.
- **Build targets**: Cross-compilation via `bun build --compile --target=...`. Outputs to `dist/`.
- **bun.lock uses a private npm registry** (`http://172.16.1.148:40087/repository/npm/`). `bun install` may fail outside the internal network without registry configuration.

## Conventions

- TypeScript with strict mode. `noEmit: true` — Bun handles execution directly.
- `allowImportingTsExtensions: true` — imports include `.ts` extension.
- All route modules export named constants (e.g., `databaseRoutes`) consumed via `.use()` in `index.ts`.
- Chinese UI text and comments throughout. Keep consistency.
