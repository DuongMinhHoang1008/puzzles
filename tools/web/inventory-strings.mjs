import { readFile, writeFile } from "node:fs/promises";
const root = new URL("../../", import.meta.url);
const games = JSON.parse(
  await readFile(new URL("tools/web/games.manifest.json", root)),
);
const inventory = {};
for (const { id } of games) {
  const source = await readFile(new URL(id + ".c", root), "utf8");
  const labels = [
    ...source.matchAll(
      /\b(?:ret|cfg)\[[^\]]+\]\.name\s*=\s*("(?:\\.|[^"\\])*"|NULL)/g,
    ),
  ]
    .map((m) => m[1])
    .filter((s) => s !== "NULL")
    .map((s) => JSON.parse(s));
  const literals = [...source.matchAll(/"(?:\\.|[^"\\])*"/g)].map((m) => {
    try {
      return JSON.parse(m[0]);
    } catch {
      return m[0];
    }
  });
  inventory[id] = {
    configLabels: [...new Set(labels)],
    sourceLiterals: [...new Set(literals.filter((s) => /[A-Za-z]{3}/.test(s)))],
    runtimeInventoryVerified: false,
  };
}
await writeFile(
  new URL("docs/web-engine-source-inventory.json", root),
  JSON.stringify(
    {
      source:
        "Local C files; includes internal tokens, not a reachability proof",
      games: inventory,
    },
    null,
    2,
  ) + "\n",
);
