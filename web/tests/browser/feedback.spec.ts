import { test, expect } from "@playwright/test";
test("Map polish keeps native colours and Solve does not trigger a victory burst", async ({ page }) => {
  await page.goto("./#/play/map");
  await expect(page.locator(".board-wrap > canvas")).toBeVisible();
  await expect(page.locator('.toolbar button[aria-pressed="true"]')).toHaveCount(1);
  await page.getByRole("button", { name: "Solve", exact: true }).click();
  await expect(page.locator(".board-surface")).toHaveAttribute("data-assistance", "used-solve");
  await expect(page.locator(".win-spark")).toHaveCount(0);
  await page.screenshot({ path: "test-results/polish-map.png", fullPage: true });
});
test("accepted moves ripple, natural wins celebrate once, reduced motion stays still", async ({ page }) => {
  await page.goto("./#/play/net?game=2x1%3A44");
  const canvas = page.locator(".board-wrap > canvas");
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  const point = { position: { x: box.width * .25, y: box.height * .5 } };
  await canvas.click(point);
  await expect(page.locator(".move-ripple")).toHaveCount(1);
  await canvas.click(point);
  await expect(page.locator(".win-spark")).toHaveCount(20);
  await expect(page.locator(".board-surface")).toHaveAttribute("data-state", "completed");
  await page.screenshot({ path: "test-results/polish-completion.png", fullPage: true });
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".win-spark")).toHaveCount(0);
  await canvas.click(point);
  await expect(page.locator(".win-spark")).toHaveCount(0);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Reduced motion", { exact: true }).check();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await canvas.click(point);
  await expect(page.locator(".move-ripple, .win-spark")).toHaveCount(0);
  await expect(page.locator(".interaction-overlay > *")).toHaveCount(0);
});
test("Light Up bulb changes paint lit cells; reduced motion cancels overlays", async ({
  page,
}) => {
  await page.goto("./#/play/lightup?game=3x3%3Ai");
  const canvas = page.locator(".board-wrap > canvas");
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: box.width * 0.5, y: box.height * 0.5 } });
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".cell-feedback")).not.toHaveCount(0);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Reduced motion", { exact: true }).check();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.locator(".cell-feedback")).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await canvas.click({ position: { x: box.width * 0.5, y: box.height * 0.5 } });
  await expect(page.locator(".cell-feedback")).toHaveCount(0);
});
test("Net paint responds within the next frame budget on the reference desktop", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let start = 0;
    const samples: number[] = [];
    document.addEventListener(
      "pointerdown",
      (e) => {
        if (e.target instanceof HTMLCanvasElement) start = performance.now();
      },
      true,
    );
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (
      this: CanvasRenderingContext2D,
      ...args: Parameters<typeof draw>
    ) {
      if (start && this.canvas.isConnected) {
        samples.push(performance.now() - start);
        start = 0;
      }
      return draw.apply(this, args);
    } as typeof draw;
    Object.defineProperty(window, "paintTestSamples", {
      value: () => samples.slice(),
    });
  });
  await page.goto("./#/play/net?game=5x5%230");
  const canvas = page.locator(".board-wrap > canvas");
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  for (let i = 0; i < 8; i++)
    await canvas.click({
      position: { x: box.width * 0.25, y: box.height * 0.25 },
    });
  const samples = await page.evaluate(() =>
    (
      window as unknown as { paintTestSamples: () => number[] }
    ).paintTestSamples(),
  );
  expect(samples.length).toBe(8);
  expect(Math.max(...samples)).toBeLessThan(50);
  await test
    .info()
    .attach("input-to-canvas-paint-ms", {
      body: Buffer.from(JSON.stringify(samples)),
      contentType: "application/json",
    });
});
