import { test, expect } from "@playwright/test";
for (const width of [320, 390, 768, 1024, 1440])
  for (const locale of ["en", "vi"])
    for (const dark of [false, true]) {
      test(`responsive ${width}/${locale}/${dark ? "dark" : "light"}`, async ({
        browser,
      }) => {
        const context = await browser.newContext({
          viewport: { width, height: 900 },
          deviceScaleFactor: width === 390 ? 3 : dark ? 2 : 1,
          hasTouch: width < 768,
        });
        const page = await context.newPage();
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.addInitScript(
          ({ locale, dark }) =>
            localStorage.setItem(
              "puzzle-studio-settings",
              JSON.stringify({
                locale,
                dark,
                reduced: true,
                sound: false,
                favorites: [],
              }),
            ),
          { locale, dark },
        );
        await page.goto("./");
        await expect(page.locator(".card")).toHaveCount(38);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        await page.goto("./#/play/net?game=5x5%230");
        const canvas = page.locator(".board-wrap > canvas");
        await expect(canvas).toBeVisible();
        await page.waitForTimeout(100);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        const box = (await canvas.boundingBox())!,
          point = { position: { x: box.width * 0.25, y: box.height * 0.25 } };
        if (width < 768) await canvas.tap(point);
        else await canvas.click(point);
        await expect(
          page.getByRole("button", {
            name: locale === "en" ? "Undo" : "Hoàn tác",
            exact: true,
          }),
        ).toBeEnabled();
        expect(errors).toEqual([]);
        if (width === 390 && locale === "vi" && dark)
          await page.screenshot({
            path: test.info().outputPath("mobile-vi-dark.png"),
            fullPage: true,
          });
        await context.close();
      });
    }
test("zoom and explicit pan keep history intact", async ({ page }) => {
  await page.goto("./#/play/net?game=5x5%230");
  await expect(page.locator(".board-wrap > canvas")).toBeVisible();
  await page.locator("input[type=range]").focus();
  await page.locator("input[type=range]").press("End");
  await page.getByRole("button", { name: "Pan board", exact: true }).click();
  const box = (await page.locator(".viewport").boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5, {
    steps: 5,
  });
  await page.mouse.up();
  expect(
    await page.locator(".viewport").evaluate((n) => n.scrollLeft),
  ).toBeGreaterThan(0);
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Pan board", exact: true }).click();
  await page.getByRole("button", { name: "EN", exact: true }).click();
  expect(await page.locator("input[type=range]").inputValue()).toBe("300");
});
test("two-finger pinch cancels pending touch input before changing scale", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 850 },
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("./#/play/net?game=5x5%230");
  await expect(page.locator(".board-wrap > canvas")).toBeVisible();
  await page.waitForTimeout(100);
  const box = (await page.locator(".board-wrap > canvas").boundingBox())!;
  const cdp = await context.newCDPSession(page),
    x = box.x + box.width * 0.5,
    y = box.y + box.height * 0.5;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { id: 1, x: x - 25, y },
      { id: 2, x: x + 25, y },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { id: 1, x: x - 55, y },
      { id: 2, x: x + 55, y },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  expect(
    Number(await page.locator("input[type=range]").inputValue()),
  ).toBeGreaterThan(100);
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeDisabled();
  await context.close();
});
