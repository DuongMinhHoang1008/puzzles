import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRoute, shareHash } from "../src/app/route";
import { mapPoint } from "../src/engine/input";
import { en, vi, normalize } from "../src/locales";
import catalog from "../../tools/web/games.manifest.json";
import { engineText } from "../src/locales/engine";
import inventory from "../../docs/web-engine-string-inventory.json";
import { readFileSync } from "node:fs";
import { zoomAnchor } from "../src/engine/viewport";
test("share IDs preserve delimiters, Unicode and encoded percent exactly once", () => {
  const id = "5x5:abc%20:# ?á";
  const result = parseRoute(shareHash("net", id, "vi"), ["net"]);
  assert.equal(result.fullId, id);
  assert.equal(result.locale, "vi");
  assert.ok(parseRoute("#/play/net?game=%00", ["net"]).error);
  assert.ok(parseRoute("#/play/net?lang=xx", ["net"]).error);
  assert.ok(parseRoute("#/play/unknown", ["net"]).error);
});
test("pointer coordinates stay logical under DPR, resizing and zoom", () => {
  assert.deepEqual(
    mapPoint(
      150,
      120,
      { left: 50, top: 20, width: 400, height: 200 },
      200,
      100,
    ),
    { x: 50, y: 50 },
  );
  assert.deepEqual(
    mapPoint(
      250,
      220,
      { left: 50, top: 20, width: 800, height: 400 },
      200,
      100,
    ),
    { x: 50, y: 50 },
  );
});
test("locale parity and Vietnamese search", () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(vi).sort());
  assert.equal(normalize("Đường nối"), "duong noi");
});
test("release contains exactly the stable 38 games, preserving rect target", () => {
  assert.equal(catalog.length, 38);
  assert.equal(new Set(catalog.map((g) => g.id)).size, 38);
  assert.ok(catalog.some((g) => g.id === "rect"));
  assert.ok(!catalog.some((g) => g.id === "nullgame"));
});
test("all statically inventoried strings have Vietnamese mappings", () => {
  const skipWords = ["Cairo", "Penrose", "(n-1)^2", "(n-2)^2"];
  for (const strings of Object.values(inventory))
    for (const s of strings) {
      if (/^\d+$/.test(s)) continue; // single numbers pass through unchanged
      if (/^\d+(?:x\d+)+$/.test(s)) continue; // grid sizes pass through unchanged
      if (/^\d+%$/.test(s)) continue; // percentages pass through unchanged
      if (skipWords.some((w) => s === w)) continue; // proper nouns pass through unchanged
      assert.notEqual(engineText(s, "vi"), s, s);
    }
});
test("engine text preserves puzzle tokens and parses only documented status templates", () => {
  assert.equal(engineText("5x5#0", "vi"), "5x5#0");
  assert.equal(engineText("5x5:abcd", "vi"), "5x5:abcd");
  assert.equal(engineText("Active: 3/25", "vi"), "Đã nối: 3/25");
  assert.equal(engineText("5x5 wrapping", "vi"), "5x5 cuộn vòng");
});
test("all 38 games have parallel substantive rules and real board thumbnails", () => {
  const thumbnails = JSON.parse(
    readFileSync(
      new URL("../src/content/thumbnails.json", import.meta.url),
      "utf8",
    ),
  );
  for (const game of catalog) {
    const rules = JSON.parse(
      readFileSync(
        new URL(`../src/content/games/${game.id}.json`, import.meta.url),
        "utf8",
      ),
    );
    assert.equal(rules.en.rules.length, rules.vi.rules.length);
    assert.ok(rules.en.rules.length >= 3);
    assert.ok(thumbnails.includes(game.id));
    assert.ok(
      readFileSync(
        new URL(`../public/assets/boards/${game.id}.png`, import.meta.url),
      ).length > 100,
    );
  }
});
test("zoom anchor keeps the point between two fingers in place", () => {
  assert.equal(zoomAnchor(100, 50, 2), 250);
  assert.equal(zoomAnchor(250, 50, 0.5), 100);
});
test("all static validation errors in stable game sources are translated", () => {
  for (const game of catalog) {
    const source = readFileSync(
      new URL(`../../${game.id}.c`, import.meta.url),
      "utf8",
    );
    for (const match of source.matchAll(
      /return\s+((?:"(?:\\.|[^"\\])*"\s*)+);/g,
    )) {
      const message = [...match[1].matchAll(/"(?:\\.|[^"\\])*"/g)]
        .map((m) => JSON.parse(m[0]))
        .join("");
      if (message.split(/\s+/).length >= 3)
        assert.notEqual(
          engineText(message, "vi"),
          message,
          `${game.id}: ${message}`,
        );
    }
  }
});
test("native status templates translate completion, failures, notes and clocks without changing counters", () => {
  for (const value of [
    "COMPLETED! Active: 25/25",
    "[1:07] Marked: 3 / 10",
    "Score: 12  Selected: 4 (9)",
    "DEAD!  Deaths: 2",
    "Moves: 2 (target 10)",
    "Moves since auto-solve: 7",
    "3 wrong and 2 missed balls.",
  ]) {
    assert.notEqual(engineText(value, "vi"), value, value);
    assert.deepEqual(
      engineText(value, "vi").match(/\d+/g),
      value.match(/\d+/g),
    );
  }
});
