import type { PuzzleSession, Snapshot } from "../engine/contract";
import type { Settings } from "../storage/settings";

export class FeedbackController {
  private audio: AudioContext | null = null;
  private animations = new Set<Animation>();
  private unsubscribe: () => void;
  private previous: Snapshot;
  private lastSound = 0;
  private overlay = document.createElement("div");
  constructor(
    session: PuzzleSession,
    private board: HTMLElement,
    private settings: Settings,
    private announce: (s: Snapshot) => void,
  ) {
    this.previous = session.snapshot();
    this.overlay.className = "juice-overlay";
    this.overlay.setAttribute("aria-hidden", "true");
    this.board.append(this.overlay);
    this.unsubscribe = session.subscribe((e) => {
      if (e.type !== "state-changed") return;
      const s = e.snapshot;
      const complete =
        s.status === "completed" &&
        this.previous.status === "playing" &&
        s.assistance === "none" &&
        e.cause === "move" &&
        !session.metadata().celebrated;
      if (complete) session.markCelebrated();
      this.announce(s);
      if (e.cause === "move")
        this.sound(complete ? 660 : 340, complete ? 0.22 : 0.04);
      if (e.cause !== "move") this.cancel();
      if (!settings.reduced) {
        if (e.cause === "new" || e.cause === "config") {
          this.animate(this.board.querySelector(".board-wrap")!,
            [{ opacity: .25, transform: "scale(.97)" }, { opacity: 1, transform: "scale(1)" }], 300);
        }
        if (complete) this.celebrate();
      }
      this.previous = s;
    });
  }
  private animate(node: Element, frames: Keyframe[], duration: number, remove = false) {
    const animation = node.animate(frames, { duration, easing: "cubic-bezier(.2,.8,.2,1)" });
    this.animations.add(animation);
    animation.onfinish = () => {
      this.animations.delete(animation);
      if (remove) node.remove();
    };
  }
  private particle(className: string, x: number, y: number, frames: Keyframe[], duration: number) {
    const node = document.createElement("span");
    node.className = className;
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    this.overlay.append(node);
    this.animate(node, frames, duration, true);
  }
  private celebrate() {
    const canvas = this.board.querySelector("canvas")!;
    const rect = canvas.getBoundingClientRect(), board = this.board.getBoundingClientRect();
    const x = rect.left - board.left + rect.width / 2;
    const y = rect.top - board.top + rect.height / 2;
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const distance = Math.min(rect.width, rect.height) * (.3 + (i % 3) * .08);
      this.particle(`win-spark spark-${i % 3}`, x, y,
        [{ transform: "translate(-50%, -50%) scale(0)", opacity: 0 },
         { opacity: 1, offset: .15 },
         { transform: `translate(calc(-50% + ${Math.cos(angle) * distance}px), calc(-50% + ${Math.sin(angle) * distance}px)) rotate(${i * 47}deg) scale(.5)`, opacity: 0 }], 850 + i % 4 * 70);
    }
    this.animate(this.board.querySelector(".status")!,
      [{ transform: "scale(.9)", opacity: .3 }, { transform: "scale(1.05)", offset: .65 }, { transform: "scale(1)", opacity: 1 }], 500);
    for (const [i, note] of [523.25, 659.25, 783.99].entries()) this.sound(note, .32, i * .09);
  }
  private sound(frequency: number, duration: number, delay = 0) {
    if (!this.settings.sound || (!delay && performance.now() - this.lastSound < 45)) return;
    this.lastSound = performance.now();
    this.audio ??= new AudioContext();
    void this.audio.resume();
    const oscillator = this.audio.createOscillator(),
      gain = this.audio.createGain();
    const t = this.audio.currentTime + delay;
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.035, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    oscillator.connect(gain);
    gain.connect(this.audio.destination);
    oscillator.start(t);
    oscillator.stop(t + duration);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
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
    void this.audio?.close();
    this.audio = null;
  }
}
