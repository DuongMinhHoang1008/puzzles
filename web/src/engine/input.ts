import type { PuzzleSession } from "./contract";
export function mapPoint(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, "left" | "top" | "width" | "height">,
  width: number,
  height: number,
) {
  return {
    x: ((clientX - rect.left) * width) / rect.width,
    y: ((clientY - rect.top) * height) / rect.height,
  };
}
export function bindInput(
  canvas: HTMLCanvasElement,
  session: PuzzleSession,
  getMode: () => number | null,
): { cancel: () => void; dispose: () => void } {
  const abort = new AbortController();
  const options = { signal: abort.signal };
  let gesture: {
    id: number;
    button: number;
    x: number;
    y: number;
    clientX: number;
    clientY: number;
    started: boolean;
  } | null = null;
  const send = (phase: "down" | "move" | "up", event: PointerEvent) => {
    if (!gesture) return;
    const s = session.snapshot();
    const p = mapPoint(
      event.clientX,
      event.clientY,
      canvas.getBoundingClientRect(),
      s.boardWidth,
      s.boardHeight,
    );
    gesture.x = p.x;
    gesture.y = p.y;
    session.input({ kind: "pointer", phase, ...p, button: gesture.button });
  };
  const cancel = () => {
    if (!gesture) return;
    if (gesture.started)
      session.input({
        kind: "pointer",
        phase: "up",
        x: -1,
        y: -1,
        button: gesture.button,
      });
    gesture = null;
  };
  const startPending = () => {
    if (!gesture || gesture.started) return;
    gesture.started = true;
    session.input({
      kind: "pointer",
      phase: "down",
      x: gesture.x,
      y: gesture.y,
      button: gesture.button,
    });
  };
  canvas.addEventListener(
    "pointerdown",
    (e) => {
      const mode = getMode();
      if (gesture || mode === null || e.button > 2) return;
      e.preventDefault();
      canvas.focus();
      const s = session.snapshot(),
        p = mapPoint(
          e.clientX,
          e.clientY,
          canvas.getBoundingClientRect(),
          s.boardWidth,
          s.boardHeight,
        );
      gesture = {
        id: e.pointerId,
        button: e.pointerType === "mouse" ? e.button : mode,
        ...p,
        clientX: e.clientX,
        clientY: e.clientY,
        started: e.pointerType !== "touch",
      };
      canvas.setPointerCapture(e.pointerId);
      if (gesture.started) send("down", e);
    },
    options,
  );
  canvas.addEventListener(
    "pointermove",
    (e) => {
      if (gesture?.id !== e.pointerId) return;
      if (
        !gesture.started &&
        Math.hypot(e.clientX - gesture.clientX, e.clientY - gesture.clientY) > 6
      )
        startPending();
      if (gesture.started) send("move", e);
    },
    options,
  );
  canvas.addEventListener(
    "pointerup",
    (e) => {
      if (gesture?.id !== e.pointerId) return;
      startPending();
      send("up", e);
      gesture = null;
      canvas.releasePointerCapture(e.pointerId);
    },
    options,
  );
  canvas.addEventListener("pointercancel", cancel, options);
  canvas.addEventListener("lostpointercapture", cancel, options);
  window.addEventListener("blur", cancel, options);
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden) cancel();
    },
    options,
  );
  canvas.addEventListener("contextmenu", (e) => e.preventDefault(), options);
  canvas.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Tab" || e.key === "Escape" || e.altKey) return;
      if (e.ctrlKey && e.key === "z")
        session.execute(e.shiftKey ? "redo" : "undo");
      else if (e.ctrlKey && e.key === "y") session.execute("redo");
      else if (e.ctrlKey && !e.key.startsWith("Arrow")) return;
      else
        session.input({
          kind: "key",
          key: e.key,
          shift: e.shiftKey,
          ctrl: e.ctrlKey,
          alt: e.altKey,
        });
      e.preventDefault();
    },
    options,
  );
  return {
    cancel,
    dispose: () => {
      cancel();
      abort.abort();
    },
  };
}
