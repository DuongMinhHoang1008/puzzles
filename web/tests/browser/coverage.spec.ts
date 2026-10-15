import { test, expect, type Page } from "@playwright/test";
import catalog from "../../../tools/web/games.manifest.json" with { type: "json" };
import fixtures from "../../../tools/web/thumbnail-fixtures.json" with { type: "json" };

async function saved(page: Page, id: string) {
  return page.evaluate(async (id) => {
    if (!(await indexedDB.databases()).some((d) => d.name === "puzzle-studio"))
      return null;
    return new Promise<{
      text: string;
      assistance: string;
      celebrated: boolean;
    } | null>((resolve, reject) => {
      const r = indexedDB.open("puzzle-studio");
      r.onerror = () => reject(r.error);
      r.onsuccess = () => {
        const db = r.result;
        const q = db.transaction("saves").objectStore("saves").get(id);
        q.onerror = () => {
          db.close();
          reject(q.error);
        };
        q.onsuccess = () => {
          const s = q.result;
          db.close();
          resolve(
            s
              ? {
                  text: new TextDecoder().decode(s.data),
                  assistance: s.assistance,
                  celebrated: s.celebrated,
                }
              : null,
          );
        };
      };
    });
  }, id);
}
function field(text: string, key: string) {
  const match = new RegExp(`^${key} *:(\\d+):([^\\n]*)`, "m").exec(text);
  return match?.[2].slice(0, Number(match[1]));
}
async function move(page: Page, id: string) {
  const canvas = page.locator(".board-wrap > canvas"),
    undo = page.getByRole("button", { name: "Undo", exact: true });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  if (id === "guess") {
    await canvas.press("ArrowLeft");
    for (let i = 0; i < 4; i++) {
      await canvas.press("Enter");
      await canvas.press("ArrowRight");
    }
    await canvas.press("Enter");
  } else if (id === "pegs") {
    const box = (await canvas.boundingBox())!;
    const size = box.width / 8;
    await page.mouse.move(box.x + size * 2, box.y + size * 4);
    await page.mouse.down();
    await page.mouse.move(box.x + size * 4, box.y + size * 4, { steps: 5 });
    await page.mouse.up();
  } else {
    for (const key of [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Enter",
    ]) {
      await canvas.press(key);
      if (await undo.isEnabled()) return;
    }
    const box = (await canvas.boundingBox())!;
    for (const fraction of [0.5, 0.25, 0.75]) {
      await canvas.click({
        position: { x: box.width * fraction, y: box.height * 0.5 },
      });
      if (id === "samegame")
        await canvas.click({
          position: { x: box.width * fraction, y: box.height * 0.5 },
        });
      if (await undo.isEnabled()) return;
    }
  }
  await expect(undo, `${id}: meaningful committed input`).toBeEnabled();
}
for (const { id } of catalog) {
  test(`history/config/restore: ${id}`, async ({ page }) => {
    const seed = (fixtures as Record<string, { seed: string }>)[id].seed;
    await page.goto(`./#/play/${id}?game=${encodeURIComponent(seed)}`);
    await expect(page.locator(".board-wrap > canvas")).toBeVisible();
    if (id === "mines")
      await page.locator(".board-wrap > canvas").click({ position: { x: 80, y: 80 } });
    const solve = page.getByRole("button", { name: "Solve", exact: true });
    if (await solve.count()) await solve.click();
    else await move(page, id);
    await expect(
      page.getByRole("button", { name: "Undo", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Redo", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect
      .poll(async () =>
        Number(field((await saved(page, id))?.text || "", "NSTATES") || 0),
      )
      .toBeGreaterThan(1);
    await expect.poll(async () => await saved(page, id)).not.toBeNull();
    const before = (await saved(page, id))!;
    await page.getByRole("button", { name: "Back to library" }).click();
    await page.goto(`./#/play/${id}`);
    await expect(page.locator(".board-wrap > canvas")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Undo", exact: true }),
    ).toBeEnabled();
    await expect
      .poll(async () => field((await saved(page, id))?.text || "", "DESC"))
      .toBe(field(before.text, "DESC"));
    const preset = page.locator(".player-heading select");
    if ((await preset.locator("option").count()) > 1) {
      await preset.selectOption("1");
      await expect(
        page.getByRole("button", { name: "Undo", exact: true }),
      ).toBeDisabled();
    }
    await page.getByRole("button", { name: "Game ID", exact: true }).click();
    await page.locator("dialog input[type=text]").fill("not-a-puzzle-id:!");
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(page.locator(".dialog-error")).not.toBeEmpty();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Ván mới", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cách chơi", exact: true }).click();
    await expect(page.locator("dialog p")).toHaveCount(5);
    await page.getByRole("button", { name: "Đóng", exact: true }).click();
  });
}

test("Solve remains assisted after Undo and reload; New resets metadata", async ({
  page,
}) => {
  await page.goto("./#/play/net");
  await page.getByRole("button", { name: "Solve", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(async () => (await saved(page, "net"))?.assistance)
    .toBe("used-solve");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Redo", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Solved with assistance");
  await page.getByRole("button", { name: "New game", exact: true }).click();
  await expect
    .poll(async () => (await saved(page, "net"))?.assistance)
    .toBe("none");
});
test("corrupt save stays stored until explicit fresh-game choice", async ({
  page,
}) => {
  await page.goto("./#/play/net");
  await expect.poll(() => saved(page, "net")).not.toBeNull();
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const r = indexedDB.open("puzzle-studio");
        r.onsuccess = () => {
          const db = r.result;
          const t = db.transaction("saves", "readwrite");
          const store = t.objectStore("saves");
          const q = store.get("net");
          q.onsuccess = () =>
            store.put({
              ...q.result,
              data: new TextEncoder().encode("broken"),
            });
          t.oncomplete = () => {
            db.close();
            resolve();
          };
          t.onerror = () => reject(t.error);
        };
      }),
  );
  await page.reload();
  await expect(page.locator(".board-wrap > canvas")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Start a new game", exact: true }),
  ).toBeVisible();
  expect((await saved(page, "net"))?.text).toBe("broken");
  await page
    .getByRole("button", { name: "Start a new game", exact: true })
    .click();
  await expect(page.locator(".board-wrap > canvas")).toBeVisible();
  await expect
    .poll(async () => (await saved(page, "net"))?.text)
    .not.toBe("broken");
});
test("storage unavailable does not block gameplay", async ({ page }) => {
  await page.addInitScript(() => {
    IDBFactory.prototype.open = () => {
      throw new DOMException("Unavailable", "SecurityError");
    };
  });
  await page.goto("./#/play/net");
  await expect(page.locator(".board-wrap > canvas")).toBeVisible();
  await page.locator(".board-wrap > canvas").click({ position: { x: 50, y: 50 } });
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeEnabled();
});
test("completed Net is celebrated once and remains so after Undo/Redo/reload", async ({
  page,
}) => {
  await page.goto("./#/play/net?game=2x1%3A44");
  const canvas = page.locator(".board-wrap > canvas");
  await expect(canvas).toBeVisible();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  const box = (await canvas.boundingBox())!;
  const point = { position: { x: box.width * 0.25, y: box.height * 0.5 } };
  await canvas.click(point);
  await canvas.click(point);
  await expect(page.getByRole("status")).toHaveText("Puzzle completed");
  await expect
    .poll(async () => (await saved(page, "net"))?.celebrated)
    .toBe(true);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await canvas.click(point);
  await expect(page.getByRole("status")).toHaveText("Puzzle completed");
  expect((await saved(page, "net"))?.celebrated).toBe(true);
  await page.goto("./#/play/net");
  await expect(page.getByRole("status")).toHaveText("Puzzle completed");
  expect((await saved(page, "net"))?.assistance).toBe("none");
});
test("large number boards accept letter n without creating a new puzzle", async ({
  page,
}) => {
  await page.goto("./#/play/unequal");
  await page.getByRole("button", { name: "Customise", exact: true }).click();
  await page.getByLabel("Size (s*s)", { exact: true }).fill("25");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.locator("dialog")).toHaveCount(0);
  await expect
    .poll(async () =>
      field((await saved(page, "unequal"))?.text || "", "PARAMS"),
    )
    .toContain("25");
  const before = (await saved(page, "unequal"))!;
  const canvas = page.locator(".board-wrap > canvas");
  // A generated board may give the first cell; find an editable cell in the row.
  for (let i = 0; i < 25; i++) {
    await canvas.press("ArrowRight");
    await canvas.press("n");
    if (await page.getByRole("button", { name: "Undo", exact: true }).isEnabled()) break;
  }
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeEnabled();
  await expect
    .poll(async () =>
      Number(field((await saved(page, "unequal"))?.text || "", "NSTATES")),
    )
    .toBeGreaterThan(1);
  expect(field((await saved(page, "unequal"))!.text, "DESC")).toBe(
    field(before.text, "DESC"),
  );
});
