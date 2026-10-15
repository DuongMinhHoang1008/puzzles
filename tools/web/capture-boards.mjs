import { chromium } from "../../web/node_modules/playwright/index.mjs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = new URL("../../", import.meta.url);
const catalog = JSON.parse(
  await readFile(new URL("tools/web/games.manifest.json", root)),
);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_PATH
    ? { executablePath: process.env.BROWSER_PATH }
    : {}),
});
const page = await browser.newPage({
  viewport: { width: 800, height: 900 },
  deviceScaleFactor: 1,
});
const base = process.env.PREVIEW_URL || "http://127.0.0.1:5173/puzzles/";
const dest = new URL("web/public/assets/boards/", root);
await mkdir(dest, { recursive: true });
const fixtures = {};
const inventory = {};
try {
  for (const { id } of catalog) {
    await page.goto(base + `#/play/${id}`);
    await page.locator(".board-wrap > canvas").waitFor();
    await page
      .getByRole("button", { name: "Random seed", exact: true })
      .click();
    const seed = page.locator("dialog input[type=text]").first();
    const value = (await seed.inputValue()).replace(/#.*$/, "#0");
    await seed.fill(value);
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await page.locator("dialog").waitFor({ state: "hidden" });
    fixtures[id] = { seed: value };
    await page.waitForTimeout(100);
    await page
      .locator(".board-wrap > canvas")
      .screenshot({ path: fileURLToPath(new URL(id + ".png", dest)) });
    const strings = await page
      .locator(".player-heading select option")
      .allTextContents();
    strings.push(await page.locator(".engine-status").innerText());
    const config = page.getByRole("button", { name: "Customise", exact: true });
    if (await config.count()) {
      await config.click();
      strings.push(await page.locator("dialog h2").innerText());
      strings.push(
        ...(await page
          .locator("dialog label")
          .evaluateAll((labels) =>
            labels.map((n) => n.childNodes[0]?.textContent || ""),
          )),
      );
      strings.push(...(await page.locator("dialog option").allTextContents()));
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
    }
    inventory[id] = [...new Set(strings.filter(Boolean))];
    console.log(`Captured ${id}`);
  }
  await writeFile(
    new URL("tools/web/thumbnail-fixtures.json", root),
    JSON.stringify(fixtures, null, 2) + "\n",
  );
  await writeFile(
    new URL("web/src/content/thumbnails.json", root),
    JSON.stringify(Object.keys(fixtures), null, 2) + "\n",
  );
  await writeFile(
    new URL("docs/web-engine-string-inventory.json", root),
    JSON.stringify(inventory, null, 2) + "\n",
  );
} finally {
  await browser.close();
}
