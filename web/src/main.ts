import "./styles/main.css";
import catalog from "../../tools/web/games.manifest.json";
import thumbnails from "./content/thumbnails.json";
import { dictionary, type TextKey, normalize } from "./locales";
import { engineText } from "./locales/engine";
import { readSettings, writeSettings } from "./storage/settings";
import {
  readSave,
  latestSave,
  SaveController,
  InvalidSaveError,
} from "./storage/saves";
import { EmscriptenSession } from "./engine/session";
import { CanvasHost } from "./engine/renderer";
import { bindInput } from "./engine/input";
import { BoardViewport } from "./engine/viewport";
import { FeedbackController } from "./feedback/controller";
import { SemanticFeedback } from "./feedback/semantic";
import { InteractionFeedback } from "./feedback/interaction";
import { parseRoute, shareHash } from "./app/route";
import type { Snapshot } from "./engine/contract";

const root = document.querySelector<HTMLDivElement>("#app")!;
const settings = readSettings();
let text = dictionary(settings.locale);
let request = 0;
let current: Player | null = null;
const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  value = "",
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = value;
  return node;
};
function button(label: string, action: () => void, className = "") {
  const b = el("button", className, label);
  b.type = "button";
  b.onclick = action;
  return b;
}
function localized<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  key: TextKey,
  className = "",
) {
  const n = el(tag, className, text[key]);
  n.dataset.i18n = key;
  return n;
}
function action(key: TextKey, fn: () => void, className = "") {
  const b = button(text[key], fn, className);
  b.dataset.i18n = key;
  return b;
}
function toast(message: string) {
  document.querySelector(".toast")?.remove();
  const n = el("div", "toast", message);
  n.setAttribute("role", "status");
  document.body.append(n);
  setTimeout(() => n.remove(), 3500);
}
function updateSettings() {
  text = dictionary(settings.locale);
  document.documentElement.lang = settings.locale;
  document.documentElement.dataset.theme = settings.dark ? "dark" : "light";
  document.documentElement.dataset.reduced = String(settings.reduced);
  if (!writeSettings(settings)) toast(text.storage);
  document
    .querySelectorAll<HTMLElement>("[data-i18n]")
    .forEach((n) => (n.textContent = text[n.dataset.i18n as TextKey]));
  current?.localeChanged();
  current?.session?.setReducedMotion(settings.reduced);
  current?.feedback?.cancel();
}
function showDialog(
  title: string,
  render: (dialog: HTMLDialogElement) => void,
  onCancel?: () => void,
) {
  const previous = document.activeElement as HTMLElement | null;
  const dialog = el("dialog");
  dialog.append(el("h2", "", title));
  render(dialog);
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    onCancel?.();
    dialog.close();
  });
  dialog.addEventListener(
    "close",
    () => {
      dialog.remove();
      if (previous?.isConnected) previous.focus();
    },
    { once: true },
  );
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}
function settingsDialog() {
  showDialog(text.settings, (d) => {
    for (const [key, label] of [
      ["dark", "dark"],
      ["sound", "sound"],
      ["reduced", "motion"],
    ] as const) {
      const l = el("label", "check");
      const check = el("input");
      check.type = "checkbox";
      check.checked = settings[key];
      check.onchange = () => {
        settings[key] = check.checked;
        updateSettings();
      };
      l.append(check, localized("span", label));
      d.append(l);
    }
    d.append(action("close", () => d.close(), "primary"));
  });
}
function shell() {
  root.replaceChildren();
  const header = el("header");
  const brand = button("Puzzle Studio", () => (location.hash = "#/"), "brand");
  brand.prepend(el("span", "brand-icon", "▦"));
  header.append(brand);
  const actions = el("div", "header-actions");
  actions.append(
    button(settings.locale.toUpperCase(), () => {
      settings.locale = settings.locale === "en" ? "vi" : "en";
      updateSettings();
      if (!current) void route();
      else localeButton.textContent = settings.locale.toUpperCase();
    }),
    button(settings.dark ? "☀" : "☾", () => {
      settings.dark = !settings.dark;
      updateSettings();
    }),
    action("settings", settingsDialog),
  );
  const localeButton = actions.firstElementChild!;
  header.append(actions);
  root.append(header);
  const main = el("main", "shell");
  root.append(main);
  const footer = el("footer");
  footer.append(localized("div", "credits"));
  const license = el("a", "", "LICENCE");
  license.href = `${import.meta.env.BASE_URL}licenses/LICENCE`;
  footer.append(license);
  root.append(footer);
  return main;
}
function library(main: HTMLElement) {
  const intro = el("div", "library-intro");
  intro.append(
    el("div", "eyebrow", "38 puzzles · Simon Tatham"),
    el("h1", "", text.tagline),
  );
  main.append(intro);
  void latestSave()
    .then((save) => {
      if (!save || !main.isConnected) return;
      const game = catalog.find((g) => g.id === save.gameId);
      if (!game) return;
      const resume = el("div", "toolbar");
      resume.append(
        el("span", "muted", game.name),
        action(
          "resume",
          () => (location.hash = `#/play/${game.id}`),
          "primary",
        ),
      );
      intro.append(resume);
    })
    .catch(() => {
      if (main.isConnected) toast(text.storage);
    });
  const controls = el("div", "library-controls"),
    search = el("input", "search");
  search.placeholder = text.search;
  search.setAttribute("aria-label", text.search);
  controls.append(search);
  const filters = el("div", "filters");
  let category = "all";
  let favorites = false;
  const grid = el("div", "grid");
  const render = () => {
    grid.replaceChildren();
    for (const game of catalog) {
      if (category !== "all" && category !== game.category) continue;
      if (favorites && !settings.favorites.includes(game.id)) continue;
      if (
        !normalize(game.name + " " + game.vi).includes(normalize(search.value))
      )
        continue;
      const card = el("article", "card");
      if ((thumbnails as string[]).includes(game.id)) {
        const image = el("img", "thumbnail");
        image.src = `${import.meta.env.BASE_URL}assets/boards/${game.id}.png`;
        image.alt = game.name;
        image.loading = "lazy";
        card.append(image);
      }
      const title = el("div", "card-title");
      const names = el("div");
      names.append(el("h2", "", game.name));
      if (settings.locale === "vi") names.append(el("span", "muted", game.vi));
      title.append(names);
      const favorite = button(
        settings.favorites.includes(game.id) ? "★" : "☆",
        () => {
          const i = settings.favorites.indexOf(game.id);
          if (i < 0) settings.favorites.push(game.id);
          else settings.favorites.splice(i, 1);
          writeSettings(settings);
          render();
        },
        "favorite",
      );
      favorite.setAttribute("aria-label", text.favorites + " " + game.name);
      favorite.setAttribute(
        "aria-pressed",
        String(settings.favorites.includes(game.id)),
      );
      title.append(favorite);
      card.append(
        title,
        el("p", "muted", game.description[settings.locale]),
        action("play", () => (location.hash = `#/play/${game.id}`), "primary"),
      );
      grid.append(card);
    }
    if (!grid.children.length) grid.append(el("div", "empty", text.empty));
  };
  for (const id of [
    "all",
    "numbers",
    "lines",
    "regions",
    "colors",
    "movement",
  ] as const) {
    const b = action(id, () => {
      category = id;
      filters
        .querySelectorAll("button")
        .forEach((n) => n.setAttribute("aria-pressed", String(n === b)));
      render();
    });
    b.setAttribute("aria-pressed", String(category === id));
    filters.append(b);
  }
  const fav = action("favorites", () => {
    favorites = !favorites;
    fav.setAttribute("aria-pressed", String(favorites));
    render();
  });
  filters.append(fav);
  controls.append(filters);
  main.append(controls, grid);
  search.oninput = render;
  render();
}
type Rules = {
  en: { goal: string; input: string; rules: string[] };
  vi: { goal: string; input: string; rules: string[] };
};
const rulesFiles = import.meta.glob<Rules>("./content/games/*.json", {
  import: "default",
});
class Player {
  session: EmscriptenSession | null = null;
  feedback: FeedbackController | null = null;
  private save: SaveController | null = null;
  private input: ReturnType<typeof bindInput> | null = null;
  private unsubscribe: (() => void) | null = null;
  private viewportController: BoardViewport | null = null;
  private dialog: HTMLDialogElement | null = null;
  private mode = 0;
  private disposed = false;
  private rules: Rules | null = null;
  private semantic: SemanticFeedback | null = null;
  private interaction: InteractionFeedback | null = null;
  private canvas = el("canvas");
  private board = el("div", "board-surface");
  private wrap = el("div", "board-wrap");
  private guide = el("aside", "guide");
  private result = el("div", "status");
  private engineStatus = el("div", "engine-status");
  private preset = el("select");
  private undo = action("undo", () => this.session?.execute("undo"));
  private redo = action("redo", () => this.session?.execute("redo"));
  private status: Snapshot | null = null;
  private viewport = el("div", "viewport");
  private zoom = el("input");
  constructor(
    private main: HTMLElement,
    readonly id: string,
  ) {}
  async start(fullId?: string, token?: number, discardSave = false) {
    this.main.append(el("div", "loading", text.loading));
    try {
      const host = new CanvasHost(this.canvas, this.id);
      const session = (this.session = new EmscriptenSession(host));
      session.subscribe((e) => {
        if (e.type === "error") {
          if (this.dialog) {
            this.dialog.querySelector(".dialog-error")!.textContent =
              engineText(e.message, settings.locale);
          } else toast(engineText(e.message, settings.locale));
        }
      });
      await session.start(this.id, fullId);
      if (this.disposed || token !== request) return;
      session.setReducedMotion(settings.reduced);
      let restoreFailed = false;
      if (!fullId && !discardSave) {
        let saved;
        try {
          saved = await readSave(this.id);
        } catch (e) {
          if (e instanceof InvalidSaveError) restoreFailed = true;
          else toast(text.storage);
        }
        if (saved) {
          try {
            session.restore(saved.data, {
              assistance: saved.assistance,
              celebrated: saved.celebrated,
            });
          } catch {
            restoreFailed = true;
          }
        }
      }
      if (this.disposed || token !== request) return;
      if (restoreFailed) {
        session.dispose();
        this.session = null;
        this.main.replaceChildren(
          el("div", "error", text.restoreError),
          action(
            "fresh",
            () => void this.start(undefined, token, true),
            "primary",
          ),
          action("back", () => (location.hash = "#/")),
        );
        return;
      }
      this.rules = await rulesFiles[`./content/games/${this.id}.json`]();
      if (this.disposed || token !== request) return;
      this.mount();
      this.save = new SaveController(session, this.id, session.buildId, () =>
        toast(text.storage),
      );
      if (!restoreFailed) this.save.markDirty();
      this.feedback = new FeedbackController(
        session,
        this.board,
        settings,
        (s) => this.update(s),
      );
      if (this.id === "net" || this.id === "lightup")
        this.semantic = new SemanticFeedback(session, this.wrap, settings);
      this.interaction = new InteractionFeedback(session, this.wrap, settings,
        catalog.find((game) => game.id === this.id)!.category);
      this.unsubscribe = session.subscribe((e) => {
        if (e.type === "state-changed") this.update(e.snapshot);
      });
      host.onDialog = () => this.configDialog(host);
      host.onClose = () => {
        this.dialog?.close();
        this.dialog = null;
      };
      host.onStatus = (value) => {
        this.engineStatus.textContent = engineText(value, settings.locale);
      };
      this.input = bindInput(this.canvas, session, () =>
        this.viewportController?.blocksGameInput ? null : this.mode,
      );
      this.viewportController = new BoardViewport(
        session,
        this.viewport,
        this.wrap,
        this.zoom,
        () => this.input?.cancel(),
        () => this.cancelFeedback(),
      );
      this.update(session.snapshot());
      this.localeChanged();
    } catch (e) {
      if (this.disposed) return;
      this.session?.dispose();
      this.session = null;
      this.main.replaceChildren(
        el(
          "div",
          "error",
          `${text.error} ${e instanceof Error ? e.message : String(e)}`,
        ),
        action("retry", () => void route(), "primary"),
        action("back", () => (location.hash = "#/")),
      );
    }
  }
  private mount() {
    this.main.replaceChildren();
    const game = catalog.find((g) => g.id === this.id)!;
    const heading = el("div", "player-heading"),
      names = el("div");
    names.append(
      action("back", () => (location.hash = "#/")),
      el("h1", "player-title", game.name),
    );
    const options = el("div", "toolbar");
    this.preset.setAttribute("aria-label", text.preset);
    for (const [index, name] of this.session!.presets().entries()) {
      const o = el("option", "", name);
      o.value = String(index);
      this.preset.append(o);
    }
    this.preset.value = String(this.session!.host.selectedPreset);
    this.preset.onchange = () =>
      this.session!.selectPreset(Number(this.preset.value));
    options.append(this.preset);
    if (this.session!.snapshot().canConfigure)
      options.append(
        action("config", () => this.session!.configure("settings")),
      );
    options.append(
      action("share", () => void this.share()),
      action("help", () => this.helpDialog()),
      action("focus", () => this.main.classList.toggle("focus")),
    );
    heading.append(names, options);
    this.main.append(heading);
    const layout = el("div", "player-layout");
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute("aria-label", game.name);
    this.wrap.append(this.canvas);
    this.viewport.append(this.wrap);
    this.board.append(this.viewport);
    const toolbar = el("div", "toolbar");
    toolbar.append(
      this.undo,
      this.redo,
      action("new", () => this.session!.execute("new"), "primary"),
      action("restart", () => this.session!.execute("restart")),
    );
    if (this.session!.snapshot().canSolve)
      toolbar.append(action("solve", () => this.session!.execute("solve")));
    this.board.append(toolbar);
    const modes = el("div", "toolbar");
    for (const [index, key] of ["primary", "middle", "secondary"].entries()) {
      const b = action(key as TextKey, () => {
        this.mode = index;
        modes
          .querySelectorAll("button")
          .forEach((n) => n.setAttribute("aria-pressed", String(n === b)));
      });
      b.setAttribute("aria-pressed", String(index === 0));
      modes.append(b);
    }
    this.board.append(modes);
    if (game.input === "keypad") {
      const keys = el("div", "keypad");
      const symbols =
        this.id === "undead"
          ? ["G", "V", "Z", " "]
          : ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", " "];
      for (const value of symbols) {
        const b = button(value === " " ? text.clear : value, () =>
          this.session!.input({
            kind: "key",
            key: value,
            shift: false,
            ctrl: false,
            alt: false,
          }),
        );
        if (value === " ") b.dataset.i18n = "clear";
        keys.append(b);
      }
      this.board.append(keys);
      if (this.id !== "undead") {
        const extra = el("details");
        extra.append(el("summary", "", "A–Z"));
        const letters = el("div", "keypad");
        for (const value of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
          letters.append(
            button(value, () =>
              this.session!.input({
                kind: "key",
                key: value,
                shift: false,
                ctrl: false,
                alt: false,
              }),
            ),
          );
        }
        extra.append(letters);
        this.board.append(extra);
      }
    }
    const controls = el("div", "player-options");
    controls.append(
      action("id", () => this.session!.configure("id")),
      action("seed", () => this.session!.configure("seed")),
    );
    const label = el("label", "zoom-label");
    label.append(localized("span", "zoom"));
    this.zoom.type = "range";
    this.zoom.min = "100";
    this.zoom.max = "300";
    this.zoom.step = "1";
    this.zoom.value = "100";
    this.zoom.setAttribute("aria-label", text.zoom);
    label.append(this.zoom);
    controls.append(label);
    const pan = action("pan", () =>
      pan.setAttribute(
        "aria-pressed",
        String(this.viewportController?.togglePan()),
      ),
    );
    pan.setAttribute("aria-pressed", "false");
    controls.append(pan);
    this.result.setAttribute("role", "status");
    this.result.setAttribute("aria-live", "polite");
    this.board.append(controls, this.result, this.engineStatus);
    layout.append(this.board, this.guide);
    this.main.append(layout);
  }
  private update(s: Snapshot) {
    this.status = s;
    this.board.dataset.state = s.status;
    this.board.dataset.assistance = s.assistance;
    this.undo.disabled = !s.canUndo;
    this.redo.disabled = !s.canRedo;
    this.preset.value = String(this.session?.host.selectedPreset);
    this.result.textContent =
      text[
        s.status === "completed"
          ? s.assistance === "none"
            ? "completed"
            : "assisted"
          : s.status === "failed"
            ? "failed"
            : "playing"
      ];
    this.engineStatus.textContent = engineText(
      this.session?.host.status || "",
      settings.locale,
    );
  }
  localeChanged() {
    this.cancelFeedback();
    if (this.session) {
      this.session.host.clearPalette();
      this.session.repaint();
    }
    const game = catalog.find((g) => g.id === this.id)!;
    const title = this.main.querySelector(".player-title");
    if (title)
      title.textContent =
        settings.locale === "vi" ? `${game.name} · ${game.vi}` : game.name;
    if (this.rules) {
      this.guide.replaceChildren(
        localized("h2", "help"),
        el("p", "", this.rules[settings.locale].goal),
        el("p", "muted", this.rules[settings.locale].input),
      );
      const details = el("details");
      details.append(localized("summary", "rules"));
      this.appendRules(details);
      this.guide.append(details);
    }
    if (this.status) this.update(this.status);
    for (const [i, option] of Array.from(this.preset.options).entries())
      option.textContent = engineText(
        this.session?.presets()[i] || "",
        settings.locale,
      );
  }
  cancelFeedback() {
    this.feedback?.cancel();
    this.semantic?.cancel();
    this.interaction?.cancel();
  }
  private appendRules(target: HTMLElement) {
    for (const rule of this.rules![settings.locale].rules)
      target.append(el("p", "", rule));
    const link = el("a", "", text.source);
    link.href = `https://www.chiark.greenend.org.uk/~sgtatham/puzzles/doc/${this.id === "rect" ? "rectangles" : this.id}.html`;
    link.target = "_blank";
    link.rel = "noopener";
    target.append(link);
  }
  private helpDialog() {
    if (!this.rules) return;
    showDialog(text.help, (d) => {
      d.append(
        el("p", "", this.rules![settings.locale].goal),
        el("p", "", this.rules![settings.locale].input),
      );
      this.appendRules(d);
      d.append(action("close", () => d.close(), "primary"));
    });
  }
  private async share() {
    const url = new URL(location.href);
    url.hash = shareHash(
      this.id,
      this.session!.snapshot().shareGameId,
      settings.locale,
    );
    try {
      await navigator.clipboard.writeText(url.href);
      toast(text.saved);
    } catch {
      showDialog(text.share, (d) => {
        const input = el("input");
        input.value = url.href;
        input.readOnly = true;
        input.style.width = "100%";
        d.append(
          input,
          action("close", () => d.close()),
        );
        input.select();
      });
    }
  }
  private configDialog(host: CanvasHost) {
    this.dialog = showDialog(
      engineText(host.title, settings.locale),
      (d) => {
        const fields = host.fields.map((f) => ({ ...f }));
        const nodes: (HTMLInputElement | HTMLSelectElement)[] = [];
        for (const f of fields) {
          const label = el("label", "", engineText(f.label, settings.locale));
          let input: HTMLInputElement | HTMLSelectElement;
          if (f.type === 1) {
            const select = el("select");
            for (const [i, value] of f.value
              .slice(1)
              .split(f.value[0])
              .entries()) {
              const o = el("option", "", engineText(value, settings.locale));
              o.value = String(i);
              select.append(o);
            }
            select.value = String(f.selected);
            input = select;
          } else {
            const n = el("input");
            n.type = f.type === 2 ? "checkbox" : "text";
            if (f.type === 2) {
              n.checked = !!f.selected;
              label.classList.add("check");
            } else n.value = f.value;
            input = n;
          }
          nodes.push(input);
          label.append(input);
          d.append(label);
        }
        const error = el("p", "dialog-error");
        error.setAttribute("role", "alert");
        d.append(error);
        const toolbar = el("div", "toolbar");
        toolbar.append(
          action("cancel", () => this.session!.cancelConfig()),
          action(
            "apply",
            () => {
              fields.forEach((f, i) => {
                if (f.type === 0) f.value = nodes[i].value;
                else
                  f.selected =
                    f.type === 2
                      ? +(nodes[i] as HTMLInputElement).checked
                      : Number(nodes[i].value);
              });
              this.session!.submitConfig(fields);
            },
            "primary",
          ),
        );
        d.append(toolbar);
      },
      () => this.session?.cancelConfig(),
    );
  }
  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.input?.dispose();
    this.viewportController?.dispose();
    this.semantic?.dispose();
    this.interaction?.dispose();
    this.feedback?.dispose();
    this.unsubscribe?.();
    this.dialog?.close();
    await this.save?.dispose();
    this.session?.dispose();
    this.session = null;
  }
}
async function route() {
  const token = ++request;
  const old = current;
  current = null;
  await old?.dispose();
  if (token !== request) return;
  const route = parseRoute(
    location.hash,
    catalog.map((g) => g.id),
  );
  if (route.locale) {
    settings.locale = route.locale;
    updateSettings();
  }
  const main = shell();
  if (route.error) {
    main.append(
      el("div", "error", text.error),
      action("back", () => (location.hash = "#/")),
    );
    return;
  }
  if (!route.id) {
    library(main);
    return;
  }
  current = new Player(main, route.id);
  await current.start(route.fullId, token);
}
updateSettings();
window.addEventListener("hashchange", () => void route());
void route();
