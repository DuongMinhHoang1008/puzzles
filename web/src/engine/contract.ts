export type Locale = "en" | "vi";
export type Command = "new" | "restart" | "undo" | "redo" | "solve";
export type Cause = Command | "move" | "config" | "restore";
export interface PuzzleMetadata {
  assistance: Snapshot["assistance"];
  celebrated: boolean;
}
export interface Snapshot {
  revision: number;
  status: "playing" | "completed" | "failed";
  assistance: "none" | "used-solve" | "unknown";
  canUndo: boolean;
  canRedo: boolean;
  canSolve: boolean;
  canConfigure: boolean;
  shareGameId: string;
  seed: string;
  boardWidth: number;
  boardHeight: number;
}
export type InputAction =
  | {
      kind: "pointer";
      phase: "down" | "move" | "up";
      x: number;
      y: number;
      button: number;
    }
  | { kind: "key"; key: string; shift: boolean; ctrl: boolean; alt: boolean };
export type SessionEvent =
  | { type: "input-started"; action: InputAction }
  | { type: "input-finished"; action: InputAction; outcome: "move" | "selection" | "ignored" | "command" }
  | { type: "state-changed"; cause: Cause; snapshot: Snapshot }
  | { type: "ui-changed" }
  | { type: "error"; message: string };
export interface ConfigField {
  index: number;
  type: number;
  label: string;
  value: string;
  selected: number;
}
export interface PuzzleSession {
  start(gameId: string, fullId?: string, save?: Uint8Array): Promise<void>;
  input(action: InputAction): void;
  execute(command: Command): void;
  snapshot(): Snapshot;
  serialise(): Uint8Array;
  restore(data: Uint8Array, metadata?: PuzzleMetadata): void;
  metadata(): PuzzleMetadata;
  markCelebrated(): void;
  subscribe(listener: (event: SessionEvent) => void): () => void;
  dispose(): void;
  presets(): readonly string[];
  selectPreset(index: number): void;
  configure(kind: "settings" | "id" | "seed"): void;
  submitConfig(fields: ConfigField[]): void;
  cancelConfig(): void;
  setReducedMotion(value: boolean): void;
}
