import type { EmscriptenSession } from "../engine/session";
import type { Settings } from "../storage/settings";
export class SemanticFeedback {
  private overlay = document.createElement("div");
  private animations = new Set<Animation>();
  private unsubscribe: () => void;
  constructor(
    private session: EmscriptenSession,
    wrap: HTMLElement,
    settings: Settings,
  ) {
    this.overlay.className = "overlay";
    wrap.append(this.overlay);
    session.host.commitSemantics();
    this.unsubscribe = session.subscribe((e) => {
      if (e.type !== "state-changed") return;
      this.cancel();
      if (e.cause === "move" && !settings.reduced) {
        const host = this.session.host;
        for (const cell of host.semantics.values()) {
          if (cell.state < 0 || cell.state === cell.previous) continue;
          const marker = document.createElement("div");
          marker.className = "cell-feedback";
          marker.style.left = (cell.x / host.width) * 100 + "%";
          marker.style.top = (cell.y / host.height) * 100 + "%";
          marker.style.width = (cell.w / host.width) * 100 + "%";
          marker.style.height = (cell.h / host.height) * 100 + "%";
          marker.style.borderColor = cell.state & 4 ? "#c44d44" : "#147963";
          this.overlay.append(marker);
          const a = marker.animate([{ opacity: 0.65 }, { opacity: 0 }], {
            duration: 180,
          });
          this.animations.add(a);
          a.onfinish = () => {
            marker.remove();
            this.animations.delete(a);
          };
        }
      }
      session.host.commitSemantics();
    });
  }
  cancel() {
    for (const a of this.animations) a.cancel();
    this.animations.clear();
    this.overlay.replaceChildren();
  }
  dispose() {
    this.unsubscribe();
    this.cancel();
    this.overlay.remove();
  }
}
