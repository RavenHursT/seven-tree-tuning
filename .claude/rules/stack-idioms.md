# Stack idioms for this repository

Rules found while building the web tune editor (`web/`) and the shared `@seven-tree/hydra` package.
Each rule is a verified behaviour of the versions pinned in `package-lock.json`, not a preference.

## Toolchain

- Use Node 24 (`.nvmrc`). Vitest 5, jsdom 30 and `@testing-library/jest-dom` 7 refuse Node 20.
- npm 11 holds back package install scripts until you approve them. It holds back `unrs-resolver`
  and `fsevents` here. Lint, tests and the build work without them.
- Run `npm install` from the repo root only. The root `package.json` is an npm workspace for
  `packages/*` and `web`.
- Bun runs and compiles `tools/` (`bun tools/hcf.ts`, `npm run build`). The tools import
  `packages/hydra/src` by relative path, so they work in a checkout without `npm install`.
  `packages/hydra/src/tools-import.test.ts` fails if a tool switches to the package name.
- Bun resolves a script's imports from the script's folder, not from the current directory.
- `import.meta.main` is true for a script Bun runs directly and undefined under Vitest, so a tool
  can export its functions for tests and still run as a command.
- `next dev` writes to `web/.next/dev` and `next build` to `web/.next`, so both can run at once.
- While agents edit the worktree, run the owner's dev server from a separate snapshot worktree
  (detached at the last commit). A half-finished edit otherwise shows the owner a build error.

## Next.js 16.4

- Before you write Next.js code, read the guide for it in `node_modules/next/dist/docs/`. The APIs
  differ from older versions. `web/AGENTS.md` is Next's own note on this, and `web/CLAUDE.md`
  imports it. `next dev` rewrites `web/AGENTS.md`; commit the result.
- Turbopack transpiles npm workspace packages by itself. Do not add `@seven-tree/hydra` to
  `transpilePackages`.
- Cache Components are on (`cacheComponents: true`):
  - Put `"use cache"` in a helper function, not in a route handler body.
  - `cacheLife()` takes one profile literal per call. Branch to two calls; a ternary of two profile
    names does not type-check.
  - Cache a failed upstream fetch for seconds (`cacheLife("seconds")`). A cache that expires in
    under 5 minutes stays out of the prerendered page and runs at request time.
  - Call a cached data function from a Server Component inside `<Suspense>`. Do not use
    `connection()` for async I/O inside `"use cache"`.
  - The route segment exports `dynamic`, `dynamicParams`, `revalidate` and `fetchCache` do not exist
    with Cache Components (removed in 16.0).
- In a route handler, `await params`. That makes the handler run per request.
- `import "server-only"` needs no package: Next aliases it. Vitest does not, so mock it in tests:
  `vi.mock("server-only", () => ({}))` and `vi.mock("next/cache", () => ({ cacheLife: vi.fn() }))`.
- A Server Component that renders a Phosphor icon imports it from `@phosphor-icons/react/ssr`.
- `LayoutProps` and `RouteContext` come from types that Next generates. Type-check with
  `next typegen && tsc --noEmit` (the `typecheck` script); plain `tsc` fails on a clean checkout.
- Security headers go in `headers()` in `next.config.ts`. A policy with `connect-src 'self'` and no
  `script-src` works with Next's inline scripts and blocks every request to another origin.

## React 19

- Provide context with `<MyContext value={...}>` and read it with `use(MyContext)`.
- The React Compiler is on. Do not add `useMemo` or `useCallback` for performance.
- Use `useTransition` for async work after the user acts (the `.hcf` write).
- Build the file first, then call `showSaveFilePicker` (through `chooseSaveTarget` in
  `web/src/lib/save-file.ts`) before any other `await` in the click handler. The browser opens the
  save dialog only while the click still counts as a user action. A failed write must call
  `abort()` on the writable, or an empty file stays on disk.
- Check a dropped file's name and size before `file.arrayBuffer()`. A drop is not filtered by the
  input's `accept`, and a read can reject.

## shadcn/ui 4 and Tailwind CSS 4

- `shadcn init` defaults to Base UI. For Radix, pass `--base radix --preset <style>`. The styles are
  nova, vega, maia, lyra, mira, luma, sera and rhea. This repo uses lyra.
- Run the shadcn CLI from one process at a time. It rewrites `components.json` and `globals.css`.
- Compose the components in `web/src/components/ui`. Do not edit them.
- The components import `cn` from the `cn` package and primitives from the unified `radix-ui`
  package. Lyra uses Phosphor icons, named with an `Icon` suffix.
- Theme tokens live in `web/src/app/globals.css`. A new token needs a `--name` value in `:root` and
  `.dark`, and a `--color-name` entry in `@theme inline`.
- For a number that the user edits, use `inputMode="decimal"`, not `type="number"`. Keep the typed
  text while the field has focus, commit each valid number, and show the stored value again on blur.
  `NumberField` in `web/src/features/tune-editor/components` does this.
- Do not unmount or natively disable a button that can have focus (Reset, Generate). Use
  `aria-disabled="true"` and ignore clicks, or keyboard focus falls to `<body>`.
- Give each repeated button its own accessible name ("Reset 3→4 (overdrive)").
- Render a live region (`role="status"`) before its text arrives. Many screen readers ignore a live
  region that is inserted together with its text.
- A sticky bar at the bottom of the window needs `scroll-padding-bottom` on `html`, so a focused
  field is never scrolled under it.
- Radix `CollapsibleContent` unmounts its children while it is closed. Keep every edited value in
  the reducer, not only in a field, so a module opens again with its values. The collapse tests in
  `tune-editor.test.tsx` check this for each module.

## Tests

