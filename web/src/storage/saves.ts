import type { PuzzleSession, PuzzleMetadata } from "../engine/contract";
export interface Save extends PuzzleMetadata {
  schemaVersion: 1;
  gameId: string;
  engineBuildId: string;
  savedAt: number;
  data: Uint8Array;
}
let database: Promise<IDBDatabase> | null = null;
export class InvalidSaveError extends Error {}
function db() {
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("puzzle-studio", 1);
    r.onupgradeneeded = () =>
      r.result.createObjectStore("saves", { keyPath: "gameId" });
    r.onsuccess = () => {
      r.result.onversionchange = () => {
        r.result.close();
        database = null;
      };
      resolve(r.result);
    };
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(Error("Storage upgrade blocked"));
  }).catch((e) => {
    database = null;
    throw e;
  }));
}
export async function readSave(id: string): Promise<Save | undefined> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const r = d.transaction("saves").objectStore("saves").get(id);
    r.onsuccess = () => {
      const v = r.result;
      if (
        v &&
        (v.schemaVersion !== 1 ||
          v.gameId !== id ||
          !(v.data instanceof Uint8Array) ||
          !v.data.length ||
          v.data.length > 16 * 1024 * 1024 ||
          !["none", "used-solve", "unknown"].includes(v.assistance) ||
          typeof v.celebrated !== "boolean")
      )
        reject(new InvalidSaveError("Unsupported save"));
      else resolve(v);
    };
    r.onerror = () => reject(r.error);
  });
}
export async function latestSave(): Promise<Save | undefined> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const r = d.transaction("saves").objectStore("saves").getAll();
    r.onsuccess = () =>
      resolve(
        (r.result as Save[])
          .filter((s) => s.schemaVersion === 1 && Number.isFinite(s.savedAt))
          .sort((a, b) => b.savedAt - a.savedAt)[0],
      );
    r.onerror = () => reject(r.error);
  });
}
async function writeSave(save: Save) {
  const d = await db();
  return new Promise<void>((resolve, reject) => {
    const t = d.transaction("saves", "readwrite");
    t.objectStore("saves").put(save);
    t.oncomplete = () => resolve();
    t.onerror = t.onabort = () => reject(t.error);
  });
}
export class SaveController {
  private timeout = 0;
  private dirty = false;
  private disposed = false;
  private pending = Promise.resolve();
  private unsubscribe: () => void;
  private disposal: Promise<void> | null = null;
  markDirty() {
    this.dirty = true;
    clearTimeout(this.timeout);
    this.timeout = window.setTimeout(() => void this.flush(), 400);
  }
  constructor(
    private session: PuzzleSession,
    private id: string,
    private buildId: string,
    private onError: (e: unknown) => void,
  ) {
    this.unsubscribe = session.subscribe((e) => {
      if (e.type === "state-changed" && e.cause !== "restore") {
        this.dirty = true;
        clearTimeout(this.timeout);
        this.timeout = window.setTimeout(() => void this.flush(), 400);
      }
    });
    document.addEventListener("visibilitychange", this.visibility);
    window.addEventListener("pagehide", this.pagehide);
  }
  private visibility = () => {
    if (document.hidden) void this.flush();
  };
  private pagehide = () => void this.flush();
  async flush() {
    clearTimeout(this.timeout);
    if (!this.dirty || this.disposed) return this.pending;
    this.dirty = false;
    try {
      const save: Save = {
        schemaVersion: 1,
        gameId: this.id,
        engineBuildId: this.buildId,
        savedAt: Date.now(),
        ...this.session.metadata(),
        data: this.session.serialise(),
      };
      this.pending = this.pending
        .then(() => writeSave(save))
        .catch((e) => {
          this.dirty = true;
          this.onError(e);
        });
      await this.pending;
    } catch (e) {
      this.dirty = true;
      this.onError(e);
    }
  }
  dispose(): Promise<void> {
    if (this.disposal) return this.disposal;
    this.unsubscribe();
    clearTimeout(this.timeout);
    document.removeEventListener("visibilitychange", this.visibility);
    window.removeEventListener("pagehide", this.pagehide);
    return (this.disposal = this.flush().finally(() => {
      this.disposed = true;
    }));
  }
}
