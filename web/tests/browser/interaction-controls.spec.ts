import { test, expect } from "@playwright/test";

test("touch input paints feedback only after a tap reaches the engine", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 850 }, hasTouch: true, deviceScaleFactor: 3 });
  const page = await context.newPage();
  await page.goto("./#/play/lightup?game=3x3%3Ai");
  const canvas = page.locator(".board-wrap > canvas");
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  await canvas.tap({ position: { x: box.width / 2, y: box.height / 2 } });
  await expect(page.locator(".paint-feedback.move")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Pan board", exact: true }).click();
  await expect(page.locator(".interaction-overlay > *")).toHaveCount(0);
  await canvas.tap({ position: { x: box.width / 4, y: box.height / 4 } });
  await expect(page.locator(".interaction-overlay > *")).toHaveCount(0);
  await context.close();
});

test("on-screen Sudoku keypad highlights the changed cell", async ({ page }) => {
  await page.goto("./#/play/solo?game=3x3%230");
  const canvas = page.locator(".board-wrap > canvas");
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  for (const fraction of [.25, .5, .75]) {
    await canvas.click({ position: { x: box.width * fraction, y: box.height / 2 } });
    await page.getByRole("button", { name: "1", exact: true }).click();
    if (await undo.isEnabled()) break;
  }
  await expect(undo).toBeEnabled();
  await expect(page.locator(".paint-feedback.move")).toHaveCount(1);
});

test("rapid moves bound transient effects and navigation removes them", async ({ page }) => {
  await page.goto("./#/play/net?game=5x5%230");
  const canvas = page.locator(".board-wrap > canvas");
  await expect(canvas).toBeVisible();
  for (let i = 0; i < 15; i++) await canvas.press("Enter");
  expect(await page.locator(".interaction-overlay > *").count()).toBeLessThanOrEqual(8);
  await page.getByRole("button", { name: "Back to library", exact: true }).click();
  await expect(page.locator(".interaction-overlay, .paint-feedback, .move-ripple")).toHaveCount(0);
});
