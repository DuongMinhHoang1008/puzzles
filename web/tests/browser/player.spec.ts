import { test, expect } from "@playwright/test";
import catalog from "../../../tools/web/games.manifest.json" with { type: "json" };
test("library does not eagerly load any engine", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (/\.wasm/.test(r.url())) requests.push(r.url());
  });
  await page.goto("./");
  await expect(page.locator(".card")).toHaveCount(38);
  expect(requests).toEqual([]);
});
test("Net: accepted moves, undo/redo, restore, theme and locale", async ({
  page,
}) => {
  await page.goto("./#/play/net?game=5x5%230");
  const canvas = page.locator(".board-wrap > canvas");
  await expect(canvas).toBeVisible();
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  await expect(undo).toBeDisabled();
  await canvas.click({ position: { x: 50, y: 50 } });
  await expect(undo).toBeEnabled();
  await undo.click();
  await expect(
    page.getByRole("button", { name: "Redo", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.waitForTimeout(650);
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Hoàn tác", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Cài đặt", exact: true }).click();
  await page.getByLabel("Giao diện tối").check();
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Hoàn tác", exact: true }),
  ).toBeEnabled();
  await page.goto("./#/play/net");
  await expect(canvas).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Hoàn tác", exact: true }),
  ).toBeEnabled();
});
test("Net: ignored click, invalid config and Solve/Undo semantics", async ({
  page,
}) => {
  await page.goto("./#/play/net?game=5x5%230");
  const canvas = page.locator(".board-wrap > canvas");
  await expect(canvas).toBeVisible();
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  await canvas.click({ position: { x: 2, y: 2 } });
  await expect(undo).toBeDisabled();
  await page.getByRole("button", { name: "Customise", exact: true }).click();
  await page.getByLabel("Width", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.locator("dialog .dialog-error")).not.toBeEmpty();
  await expect(page.locator("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(undo).toBeDisabled();
  await page.getByRole("button", { name: "Solve", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Solved with assistance");
  await undo.click();
  await expect(page.getByRole("status")).toHaveText("Take your time.");
});
test("late module load cannot replace a newer game", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/net.*.js", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.continue();
  });
  await page.goto("./#/play/net");
  await page
    .getByRole("button", { name: "Puzzle Studio", exact: false })
    .click();
  await expect(page.locator(".card")).toHaveCount(38);
  await page.goto("./#/play/solo");
  await expect(page.locator(".board-wrap > canvas")).toBeVisible();
  await page.waitForTimeout(700);
  await expect(page.locator(".player-title")).toHaveText("Solo");
  await expect(page.locator(".board-wrap > canvas")).toHaveCount(1);
  expect(errors).toEqual([]);
});
for (const game of catalog) {
  test(`engine smoke: ${game.id}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`./#/play/${game.id}`);
    await expect(page.locator(".board-wrap > canvas")).toBeVisible();
    expect(
      await page
        .locator(".board-wrap > canvas")
        .evaluate((c) => (c as HTMLCanvasElement).width),
    ).toBeGreaterThan(0);
    await page.getByRole("button", { name: "New game", exact: true }).click();
    await expect(page.locator(".board-wrap > canvas")).toBeVisible();
    await page.getByRole("button", { name: "Restart", exact: true }).click();
    await page.getByRole("button", { name: "Back to library" }).click();
    await expect(page.locator(".card")).toHaveCount(38);
    expect(errors).toEqual([]);
  });
}
