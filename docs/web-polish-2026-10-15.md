# Interaction polish — 2026-10-15

## Current: feedback inside all 38 games

Every game now uses `InteractionFeedback`: typed input-start/input-finish events distinguish a committed move, selection, ignored input and a command. The effect compares bounded 160×160 copies of the actual canvas before/after input and briefly lights only changed pixels. This gives region-shaped feedback in Map, stroke feedback on lines and cell feedback on number boards without inventing game semantics. Region/line/movement profiles tune the glow; native animations and Net/Light Up semantic effects remain owned by their existing systems.

Pointer contacts are neutral until the engine commits a move. Keyboard and on-screen keypad input use the same engine events, so they also animate. Touch feedback begins only when input reaches the engine; pan and pinch do not generate game feedback. A maximum of eight transient nodes, 48ms drag sampling interval, replacement of stale layers, explicit cancellation and disposal bound the work. No idle sampling or permanent animation loop was added. Canvas readback during interaction still needs physical-mobile performance validation.

The all-game interaction suite verifies an actual committed move (Undo enabled, without Solve), a changed-pixel effect, absence of page errors, and reduced-motion cleanup separately for **38/38 games**. Separate checks cover touch at DPR 3, Sudoku keypad, pan exclusion and rapid-input cleanup. Map's incorrect click-to-colour guide was corrected to native drag-to-copy controls in EN/VI.

Browser selectors now target `.board-wrap > canvas` so the board and decorative canvas layers cannot be confused.

Current validation: production build/typecheck and 10 unit tests pass. Full browser run: 149/150 passed; the random 25×25 Unequal keyboard check selected an immutable given cell. Its fixture logic now searches for an editable cell and passes on rerun. Three additional touch/keypad/cleanup checks pass. All 38 interaction checks and the 30-switch WASM/listener lifecycle check passed in the full run. No physical-device/Safari/Firefox coverage is implied.

## Earlier shared shell pass

Added accepted-move pointer ripples across the catalogue, board entrance on New/configuration, a once-per-session natural-win particle burst, completion badge and board treatment. Assisted solves do not trigger the win burst. Existing Net/Light Up semantic overlays and native canvas animations remain in place.

Added selected input-mode styling, raised primary buttons, board inset/shadows, library hover, dialog/toast entrance and loading indicator. Reduced motion disables movement including pseudo-element animations. Sound remains opt-in. Effects own their animations, listeners and DOM nodes and dispose on navigation; non-move history commands cancel effects.

Validation for the earlier shell pass: production build and strict TypeScript pass; 10 unit tests pass. 27 distinct browser checks pass across feedback, responsive and lifecycle suites (26 in the combined run, then 4 feedback checks including the additional Map check). Covers natural win once, Undo/replay, Solve exclusion, reduced motion, 320–1440px EN/VI light/dark, pinch/pan and 30 game switches with no retained WASM memories. Inspected desktop Map and completion screenshots. Chrome desktop/emulation only.
