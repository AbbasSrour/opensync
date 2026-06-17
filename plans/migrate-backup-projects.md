# Migrate backup projects into the monorepo

## Goal

Migrate the two projects under `backup/` into the `vite-plus` monorepo, aligned with
repo conventions (`vp` toolchain, workspaces, catalog deps):

1. `backup/opensync` → the OpenSync React website (SPA) **+** its Convex backend **+** its Mintlify docs.
2. `backup/opencode-sync-plugin` → the published npm plugin/CLI.

## Agreed decisions

| Decision         | Choice                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------- |
| Website build    | **Adopt vite-plus** (`vp dev` / `vp build`) with `@vitejs/plugin-react` in `vite.config.ts` |
| Convex backend   | **Dedicated package** `packages/convex` (exports generated API/types)                       |
| Plugin build     | **Convert to `vp pack`** (tsdown-based, multi-entry + CLI bin)                              |
| Plugin placement | **`plugins/opencode-sync-plugin`** (top-level plugins workspace folder)                     |
| Docs placement   | **`apps/docs`** (Mintlify site; deploys separately)                                         |
| Sync scripts     | **With Convex package** (`packages/convex`, since they write Convex tables)                 |

## Grounding notes (verified)

- `vp dev`/`vp build` run standard Vite; `vite.config.ts` accepts normal Vite `plugins`/`resolve.alias`.
  So `@vitejs/plugin-react` + the `@ → ./src` alias port over directly.
- `vp pack` forwards to **tsdown**, supports an `entry` array, `dts`, multiple formats, and CLI/`exe`.
  Covers the plugin's 3 entries (`index`, `cli`, `config`) + `bin`.
- The website imports the Convex API via **relative paths** in ~10 files
  (`../../convex/_generated/api`, `.../dataModel`). Moving Convex to a package
  means rewiring all these imports + exporting `_generated` from the Convex package.
- Docs are **Mintlify** (`docs.json` + `mint.json` + 34 `.mdx`), deployed standalone at
  `docs.opensync.dev`. The app's `/docs` route just redirects there.
- **Docs→Convex search is dead scaffolding** (verified by exhaustive search):
  `scripts/sync-docs.ts` is a stub (`// TODO: Add actual Convex sync`, never writes Convex);
  `scripts/build-search-index.ts` emits `src/search-index.json` that is never imported and
  not present on disk; `docPages`/`docEmbeddings` tables appear only in `schema.ts`;
  `fuse.js` has zero usages. Decision: carry forward unchanged, clearly labeled.
- Convex has its own lifecycle (`convex dev`/`convex deploy`, generated `_generated/`).
  It does NOT build through `vp`/Vite — those scripts stay as-is.
- **Tooling is driven through `vp`**. Workspaces + catalog live in root
  `package.json` (`workspaces.packages` = `apps/*` `packages/*` `plugins/*` `tools/*`,
  `workspaces.catalog`). `workspace:*` and `catalog:` protocols are supported.
- Plugin ships its own lockfile — remove it; the monorepo root lockfile covers all workspace packages.
- TS version: catalog pins `typescript: ^5`; both backups use 5.3 — **aligned, no drift**.

## Resolved questions

1. **Tailwind** → **Upgrade v3 → v4** using `@tailwindcss/vite` (not PostCSS). This is a
   major-version migration, scoped as a dedicated sub-effort in Phase 2 with its own
   verification (CSS-first `@theme`, `@tailwindcss/typography` v4 compat, revalidate the
   custom HSL-variable theme across all components, visual check).
2. **Docs/search pipeline** → **Carry everything forward.** Confirmed (exhaustive search)
   that this is all non-functional scaffolding: the app's `/docs` route redirects to the
   external Mintlify site (`docs.opensync.dev`); `docPages`/`docEmbeddings` are referenced
   only in `schema.ts`; `fuse.js` has zero usages; `search-index.json` is never generated
   or imported; `sync-docs.ts` is a stub (`// TODO: Add actual Convex sync`). Migrate it
   all unchanged, clearly labeled as scaffolding.
