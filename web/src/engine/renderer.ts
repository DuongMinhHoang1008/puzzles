import type { ConfigField } from "./contract";

export class CanvasHost {
  readonly buffer = document.createElement("canvas");
  readonly ctx = this.buffer.getContext("2d")!;
  readonly screen: CanvasRenderingContext2D;
  width = 0;
  height = 0;
  dpr = window.devicePixelRatio || 1;
  selectedPreset = 0;
  presetNames: string[] = [];
  canUndo = false;
  canRedo = false;
  gameId = "";
  seed = "";
  status = "";
  timer = false;
  fields: ConfigField[] = [];
  title = "";
  onDialog: (() => void) | null = null;
  onClose: (() => void) | null = null;
  onTimer: (() => void) | null = null;
  onError: ((message: string) => void) | null = null;
  onSize: (() => void) | null = null;
  onStatus: ((value: string) => void) | null = null;
  onPaint: (() => void) | null = null;
  setStatus(value: string) {
    if (value === this.status) return;
    this.status = value;
    this.onStatus?.(value);
  }
  private blitters = new Map<number, HTMLCanvasElement>();
  private blitterId = 0;
  private xmin = Infinity;
  private ymin = Infinity;
  private xmax = 0;
  private ymax = 0;
  readonly semantics = new Map<
    number,
    {
      x: number;
      y: number;
      w: number;
      h: number;
      state: number;
      previous: number;
    }
  >();
  semanticCell(
    id: number,
    x: number,
    y: number,
    w: number,
    h: number,
    state: number,
  ) {
    const cell = this.semantics.get(id);
    if (cell) {
      cell.x = x;
      cell.y = y;
      cell.w = w;
      cell.h = h;
      cell.state = state;
    } else this.semantics.set(id, { x, y, w, h, state, previous: state });
  }
  commitSemantics() {
    for (const cell of this.semantics.values()) cell.previous = cell.state;
  }
  private paletteCache = new Map<string, string>();
  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly kind = "",
  ) {
    this.screen = canvas.getContext("2d")!;
  }
  clearPalette() {
    this.paletteCache.clear();
  }
  color(value: string) {
    const cached = this.paletteCache.get(value);
    if (cached) return cached;
    const [index, original] = value.split(":");
    const dark = document.documentElement.dataset.theme === "dark";
    const palettes: Record<string, string[]> = dark
      ? {
          net: [
            "#232a2a",
            "#3a5047",
            "#52675e",
            "#c4d4ca",
            "#92aabd",
            "#73d6b6",
            "#d6a775",
            "#ed7770",
          ],
          lightup: [
            "#232a2a",
            "#52675e",
            "#111717",
            "#f6e8b1",
            "#405c3d",
            "#ed7770",
            "#73d6b6",
          ],
        }
      : {
          net: [
            "#f7f6f1",
            "#d8e6dc",
            "#bdcbbf",
            "#31423b",
            "#7d91aa",
            "#147963",
            "#b98252",
            "#c34c43",
          ],
          lightup: [
            "#f7f6f1",
            "#aebfb1",
            "#263b32",
            "#fff5c9",
            "#f4e59e",
            "#c34c43",
            "#147963",
          ],
        };
    const color = palettes[this.kind]?.[Number(index)] || original || value;
    this.paletteCache.set(value, color);
    return color;
  }
  error(message: string) {
    this.onError?.(message);
  }
  addPreset(name: string | null) {
    if (name) this.presetNames.push(name);
  }
  setIds(id: string, seed: string) {
    this.gameId = id;
    this.seed = seed;
  }
  setHistory(undo: boolean, redo: boolean) {
    this.canUndo = undo;
    this.canRedo = redo;
  }
  setTimer(active: boolean) {
    this.timer = active;
    if (active) this.onTimer?.();
  }
  setSize(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.semantics.clear();
    this.canvas.width = this.buffer.width = Math.ceil(w * this.dpr);
    this.canvas.height = this.buffer.height = Math.ceil(h * this.dpr);
    this.canvas.style.aspectRatio = `${w}/${h}`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.onSize?.();
  }
  startDraw() {
    this.xmin = this.ymin = Infinity;
    this.xmax = this.ymax = 0;
  }
  update(x: number, y: number, w: number, h: number) {
    this.xmin = Math.min(this.xmin, x);
    this.ymin = Math.min(this.ymin, y);
    this.xmax = Math.max(this.xmax, x + w);
    this.ymax = Math.max(this.ymax, y + h);
  }
  endDraw() {
    if (this.xmin === Infinity) return;
    const x = Math.floor(this.xmin * this.dpr),
      y = Math.floor(this.ymin * this.dpr);
    const w = Math.min(
        this.canvas.width - x,
        Math.ceil(this.xmax * this.dpr) - x,
      ),
      h = Math.min(this.canvas.height - y, Math.ceil(this.ymax * this.dpr) - y);
    if (w > 0 && h > 0) {
      this.screen.drawImage(this.buffer, x, y, w, h, x, y, w, h);
      this.onPaint?.();
    }
  }
  rect(x: number, y: number, w: number, h: number, c: string) {
    this.ctx.fillStyle = this.color(c);
    this.ctx.fillRect(x, y, w, h);
  }
  clip(x: number, y: number, w: number, h: number) {
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(x, y, w, h);
    this.ctx.clip();
  }
  unclip() {
    this.ctx.restore();
  }
  line(x1: number, y1: number, x2: number, y2: number, w: number, c: string) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x1 + 0.5, y1 + 0.5);
    ctx.lineTo(x2 + 0.5, y2 + 0.5);
    ctx.lineWidth = w;
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.strokeStyle = this.color(c);
    ctx.stroke();
    ctx.fillStyle = this.color(c);
    ctx.fillRect(x1, y1, 1, 1);
    ctx.fillRect(x2, y2, 1, 1);
  }
  poly(
    heap: Int32Array,
    ptr: number,
    n: number,
    fill: string | null,
    line: string,
  ) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(heap[ptr] + 0.5, heap[ptr + 1] + 0.5);
    for (let i = 1; i < n; i++)
      ctx.lineTo(heap[ptr + 2 * i] + 0.5, heap[ptr + 2 * i + 1] + 0.5);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = this.color(fill);
      ctx.fill();
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = this.color(line);
    ctx.stroke();
  }
  circle(x: number, y: number, r: number, fill: string | null, line: string) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x + 0.5, y + 0.5, r, 0, Math.PI * 2);
    if (fill) {
      ctx.fillStyle = this.color(fill);
      ctx.fill();
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = this.color(line);
    ctx.stroke();
  }
  fontMidpoint(h: number, font: string) {
    this.ctx.font = font;
    const m = this.ctx.measureText("M");
    return (m.actualBoundingBoxAscent || h * 0.7) / 2;
  }
  text(
    x: number,
    y: number,
    align: number,
    c: string,
    font: string,
    text: string,
  ) {
    const ctx = this.ctx;
    ctx.font = font;
    ctx.fillStyle = this.color(c);
    ctx.textAlign = align === 1 ? "center" : align === 2 ? "right" : "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(text, x, y);
  }
  newBlitter(w: number, h: number) {
    const b = document.createElement("canvas");
    b.width = Math.ceil(w * this.dpr);
    b.height = Math.ceil(h * this.dpr);
    const id = ++this.blitterId;
    this.blitters.set(id, b);
    return id;
  }
  freeBlitter(id: number) {
    this.blitters.delete(id);
  }
  saveBlitter(id: number, x: number, y: number, w: number, h: number) {
    const d = this.dpr;
    this.blitters
      .get(id)!
      .getContext("2d")!
      .drawImage(this.buffer, x * d, y * d, w * d, h * d, 0, 0, w * d, h * d);
  }
  loadBlitter(id: number, x: number, y: number, w: number, h: number) {
    const d = this.dpr;
    this.ctx.drawImage(this.blitters.get(id)!, 0, 0, w * d, h * d, x, y, w, h);
  }
  dialogInit(title: string) {
    this.title = title;
    this.fields = [];
  }
  dialogField(
    index: number,
    type: number,
    label: string,
    value: string,
    selected: number,
  ) {
    this.fields.push({ index, type, label, value, selected });
  }
  dialogLaunch() {
    this.onDialog?.();
  }
  dialogCleanup() {
    this.fields = [];
    this.onClose?.();
  }
  focus() {
    if (!document.querySelector("dialog[open]"))
      this.canvas.focus({ preventScroll: true });
  }
  dispose() {
    this.onTimer =
      this.onDialog =
      this.onClose =
      this.onError =
      this.onSize =
      this.onStatus =
      this.onPaint =
        null;
    this.blitters.clear();
    this.semantics.clear();
    this.buffer.width = this.buffer.height = 0;
  }
}
