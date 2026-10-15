import { test, expect, type Page } from "@playwright/test";
import catalog from "../../../tools/web/games.manifest.json" with { type: "json" };
import fixtures from "../../../tools/web/thumbnail-fixtures.json" with { type: "json" };

async function realMove(page: Page, id: string) {
  const canvas = page.locator(".board-wrap > canvas");
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  const box = (await canvas.boundingBox())!;
  if (id === "map") {
    // Map copies colour by dragging from a given region into a blank region.
    const points = await canvas.evaluate((node) => {
      const c = node as HTMLCanvasElement, ctx = c.getContext("2d")!;
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      let source: { x: number; y: number } | null = null;
      let target: { x: number; y: number } | null = null;
      for (let y = .15; y < .9; y += .05) for (let x = .15; x < .9; x += .05) {
        const i = (Math.floor(y * c.height) * c.width + Math.floor(x * c.width)) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (!source && Math.max(r, g, b) - Math.min(r, g, b) > 40) source = { x, y };
        if (!target && Math.abs(r - g) < 3 && Math.abs(g - b) < 3 && r > 150) target = { x, y };
      }
      return { source: source!, target: target! };
    });
    expect(points.source).toBeTruthy(); expect(points.target).toBeTruthy();
    await page.mouse.move(box.x + box.width * points.source.x, box.y + box.height * points.source.y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * points.target.x, box.y + box.height * points.target.y, { steps: 6 });
    await page.mouse.up();
  }
  if (id === "pegs") {
    const tile = box.width / 8;
    await page.mouse.move(box.x + tile * 2, box.y + tile * 4);
    await page.mouse.down();
    await page.mouse.move(box.x + tile * 4, box.y + tile * 4, { steps: 5 });
    await page.mouse.up();
  }
  if (id === "guess") {
    await canvas.press("ArrowLeft");
    for (let i = 0; i < 4; i++) { await canvas.press("Enter"); await canvas.press("ArrowRight"); }
    await canvas.press("Enter");
  }
  if (await undo.isEnabled()) return;
  const keys = id === "undead" ? ["ArrowRight", "g", "v", "z", "ArrowDown", "g"] : ["ArrowRight", "1", "Enter", "Space", "2", "ArrowDown", "Enter"];
  for (const key of keys) {
    await canvas.press(key);
    if (await undo.isEnabled()) return;
  }
  for (const y of [.5, .25, .75, .05]) {
    for (const x of [.5, .25, .75, .05]) {
      await canvas.click({ position: { x: box.width * x, y: box.height * y } });
      if (id === "undead") await canvas.press("g");
      if (id === "samegame") await canvas.click({ position: { x: box.width * x, y: box.height * y } });
      if (await undo.isEnabled()) return;
      // Region and line games often commit only after a drag, not a tap.
      await page.mouse.move(box.x + box.width * x, box.y + box.height * y);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * Math.min(.95, x + .1), box.y + box.height * Math.min(.95, y + .1), { steps: 4 });
      await page.mouse.up();
      if (await undo.isEnabled()) return;
    }
  }
  await expect(undo, `${id}: commit a real in-game move without Solve`).toBeEnabled();
}

for (const { id } of catalog) {
  test(`in-game feedback: ${id}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const seed = (fixtures as Record<string, { seed: string }>)[id].seed;
    await page.goto(`./#/play/${id}?game=${encodeURIComponent(seed)}`);
    await expect(page.locator(".board-wrap > canvas")).toBeVisible();
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await page.evaluate(() => {
      const counts = { move: 0, selection: 0, contact: 0 };
      const observer = new MutationObserver(records => {
        for (const record of records) for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches(".paint-feedback.move")) counts.move++;
          if (node.matches(".paint-feedback.selection")) counts.selection++;
          if (node.matches(".move-ripple, .input-contact")) counts.contact++;
        }
      });
      observer.observe(document.querySelector(".interaction-overlay")!, { childList: true });
      Object.defineProperty(window, "interactionCounts", { value: counts });
    });
    await realMove(page, id);
    await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeEnabled();
    await expect.poll(() => page.evaluate(() => (window as unknown as { interactionCounts: { move: number } }).interactionCounts.move), { message: `${id}: accepted move visibly highlights changed board pixels` }).toBeGreaterThan(0);
    expect(errors).toEqual([]);
    if (["map", "solo", "bridges", "pegs"].includes(id)) await page.screenshot({ path: `test-results/interaction-${id}.png`, fullPage: true });
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByLabel("Reduced motion", { exact: true }).check();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect(page.locator(".interaction-overlay > *")).toHaveCount(0);
  });
}