3. **Deploy config** → **Keep both** `netlify.toml` + `vercel.json` inside `apps/website/`
   with app-local build/publish paths. Docs deploy via Mintlify (`docs.opensync.dev`) from
   `apps/docs/`.
4. **Convex env** → Frontend vars `VITE_CONVEX_URL`, `VITE_WORKOS_CLIENT_ID`,
   `VITE_REDIRECT_URI` via app `.env`; server vars (`OPENAI_API_KEY`, `WORKOS_CLIENT_ID`)
   set in the Convex dashboard. Convex keeps its own deploy lifecycle.
5. **TypeScript** → Resolved: catalog now pins `typescript: ^5`, matching both backups
   (5.3). No version drift; use `catalog:` for TS in each package.
6. **Convex package name** → `@opensync/convex` (scoped, internal-only, never published).
7. **Convex `_generated`** → keep committed (matches backup `.gitignore`, which ignores
   `.convex/`/`dist/` but not `_generated/`). Lets the website typecheck without first
   running Convex codegen.

## Target structure

```
apps/
  website/        # React SPA (vp dev/build, vite + react plugin, Tailwind/PostCSS)
  docs/           # Mintlify docs (docs.json, mint.json, *.mdx) — standalone deploy
packages/
  convex/         # @opensync/convex — Convex source in src/ (plus convex -> src symlink for CLI)
plugins/
  opencode-sync-plugin/ # published npm plugin/CLI (vp pack)
```

## Work breakdown

### Phase 0 — Prep & baseline

- [ ] Run `vp install` and confirm a clean baseline (`vp check` on current repo).
- [ ] Decide catalog additions: react, react-dom, vite plugin-react, tailwind, convex,
      workos, radix, etc. Add shared/runtime-critical deps to `workspaces.catalog` in root
      `package.json` where it makes sense; keep app-specific deps local.

### Phase 1 — Convex package (`packages/convex`)

- [x] Create `packages/convex` with `package.json` (name `@opensync/convex`),
      `type: module`, exports for the Convex generated API + dataModel.
- [x] Move `backup/opensync/convex/**` → `packages/convex/src/` (keep `_generated`,
      `convex.config.ts`, `schema.ts`, all functions, `tsconfig.json`).
- [x] Move `scripts/sync-docs.ts` + `scripts/build-search-index.ts` → `packages/convex`.
      NOTE: these are non-functional stubs (see Resolved Q2); migrate as-is and add a
      header comment marking them as unwired scaffolding.
- [x] Add scripts: `convex` (`convex dev`), `convex:deploy`, `sync:docs`, `sync:docs:prod`,
      `build:search-index` — wired through `vp run` where appropriate.
- [x] Add a package entry that re-exports `src/_generated/api` + `dataModel` so the
      website imports `@opensync/convex` instead of relative `../../convex/...`.
- [x] Reconcile deps (convex, @convex-dev/\*, @workos-inc/node, @ai-sdk/openai, glob,
      gray-matter, tsx) into the package; use catalog where shared.
- [ ] Verify: `convex` typecheck passes; generated API resolves.

### Phase 2 — Website app (`apps/website`)

- [x] Remove the vanilla-TS starter (`counter.ts`, `main.ts`, `style.css`, starter assets).
- [x] Move `backup/opensync/src/**` → `apps/website/src/`, `index.html`, `public/`,
      `index.css`.
- [x] Create `apps/website/vite.config.ts` with `@vitejs/plugin-react`, `@tailwindcss/vite`,
      and `@ → ./src` alias (port from backup `vite.config.ts`, add Tailwind v4 plugin).
- [x] Update `index.html` script entry (`/src/main.tsx`) and `#root` mount.
- [x] Rewrite all `../../convex/_generated/...` imports (~10 files) to `@opensync/convex`.
- [x] Add `@opensync/convex` as a workspace dependency (`workspace:*`).
- [x] Update `package.json` scripts: `dev: vp dev`, `build: tsc && vp build`,
      `preview: vp preview` (match existing repo pattern); reconcile all runtime deps
      (react, react-dom, react-router-dom, radix, workos authkit/widgets, convex, lucide,
      fuse.js, html2canvas, react-markdown, syntax-highlighter, clsx, cva, tailwind-merge).
