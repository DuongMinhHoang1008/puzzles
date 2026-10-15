import type { InputAction } from "../engine/contract";
import type { EmscriptenSession } from "../engine/session";
import type { Settings } from "../storage/settings";

// Compare a bounded, low-resolution copy only during input. This is visual damage,
// never game logic: colours, legal moves and completion remain owned by the engine.
const SAMPLE = 160;
export class InteractionFeedback {
  private overlay = document.createElement("div");
  private sample = document.createElement("canvas");
  private ctx = this.sample.getContext("2d", { willReadFrequently: true })!;
  private before: Uint8ClampedArray | null = null;
  private pending: { until: number; outcome: "move" | "selection" } | null = null;
  private animations = new Map<HTMLElement, Animation>();
  private unsubscribe: () => void;
  private lastSample = -Infinity;
  private lastTrail = -Infinity;
  private sampling = false;
  private disposed = false;
  constructor(
    private session: EmscriptenSession,
    wrap: HTMLElement,
    private settings: Settings,
    profile: string,
  ) {
    this.sample.width = this.sample.height = SAMPLE;
    this.overlay.className = "interaction-overlay";
    this.overlay.dataset.profile = profile;
    this.overlay.setAttribute("aria-hidden", "true");
    wrap.append(this.overlay);
    session.host.onPaint = this.paint;
    this.unsubscribe = session.subscribe((event) => {
      if (event.type === "input-started") this.begin(event.action);
      if (event.type === "input-finished") {
        if (settings.reduced) return;
        const action = event.action;
        if (action.kind === "pointer" && action.phase === "down")
          this.point(action, event.outcome === "move" ? "move-ripple" : "input-contact");
        if (event.outcome === "move" && action.kind === "pointer" && action.phase !== "down")
          this.point(action, "move-ripple");
        if (this.sampling && (event.outcome === "move" || event.outcome === "selection")) {
          this.pending = { until: performance.now() + 350, outcome: event.outcome };
          this.paint();
        }
        this.sampling = false;
      }
      if (event.type === "state-changed" && event.cause !== "move") this.cancel();
    });
  }
  private begin(action: InputAction) {
    this.pending = null;
    this.sampling = false;
    if (this.settings.reduced || this.disposed) return;
    const now = performance.now();
    if (action.kind === "pointer" && action.phase === "move" && now - this.lastSample < 48) return;
    this.lastSample = now;
    this.ctx.drawImage(this.session.host.canvas, 0, 0, SAMPLE, SAMPLE);
    this.before = this.ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
    this.sampling = true;
  }
  private paint = () => {
    const pending = this.pending;
    if (!pending || !this.before || this.settings.reduced || this.disposed) return;
    if (performance.now() > pending.until) { this.pending = null; return; }
    this.ctx.drawImage(this.session.host.canvas, 0, 0, SAMPLE, SAMPLE);
    const next = this.ctx.getImageData(0, 0, SAMPLE, SAMPLE);
    const pixels = next.data, before = this.before;
    let changed = 0;
    let xmin = SAMPLE, ymin = SAMPLE, xmax = 0, ymax = 0;
    // A translucent white mask preserves native clue/error colours underneath.
    for (let i = 0; i < pixels.length; i += 4) {
      const delta = Math.max(Math.abs(pixels[i] - before[i]), Math.abs(pixels[i + 1] - before[i + 1]), Math.abs(pixels[i + 2] - before[i + 2]));
      pixels[i] = pixels[i + 1] = pixels[i + 2] = 255;
      pixels[i + 3] = delta > 18 ? Math.min(150, delta) : 0;
      if (delta > 18) {
        changed++;
        const x = (i / 4) % SAMPLE, y = Math.floor(i / 4 / SAMPLE);
        xmin = Math.min(xmin, x); ymin = Math.min(ymin, y);
        xmax = Math.max(xmax, x); ymax = Math.max(ymax, y);
      }
    }
    if (!changed) return; // Native animations may paint their first changed frame later.
    this.pending = null;
    const mask = document.createElement("canvas");
    mask.width = mask.height = SAMPLE;
    mask.className = `paint-feedback ${pending.outcome}`;
    mask.getContext("2d")!.putImageData(next, 0, 0);
    this.effect(mask, [{ opacity: .85 }, { opacity: 0 }], pending.outcome === "move" ? 280 : 180);
    if (pending.outcome === "selection" && xmax - xmin < SAMPLE / 3 && ymax - ymin < SAMPLE / 3) {
      const marker = document.createElement("span");
      marker.className = "selection-feedback";
      marker.style.left = `${xmin / SAMPLE * 100}%`;
      marker.style.top = `${ymin / SAMPLE * 100}%`;
      marker.style.width = `${Math.max(3, xmax - xmin + 1) / SAMPLE * 100}%`;
      marker.style.height = `${Math.max(3, ymax - ymin + 1) / SAMPLE * 100}%`;
      this.effect(marker, [{ opacity: .7 }, { opacity: 0 }], 240);
    }
  };
  private point(action: Extract<InputAction, { kind: "pointer" }>, className: string) {
    const host = this.session.host;
    if (action.x < 0 || action.y < 0 || action.x > host.width || action.y > host.height) return;
    // One contact per 45ms while drawing, with a fixed cap on transient nodes.
    const now = performance.now();
    if (now - this.lastTrail < 45) return;
    this.lastTrail = now;
    const node = document.createElement("span");
    node.className = className;
    node.style.left = `${action.x / host.width * 100}%`;
    node.style.top = `${action.y / host.height * 100}%`;
    this.effect(node, [
      { opacity: .7, transform: "translate(-50%, -50%) scale(.45)" },
      { opacity: 0, transform: "translate(-50%, -50%) scale(1.4)" },
    ], 300);
  }
  private effect(node: HTMLElement, frames: Keyframe[], duration: number) {
    // Replace stale paint layers; bounded input trails cannot build up during a drag.
    for (const [old, animation] of this.animations) {
      if (old.className === node.className || this.animations.size >= 8) {
        animation.cancel(); old.remove(); this.animations.delete(old);
      }
    }
    this.overlay.append(node);
    const animation = node.animate(frames, { duration, easing: "ease-out" });
    this.animations.set(node, animation);
    animation.onfinish = () => { node.remove(); this.animations.delete(node); };
  }
  cancel() {
    this.pending = null;
    this.before = null;
    this.sampling = false;
    for (const animation of this.animations.values()) animation.cancel();
    this.animations.clear();
    this.overlay.replaceChildren();
  }
  dispose() {
    this.disposed = true;
    this.unsubscribe();
    this.session.host.onPaint = null;
    this.cancel();
    this.overlay.remove();
    this.sample.width = this.sample.height = 0;
  }
}