- Vite 8 resolves tsconfig paths itself: `resolve: { tsconfigPaths: true }`. Do not add
  `vite-tsconfig-paths`.
- The root `vitest.config.ts` lists both projects in `test.projects`. Each project has its own
  `defineProject` config.
- `web` tests run in jsdom. A server-side test starts with `// @vitest-environment node`.
- `web/vitest.setup.ts` adds no-op `ResizeObserver`, `scrollIntoView`, pointer capture and
  `matchMedia` for Radix and next-themes. Keep those shims inside `if (typeof window !== "undefined")`.
- Do not compare two large `Uint8Array`s with `toEqual`. The diff of two unequal 256 KiB arrays
  blocks the worker for minutes. Use `expectSameBytes` from `packages/hydra/src/container/test-support.ts`.
- Build test images with `buildTde1Image()` from `@seven-tree/hydra/testing`. It holds the real
  Daily Driver curves over a patterned background, so a stray write shows up.
- A `.hcf` carries only the four banks. The 8 KiB gaps at `0x00000`, `0x10000`, `0x20000` and
  `0x30000` always decode to `0xFF`. Compare an output with the decoded input, not with the raw
  fixture.
- jest-dom's `toBeDisabled` checks only the `disabled` attribute. For an `aria-disabled` button,
  assert `toHaveAttribute("aria-disabled", "true")`. Playwright's `toBeDisabled` checks both.
- cmdk (the shadcn `command` list) keeps a group with no matches mounted but `hidden`. Assert
  `not.toBeVisible()`, not absence. Its `defaultValue` highlights and scrolls to the chosen item.
- jsdom drops the text of an element that names itself through `aria-labelledby`. Build a trigger's
  accessible name from the label and an inner span instead.
- Install Playwright browsers with `PLAYWRIGHT_SKIP_BROWSER_GC=1`. Without it, `playwright install`
  deletes browser builds that other Playwright installs on the machine still use.
- Playwright 1.64 loads the workspace package's TypeScript source, extension-less imports included.
  Import `@seven-tree/hydra` and `@seven-tree/hydra/testing` in e2e tests directly.
- In e2e tests, do not wait on React internals such as `__reactProps$` keys. React 19 keeps text
  typed and files chosen before it attaches to server-rendered fields.
- Name a Playwright fixture's callback parameter `provide`, not `use`. The React hooks lint rule
  treats any call named `use` as a hook.
- In the Chromium e2e run, delete `window.showSaveFilePicker` with `page.addInitScript` so Generate
  Tune takes the download path; headless runs cannot drive the native save dialog.
- The e2e test "fits each shift curve table in its card" fails when a curve table scrolls sideways
  in the 1280 px test window. Run it after any change to the curve table layout or field widths.

## Structure

- `packages/hydra` is pure TypeScript with no Node APIs: it runs in the browser. Only its tests use
  `node:fs`. Its `exports` point at `.ts` source; there is no build step.
- In `web/src/features/<feature>/`:
  - `components/` take props only and do not import `@seven-tree/hydra`.
  - `sections/` connect the editor state to the components.
  - `state/` holds a pure reducer, selectors, and the file decode and build functions.
- Server-only code lives in `web/src/features/library` and `web/src/app/api`.
- The page is a set of collapsible modules (`CollapsibleModule`). A value that is set belongs inside
  its module and in the module's collapsed summary; the open tune shows in Base Tune.
- `TuneStatus` (loading messages and alerts) sits outside every module, so collapsing a module
  never hides an alert.

## Hydra domain rules

- Never write the chip serial into the repo: not in code, tests, fixtures, docs or scratch files that
  stay. Tests read it from `HYDRA_CHIP_SERIAL` and skip without it.
- Never commit decrypted images or Power Hungry's `.efu` files. Tests that need them read
  `HYDRA_EFU_DIR`.
- A decrypted `.hcf` ends in `08` × 8. Any other trailer means the serial is wrong.
- The six TDE1 shift curves start at `0x14521`, `0x14579`, `0x145d1` (upshifts) and `0x145f9`,
  `0x14621`, `0x14649` (downshifts). Breakpoint `i` has its throttle byte at `offset - 1 + 2i` and its
  speed byte (mph × 2) at `offset + 2i`.
- Entries after the first throttle-0 point are padding. When the closed-throttle point changes,
  write the same value into the padding.
- The warm idle is the two `uint16` words at `0x124a6` and `0x124aa`, rpm × 4. The rest of the idle
  curve at `0x124a4` is read-only.
- Write tune changes only through `writeTuneValues`. It refuses any byte outside the 60 speed bytes
  and the 4 idle bytes.
- Scale upshifts and downshifts together. Scaling only the upshifts made the truck hunt between
  3rd and overdrive. `findShiftOverlaps` reports any throttle range where a downshift is above its
  upshift. Equal speeds do not count: Power Hungry ships equal 1→2 and 2→1 speeds at light throttle
  in 26 of its 35 TDE1 library tunes.
- The server route fetches only names that are in Power Hungry's current index. Never build a URL
  from user input.

## Vercel

- The project's settings (root directory `web`, Next.js, Node 24.x, files outside the root directory
  included) live in Vercel, not in a `vercel.json`. Change them with
  `npx vercel api /v9/projects/<id> -X PATCH --input - --scope lurchbulldog-3827s-projects`, which
  uses the Vercel CLI login and keeps the token out of commands.
- A `vck_…` key is an AI Gateway key. It cannot create or change projects.
- A new project promotes its first deployment to production, whatever branch it came from.
- Previews sit behind Vercel's Standard Protection. `npx vercel curl <url>` fetches one with the CLI
  login; a plain request gets a 302 to the Vercel login.
- Linking a GitHub repository needs the Vercel GitHub App installed on the account. No API installs it.