- [x] Update `tsconfig.json` for React (jsx, DOM libs, `@/*` paths) — base on backup's
      but align with repo style; resolve TS 6.x concerns.
- [ ] Carry over env handling (`VITE_CONVEX_URL`, `VITE_WORKOS_CLIENT_ID`,
      `VITE_REDIRECT_URI`) — add `.env.example`.
- [x] Carry over deploy config into `apps/website/`: `netlify.toml` + `vercel.json` with
      app-local build/publish paths.
- [ ] Verify: `cd apps/website && vp dev` boots; `vp build` produces SPA output.

#### Phase 2b — Tailwind v3 → v4 upgrade (sub-effort)

- [x] Add `@tailwindcss/vite` (v4) + wire plugin into `vite.config.ts`; remove
      `postcss.config.js` + `autoprefixer` (v4 handles this).
- [x] Migrate `tailwind.config.js` theme to v4 CSS-first `@theme` in `index.css`
      (or keep JS config via v4 compat) — port the HSL CSS-variable color tokens,
      `borderRadius`, and `darkMode: class` behavior.
- [x] Update `@tailwindcss/typography` to its v4-compatible version + integration.
- [ ] Run codemod (`npx @tailwindcss/upgrade`) if helpful, then manually verify.
- [ ] Verify: build succeeds; visual check of dashboard, docs-themed pages, modals,
      badges (source colors in `lib/source.ts`), and dark/tan themes — no regressions.

### Phase 3 — Docs app (`apps/docs`)

- [x] Move `backup/opensync/docs/**` → `apps/docs/` (docs.json, mint.json, \*.mdx, logos, favicon).
- [x] Add minimal `package.json` for the docs app (Mintlify dev/build via `mintlify` CLI,
      run through `vp run` or `vp dlx mintlify`).
- [x] Update `packages/convex` `sync-docs` + `build-search-index` stubs to point at
      `apps/docs` as source dir (was `process.cwd()/docs`) — even though non-functional,
      keep paths correct.
- [ ] Verify: Mintlify dev serves.

### Phase 4 — Plugin workspace (`plugins/opencode-sync-plugin`)

- [ ] Move `backup/opencode-sync-plugin/src/**` + `package.json` + `README`/`changelog`.
- [ ] Delete the plugin's redundant package-manager lockfile; root install covers workspace packages.
- [ ] Replace tsup build with `vp pack`: add `vite.config.ts` with `pack: { entry: [...],
dts: { tsgo: true }, format: ['esm'] }` covering `index.ts`, `cli.ts`, `config.ts`
      (tsgo dts via `@typescript/native-preview`).
- [ ] Add `@typescript/native-preview` devDep (tsgo).
- [ ] Keep `bin: { opencode-sync: dist/cli.js }`, `exports`, peer dep `@opencode-ai/plugin`.
- [ ] Update scripts: `build: vp pack`, `dev: vp pack --watch`.
- [ ] Note: source uses `.js` import specifiers (`./config.js`) — confirm tsdown output
      keeps these resolving (NodeNext/bundler).
- [ ] Reconcile deps (@opencode-ai/plugin, @types/node, typescript, @typescript/native-preview)
      to catalog where shared.
- [ ] Verify: `vp run <plugin>#build` emits dist with dts + working CLI shebang.

### Phase 5 — Repo wiring & cleanup

- [ ] Update root `vite.config.ts` lint/fmt `overrides` for React (`apps/website/**`),
      node (`packages/convex/**` scripts), and ignore `src/_generated`.
- [ ] Update root `package.json` scripts as needed (`dev`, `ready`).
- [ ] Port relevant root metadata (LICENSE, README updates, `.env.example`).
- [ ] Remove `backup/` once migration verified (or keep until sign-off).
- [ ] Final verification: `vp install`, `vp check`, `vp run -r build`, `vp run -r test`.

## Status

- Planning complete; all open questions resolved. Awaiting go-ahead to start Phase 0/1.
