import { test, expect, type CDPSession, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";

async function sample(cdp: CDPSession, page: Page) {
  // Chromium retires cancelled rAF callbacks at a rendering boundary.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await cdp.send("HeapProfiler.collectGarbage");
  await page.evaluate(
    () => new Promise<void>((resolve) => setTimeout(resolve, 0)),
  );
  await cdp.send("HeapProfiler.collectGarbage");
  const memories = await page.evaluate(() =>
    (
      window as unknown as {
        wasmTestStats: () => { seen: number; retained: number };
      }
    ).wasmTestStats(),
  );
  const listeners: Record<string, number> = {};
  const listenerDetails: Record<string, unknown> = {};
  for (const target of ["window", "document"]) {
    const object = await cdp.send("Runtime.evaluate", { expression: target });
    const result = await cdp.send("DOMDebugger.getEventListeners", {
      objectId: object.result.objectId!,
    });
    listeners[target] = result.listeners.length;
    listenerDetails[target] = result.listeners.map((l) => ({
      type: l.type,
      handler: l.handler?.description,
      scriptId: l.scriptId,
    }));
    await cdp.send("Runtime.releaseObject", {
      objectId: object.result.objectId!,
    });
  }
  return {
    ...memories,
    listeners,
    listenerDetails,
    ...(await cdp.send("Runtime.getHeapUsage")),
  };
}
test("30 game changes release WASM memories and owned listeners", async ({
  page,
  context,
}) => {
  test.setTimeout(90000);
  const cdp = await context.newCDPSession(page);
  const games = ["net", "solo", "lightup"];
  const names: Record<string, string> = { net: "Net", solo: "Solo", lightup: "Light Up" };
  await page.addInitScript(() => {
    const refs: WeakRef<WebAssembly.Memory>[] = [];
    const capture = (
      result: WebAssembly.WebAssemblyInstantiatedSource | WebAssembly.Instance,
    ) => {
      const instance =
        result instanceof WebAssembly.Instance ? result : result.instance;
      if (instance.exports.memory instanceof WebAssembly.Memory)
        refs.push(new WeakRef(instance.exports.memory));
      return result;
    };
    const wasm = WebAssembly as unknown as Record<
      "instantiate" | "instantiateStreaming",
      (
        ...args: unknown[]
      ) => Promise<
        WebAssembly.WebAssemblyInstantiatedSource | WebAssembly.Instance
      >
    >;
    for (const key of ["instantiate", "instantiateStreaming"] as const) {
      const original = wasm[key];
      wasm[key] = (...args) => original.apply(WebAssembly, args).then(capture);
    }
    Object.defineProperty(window, "wasmTestStats", {
      value: () => ({
        seen: refs.length,
        retained: refs.reduce((n, r) => n + (r.deref() ? 1 : 0), 0),
      }),
    });
  });
  for (const id of games) {
    await page.goto(`./#/play/${id}`);
    await expect(page.locator(".board-wrap > canvas")).toBeVisible();
    await expect(page.locator(".board-wrap > canvas")).toHaveAttribute("aria-label", names[id]);
    if (id === "net") {
      const box = (await page.locator(".board-wrap > canvas").boundingBox())!;
      await page
        .locator(".board-wrap > canvas")
        .click({ position: { x: box.width * 0.25, y: box.height * 0.25 } });
    }
  }
  await page.getByRole("button", { name: "Back to library" }).click();
  await expect(page.locator(".card")).toHaveCount(38);
  const baseline = await sample(cdp, page),
    samples = [{ switches: 0, ...baseline }];
  expect(baseline.seen).toBe(3);
  for (let i = 0; i < 30; i++) {
    await page.goto(`./#/play/${games[i % 3]}`);
    await expect(page.locator(".board-wrap > canvas")).toBeVisible();
    await expect(page.locator(".board-wrap > canvas")).toHaveAttribute("aria-label", names[games[i % 3]]);
    if (i % 3 === 0) {
      const b = (await page.locator(".board-wrap > canvas").boundingBox())!;
      await page
        .locator(".board-wrap > canvas")
        .click({ position: { x: b.width * 0.25, y: b.height * 0.25 } });
    }
    await page.getByRole("button", { name: "Back to library" }).click();
    await expect(page.locator(".card")).toHaveCount(38);
    // Flush Playwright's injected pointer interceptor away from the detached canvas.
    await page.mouse.move(0, 0);
    if ((i + 1) % 10 === 0)
      samples.push({ switches: i + 1, ...(await sample(cdp, page)) });
  }
  await test.info().attach("lifecycle-samples", {
    body: Buffer.from(JSON.stringify(samples, null, 2)),
    contentType: "application/json",
  });
  await writeFile(
    test.info().outputPath("lifecycle.json"),
    JSON.stringify(samples, null, 2),
  );
  if (samples.some((s) => s.retained !== baseline.retained)) {
    const chunks: string[] = [];
    cdp.on("HeapProfiler.addHeapSnapshotChunk", (e) => chunks.push(e.chunk));
    await cdp.send("HeapProfiler.takeHeapSnapshot");
    await writeFile(
      test.info().outputPath("retainers.heapsnapshot"),
      chunks.join(""),
    );
  }
  for (const s of samples) {
    expect(s.retained).toBe(baseline.retained);
    expect(s.listeners).toEqual(baseline.listeners);
  }
  expect(samples.at(-1)?.seen).toBe(33);
});
