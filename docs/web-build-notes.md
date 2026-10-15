# Current evidence — 2026-10-15

See [current QA report](web-qa-2026-10-15.md). The initial authentication blocker below is historical and no longer blocks execution. All 38 engines have been rebuilt; strict checks, extended history/persistence tests, touch/zoom and production retained-memory audit now run. Release remains gated by the explicit remaining items in `web/release-status.json`.

---

# Puzzle Studio — implementation evidence

Date: 2026-10-08 (Asia/Bangkok). Scope source: `web-implementation-plan.md`. **v1 DoD is not met.**

## Verified toolchain and inventory

- Repository branch and remote HEAD: `master`; origin `DuongMinhHoang1008/puzzles`.
- Node 24.19.0, npm 12.0.2; Git for Windows Perl 5.36.1.
- Emscripten 4.0.20 installed inside ignored `build/web/emsdk`, pinned SDK repository commit `b44154299bdefe75ba287874bb63fc9806243771`.
- Python is the SDK/bundled runtime, not the Windows Store alias.
- Release inventory: 38 games; `nullgame` excluded. The actual targets and object definitions are read from `mkfiles.pl` output, not maintained as a hand-written linker graph.
- Last completed full compile: build ID `260f5c337b89cad7`, 38 WASM binaries, total **3,676,204 bytes**. Generated binaries are ignored, not committed.

## Implementation decisions

- Keep the existing frontend C file and replace deprecated browser glue with instance-scoped `Module.webHost` callbacks. Native/iOS entry points remain untouched. Conditional semantic hooks in Net/Light Up exist only under `__EMSCRIPTEN__`.
- ESM factories use `MODULARIZE`, `EXPORT_ES6`, single-thread WASM, memory growth and assertions. `HEAPU8` must be explicitly exported with this SDK; omitting it caused the initial save test to fail.
- `PuzzleSession` separates chrome from raw pointers/module lifetime. The router owns one player; the player owns one module, input adapter, save controller and feedback controllers. Late module loads are discarded when their session is disposed.
- Revision counters increment at actual history mutation sites in midend. UI-only redraw has a separate counter. `midend_process_key` return values are never treated as move acceptance.
- Save bytes are copied out of WASM before memory growth/free. IndexedDB stores versioned envelopes; settings/favorites use LocalStorage. Failed restoration keeps stored data and requires an explicit choice to start fresh.
- Fixed the inherited deserializer's 1-based history-position bound and added reader/record/history bounds. These are shared correctness fixes, not changes to gameplay rules.
- Canvas renderer preserves offscreen drawing, clipping, dirty-region copy and blitters with DPR-scaled backing stores. Input uses logical coordinates. Resizing changes tile size without Undo/Redo or new-game side effects.
- Native animations remain owned by C. Net feedback reads actual connected cells in displayed coordinates; Light Up reads illumination, bulbs and overlap state, with black cells excluded. WAAPI overlays and WebAudio are owned/disposed by controllers. Audio is off by default.
- Pilot palette mapping uses engine colour indices, preserving semantic roles. Other games currently retain their native board palette while chrome supports light/dark; they require individual palette QA.
- App strings have typed EN/VI parity; every game has an EN/VI objective and initial controls guide. Exact config-label/choice/error translations and a few documented preset/status templates are implemented. **Full reachable-engine localization and full rules are not complete.**
- Production modules have a shared source/flags build hash in their JS/WASM names. `locateFile` and all asset URLs respect Vite base. No service worker or offline cold-start claim.
- A separate release gate blocks Pages deployment while mandatory QA/content gates remain open. It is intentionally stricter than a successful compile/smoke test.

## Verification performed

| Check | Result / limitation |
| --- | --- |
| TypeScript strict check | Pass on the current source |
| `git diff --check` | Pass |
| Logic tests | Original 4/4 pass: route/ID encoding, logical coordinate mapping, EN/VI parity and Vietnamese search, 38-game inventory. Two later engine-localization tests are typechecked but not executed |
| Production frontend build | Pass on the earlier integration snapshot: initial JS 46.78 KB / gzip 16.16 KB; rules split into lazy chunks |
| Production Chrome suite | 39/40 pass on the earlier integration snapshot: all 38 load/New/Restart/back smoke tests and no eager WASM load passed; Net restore failed |
| Restore diagnosis | Missing exported HEAPU8 fixed; direct local Chrome verification then saved `NSTATES=2`, `STATEPOS=2`, a real move and restored Undo successfully |
| Final engine compile | All 38 passed with HEAPU8 and pilot semantic hooks; later reader hardening and Python-launcher refactor still need a fresh compile |
| Final browser suite | Not rerun; two additional integration tests were added but not executed |
| Responsive/device/performance/leak audit | Not completed; no claim of physical mobile-device QA |
| Pages | Workflow written and release-blocked; not run or published |

The original compile emits warnings in `grid.c`, `signpost.c` and `tracks.c` (floating-point abs and logical-not precedence). They were recorded without changing unrelated game logic. Investigate them as native-core follow-up defects rather than hiding warnings.

## Execution blocker

The automatic approval review service stopped working because the session refresh token was revoked. The next Chrome thumbnail-capture command was **not executed**; this was a review-service failure, not an unsafe-action determination. SDK downloads/compiles and the earlier Chrome checks had already succeeded. Do not bypass approval review; sign in again before rerunning restricted process/network operations.

## Commands to continue

See `web/README.md` for toolchain setup. From the repository root, after restoring the app session:

```text
npm --prefix web ci
npm --prefix web run build:engine
npm --prefix web run typecheck
npm --prefix web run test
npm --prefix web run dev
node tools/web/capture-boards.mjs
npm --prefix web run build:frontend
npm --prefix web run test:e2e
```

Use `BROWSER_PATH=C:/Program Files/Google/Chrome/Application/chrome.exe` in PowerShell when using installed Chrome. Capture currently expects English UI; use a fresh profile (the script creates one).

Remaining work is enumerated in `web/release-status.json` and the game coverage report. Keep `ready=false` until evidence supports the plan's complete v1 gates. No push, merge or publish was performed.

## Milestones

- M0: audit and local toolchain completed, with compiler/build evidence.
- M1: Net local WASM and real drawing/input/history verified; final presets/resize/teardown gates need complete integration rerun.
- M2: session/save/config/lifecycle implemented; Net save verified after diagnosis, corruption/config/lifetime matrix pending.
- M3: Calm Studio library/player/input implemented; thumbnails, full responsive/zoom/pan/device QA pending. Zoom scrolls the board viewport; dedicated pinch/pan mode is not implemented.
- M4: app EN/VI, 38 short guides and partial engine mapping; full rules, canvas/status/preset/error reachability pending.
- M5: native/shared feedback plus pilot semantic hooks implemented/compiled; final runtime polish gates pending.
- M6: all 38 engines compiled and smoke-tested on the earlier integration snapshot; detailed per-game input/config/save/completion gates pending.
- M7: base-aware build and pinned workflows written; fresh Linux/Actions run and owner Pages setup pending.
- M8: performance, retained-instance audit, physical devices and final QA pending.

## References used

Official toolchain documentation checked during the spike: [Emscripten modularized output](https://emscripten.org/docs/compiling/Modularized-Output.html), [compiler settings](https://emscripten.org/docs/tools_reference/settings_reference.html), [Vite requirements](https://vite.dev/guide/). Action release SHAs were resolved with `git ls-remote` against the official `actions/*` repositories. No upstream puzzle source or precompiled Simon website engine was imported.
