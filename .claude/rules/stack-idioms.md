# Stack idioms for this repository

Rules found while building the web tune editor (`web/`) and the shared `@seven-tree/hydra` package.
Each rule is a verified behaviour of the versions pinned in `package-lock.json`, not a preference.

## Toolchain

- Use Node 24 (`.nvmrc`). Vitest 5, jsdom 30 and `@testing-library/jest-dom` 7 refuse Node 20.
- npm 11 holds back package install scripts until you approve them. It holds back `unrs-resolver`
  and `fsevents` here. Lint, tests and the build work without them.
- Run `npm install` from the repo root only. The root `package.json` is an npm workspace for
  `packages/*` and `web`.
- Bun is used only for `tools/` (`bun tools/hcf.ts`, `npm run build`). Bun resolves imports from the
  script's folder, not from the current directory.

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

## React 19

- Provide context with `<MyContext value={...}>` and read it with `use(MyContext)`.
- The React Compiler is on. Do not add `useMemo` or `useCallback` for performance.
- Use `useTransition` for async work after the user acts (the `.hcf` write).
- Call `showSaveFilePicker` (through `chooseSaveTarget` in `web/src/lib/save-file.ts`) before any
  other `await` in the click handler. The browser opens the save dialog only while the click still
  counts as a user action.

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
- Install Playwright browsers with `PLAYWRIGHT_SKIP_BROWSER_GC=1`. Without it, `playwright install`
  deletes browser builds that other Playwright installs on the machine still use.

## Structure

- `packages/hydra` is pure TypeScript with no Node APIs: it runs in the browser. Only its tests use
  `node:fs`. Its `exports` point at `.ts` source; there is no build step.
- In `web/src/features/<feature>/`:
  - `components/` take props only and do not import `@seven-tree/hydra`.
  - `sections/` connect the editor state to the components.
  - `state/` holds a pure reducer, selectors, and the file decode and build functions.
- Server-only code lives in `web/src/features/library` and `web/src/app/api`.

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
  3rd and overdrive. `findShiftOverlaps` reports any throttle range where a downshift reaches its
  upshift.
- The server route fetches only names that are in Power Hungry's current index. Never build a URL
  from user input.
