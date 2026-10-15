import type { EmscriptenSession } from "./session";

export function zoomAnchor(offset: number, center: number, ratio: number) {
  return (offset + center) * ratio - center;
}

/** Owns fit/zoom/pan; the engine always receives unscaled logical coordinates. */
export class BoardViewport {
  panMode = false;
  private zoom = 1;
  private observer: ResizeObserver;
  private abort = new AbortController();
  private pointers = new Map<number, { x: number; y: number }>();
  private pinch: {
    distance: number;
    zoom: number;
    left: number;
    top: number;
    x: number;
    y: number;
  } | null = null;
  private fittedWidth = 0;
  private fittedHeight = 0;
  constructor(
    private session: EmscriptenSession,
    private viewport: HTMLElement,
    private wrap: HTMLElement,
    private slider: HTMLInputElement,
    private cancelInput: () => void,
    private cancelFeedback: () => void,
  ) {
    const options = { signal: this.abort.signal };
    this.observer = new ResizeObserver(this.fit);
    this.observer.observe(viewport);
    session.host.onSize = this.layout;
    slider.addEventListener(
      "input",
      () => this.setZoom(Number(slider.value) / 100),
      options,
    );
    viewport.addEventListener("pointerdown", this.down, options);
    viewport.addEventListener("pointermove", this.move, options);
    viewport.addEventListener("pointerup", this.up, options);
    viewport.addEventListener("pointercancel", this.up, options);
    window.addEventListener("resize", this.fit, options);
    window.addEventListener("blur", this.cancel, options);
  }
  togglePan() {
    this.cancelInput();
    this.cancel();
    this.panMode = !this.panMode;
    this.viewport.classList.toggle("pan", this.panMode);
    return this.panMode;
  }
  get blocksGameInput() {
    return this.panMode || this.pinch !== null;
  }
  private fit = () => {
    const width = Math.max(100, this.viewport.clientWidth - 16),
      height = Math.max(160, Math.min(600, innerHeight * 0.58));
    const dpr = window.devicePixelRatio || 1;
    if (this.session.host.dpr !== dpr) {
      this.session.host.dpr = dpr;
      this.session.repaint();
    }
    if (width === this.fittedWidth && height === this.fittedHeight) return;
    this.cancelInput();
    this.cancelFeedback();
    this.fittedWidth = width;
    this.fittedHeight = height;
    this.session.resize(width, height);
    this.layout();
  };
  private layout = () => {
    this.wrap.style.width = this.session.host.width * this.zoom + "px";
    this.wrap.style.maxWidth = "none";
  };
  private setZoom(value: number) {
    this.cancelInput();
    this.cancelFeedback();
    this.zoom = Math.max(1, Math.min(3, value));
    this.slider.value = String(Math.round(this.zoom * 100));
    this.layout();
  }
  private down = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && !this.panMode) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.panMode) {
      this.cancelInput();
      this.viewport.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
    if (this.pointers.size === 2) {
      this.cancelInput();
      const [a, b] = this.pointers.values();
      const rect = this.viewport.getBoundingClientRect();
      this.pinch = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        zoom: this.zoom,
        left: this.viewport.scrollLeft,
        top: this.viewport.scrollTop,
        x: (a.x + b.x) / 2 - rect.left,
        y: (a.y + b.y) / 2 - rect.top,
      };
      for (const id of this.pointers.keys())
        this.viewport.setPointerCapture(id);
      e.preventDefault();
    }
  };
  private move = (e: PointerEvent) => {
    const previous = this.pointers.get(e.pointerId);
    if (!previous) return;
    const dx = previous.x - e.clientX,
      dy = previous.y - e.clientY;
    previous.x = e.clientX;
    previous.y = e.clientY;
    if (this.pinch && this.pointers.size === 2) {
      const [a, b] = this.pointers.values(),
        p = this.pinch;
      this.setZoom(
        (p.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / Math.max(1, p.distance),
      );
      this.viewport.scrollLeft = zoomAnchor(p.left, p.x, this.zoom / p.zoom);
      this.viewport.scrollTop = zoomAnchor(p.top, p.y, this.zoom / p.zoom);
      e.preventDefault();
    } else if (this.panMode) {
      this.viewport.scrollLeft += dx;
      this.viewport.scrollTop += dy;
      e.preventDefault();
    }
  };
  private up = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    if (this.viewport.hasPointerCapture(e.pointerId))
      this.viewport.releasePointerCapture(e.pointerId);
    if (!this.pointers.size) this.pinch = null;
  };
  private cancel = () => {
    for (const id of this.pointers.keys())
      if (this.viewport.hasPointerCapture(id))
        this.viewport.releasePointerCapture(id);
    this.pointers.clear();
    this.pinch = null;
  };
  dispose() {
    this.cancel();
    this.observer.disconnect();
    this.abort.abort();
    this.session.host.onSize = null;
  }
}
