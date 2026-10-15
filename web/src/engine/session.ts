import { CanvasHost } from "./renderer";
import type {
  PuzzleSession,
  Snapshot,
  SessionEvent,
  Command,
  Cause,
  InputAction,
  ConfigField,
  PuzzleMetadata,
} from "./contract";

interface Module {
  HEAPU8: Uint8Array;
  _malloc(size: number): number;
  _free(ptr: number): void;
  ccall(
    name: string,
    result: string | null,
    types?: string[],
    values?: unknown[],
  ): number | string | null;
  UTF8ToString(ptr: number): string;
  _timer_callback(seconds: number): void;
}
interface Assets {
  buildId: string;
  games: { id: string; module: string; wasm: string }[];
}
const commands: Record<Command, number> = {
  new: 5,
  restart: 6,
  undo: 7,
  redo: 8,
  solve: 9,
};
const nativeCauses: Cause[] = [
  "new",
  "move",
  "undo",
  "redo",
  "restart",
  "solve",
  "restore",
];
let assetPromise: Promise<Assets> | null = null;
export function loadAssets(): Promise<Assets> {
  return (assetPromise ??= fetch(
    `${import.meta.env.BASE_URL}engine/manifest.json`,
  )
    .then((r) => {
      if (!r.ok) throw Error("Engine manifest unavailable");
      return r.json() as Promise<Assets>;
    })
    .catch((e) => {
      assetPromise = null;
      throw e;
    }));
}
export class EmscriptenSession implements PuzzleSession {
  private module: Module | null = null;
  private disposed = false;
  private initialized = false;
  private listeners = new Set<(event: SessionEvent) => void>();
  private raf = 0;
  private last = 0;
  private reduced = false;
  private puzzleMetadata: PuzzleMetadata = {
    assistance: "none",
    celebrated: false,
  };
  buildId = "";
  constructor(readonly host: CanvasHost) {
    host.onTimer = this.schedule;
    host.onError = (message) => this.emit({ type: "error", message });
    document.addEventListener("visibilitychange", this.visibility);
  }
  async start(gameId: string, fullId?: string, save?: Uint8Array) {
    const assets = await loadAssets();
    if (this.disposed) return;
    const asset = assets.games.find((g) => g.id === gameId);
    if (!asset) throw Error(`Missing engine: ${gameId}`);
    const base = new URL(`${import.meta.env.BASE_URL}engine/`, location.origin)
      .href;
    const { default: factory } = await import(
      /* @vite-ignore */ base + asset.module
    );
    if (this.disposed) return;
    const module: Module = await factory({
      noInitialRun: true,
      noExitRuntime: true,
      webHost: this.host,
      locateFile: (name: string) => base + name,
    });
    if (this.disposed) {
      this.host.dispose();
      return;
    }
    this.module = module;
    this.buildId = assets.buildId;
    this.call("main", 0, 0);
    this.initialized = true;
    if (fullId) {
      const err = this.callString("web_game_id", ["string"], [fullId]);
      if (err) throw Error(err);
    }
    if (save) this.restore(save);
    this.schedule();
  }
  private call(name: string, ...values: number[]): number {
    return this.module!.ccall(
      name,
      "number",
      values.map(() => "number"),
      values,
    ) as number;
  }
  private callString(name: string, types: string[], values: unknown[]) {
    return this.module!.ccall(name, "string", types, values) as string | null;
  }
  private emit(event: SessionEvent) {
    for (const listener of this.listeners) listener(event);
  }
  private mutate(cause: Cause, fn: () => void): Cause | "selection" | "ignored" {
    if (!this.initialized || this.disposed) return "ignored";
    const before = this.call("web_revision"),
      ui = this.call("web_ui_revision");
    fn();
    if (this.reduced) this.call("web_stop_anim");
    if (this.call("web_revision") !== before) {
      if (cause !== "config") cause = nativeCauses[this.call("web_cause")];
      if (cause === "new" || cause === "config")
        this.puzzleMetadata = { assistance: "none", celebrated: false };
      else if (cause === "solve" || this.call("web_assisted"))
        this.puzzleMetadata.assistance = "used-solve";
      this.emit({ type: "state-changed", cause, snapshot: this.snapshot() });
      return cause;
    } else if (this.call("web_ui_revision") !== ui) {
      this.emit({ type: "ui-changed" });
      return "selection";
    }
    return "ignored";
  }
  input(action: InputAction) {
    this.emit({ type: "input-started", action });
    const result = this.mutate("move", () => {
      if (action.kind === "pointer")
        this.call(
          action.phase === "down"
            ? "mousedown"
            : action.phase === "up"
              ? "mouseup"
              : "mousemove",
          Math.round(action.x),
          Math.round(action.y),
          action.phase === "move" ? 1 << action.button : action.button,
        );
      else {
        const key = action.key;
        const codes: Record<string, number> = {
          ArrowLeft: 37,
          ArrowUp: 38,
          ArrowRight: 39,
          ArrowDown: 40,
          Backspace: 8,
          Delete: 46,
          Enter: 13,
          Home: 36,
          End: 35,
          PageUp: 33,
          PageDown: 34,
        };
        this.module!.ccall(
          "key",
          null,
          ["number", "number", "string", "string", "number", "number"],
          [
            codes[key] || 0,
            0,
            key,
            key.length === 1 ? key : "",
            +action.shift,
            +action.ctrl,
          ],
        );
      }
    });
    this.emit({ type: "input-finished", action,
      outcome: result === "move" || result === "selection" || result === "ignored" ? result : "command" });
  }
  execute(command: Command) {
    this.mutate(command, () => this.call("command", commands[command]));
  }
  snapshot(): Snapshot {
    const h = this.host;
    const status = this.call("web_status");
    return {
      revision: this.call("web_revision"),
      status: status > 0 ? "completed" : status < 0 ? "failed" : "playing",
      assistance: this.puzzleMetadata.assistance,
      canUndo: h.canUndo,
      canRedo: h.canRedo,
      canSolve: !!this.call("web_can_solve"),
      canConfigure: !!this.call("web_can_configure"),
      shareGameId: h.gameId,
      seed: h.seed,
      boardWidth: h.width,
      boardHeight: h.height,
    };
  }
  serialise() {
    const ptr = this.call("web_save");
    return this.module!.HEAPU8.slice(ptr, ptr + this.call("web_save_length"));
  }
  metadata(): PuzzleMetadata {
    return { ...this.puzzleMetadata };
  }
  markCelebrated() {
    this.puzzleMetadata.celebrated = true;
  }
  restore(data: Uint8Array, metadata?: PuzzleMetadata) {
    if (!data.length || data.length > 16 * 1024 * 1024)
      throw Error("Invalid save size");
    const ptr = this.module!._malloc(data.length);
    if (!ptr) throw Error("Out of memory");
    try {
      this.module!.HEAPU8.set(data, ptr);
      this.mutate("restore", () => {
        const err = this.callString(
          "web_restore",
          ["number", "number"],
          [ptr, data.length],
        );
        if (err) throw Error(err);
        this.puzzleMetadata = metadata
          ? { ...metadata }
          : {
              assistance: this.call("web_assisted") ? "used-solve" : "unknown",
              celebrated: false,
            };
      });
    } finally {
      this.module!._free(ptr);
    }
  }
  presets() {
    return this.host.presetNames;
  }
  repaint() {
    if (this.initialized && !this.disposed) {
      this.host.setSize(this.host.width, this.host.height);
      this.call("web_redraw");
    }
  }
  resize(width: number, height: number) {
    if (this.initialized && !this.disposed)
      this.call("resize_puzzle", Math.floor(width), Math.floor(height));
  }
  selectPreset(index: number) {
    if (!Number.isInteger(index) || index < 0 || index >= this.presets().length)
      throw Error("Invalid preset");
    this.mutate("config", () => {
      this.host.selectedPreset = index;
      this.call("command", 2);
    });
  }
  configure(kind: "settings" | "id" | "seed") {
    this.host.selectedPreset = -1;
    this.call("command", kind === "settings" ? 2 : kind === "id" ? 0 : 1);
  }
  submitConfig(fields: ConfigField[]) {
    this.mutate("config", () => {
      for (const f of fields) {
        if (f.type === 0)
          this.module!.ccall(
            "dlg_return_sval",
            null,
            ["number", "string"],
            [f.index, f.value],
          );
        else this.call("dlg_return_ival", f.index, f.selected);
      }
      this.call("command", 3);
    });
  }
  cancelConfig() {
    this.call("command", 4);
  }
  setReducedMotion(value: boolean) {
    this.reduced = value;
    if (value && this.initialized) this.call("web_stop_anim");
  }
  subscribe(listener: (event: SessionEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  private visibility = () => {
    this.last = 0;
    if (document.hidden) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    } else this.schedule();
  };
  private schedule = () => {
    if (!this.host.timer) {
      this.last = 0;
      return;
    }
    if (!this.raf && !this.disposed && !document.hidden && this.host.timer)
      this.raf = requestAnimationFrame(this.tick);
  };
  private tick = (now: number) => {
    this.raf = 0;
    if (this.disposed || !this.initialized) return;
    if (this.last)
      this.module!._timer_callback(Math.min((now - this.last) / 1000, 0.1));
    this.last = now;
    this.schedule();
  };
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    document.removeEventListener("visibilitychange", this.visibility);
    if (this.initialized) this.call("web_dispose");
    this.initialized = false;
    this.module = null;
    this.listeners.clear();
    this.host.dispose();
  }
}
