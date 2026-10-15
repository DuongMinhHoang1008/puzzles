import { readFile, access } from "node:fs/promises";
const root = new URL("../../", import.meta.url);
const catalog = JSON.parse(
  await readFile(new URL("tools/web/games.manifest.json", root)),
);
const assets = JSON.parse(
  await readFile(new URL("web/public/engine/manifest.json", root)),
);
if (assets.partial || catalog.length !== assets.games.length)
  throw Error("Production requires all 38 engines; run build:engine");
for (const game of catalog) {
  const asset = assets.games.find((g) => g.id === game.id);
  if (!asset) throw Error(`Missing ${game.id}`);
  await access(new URL(`web/public/engine/${asset.module}`, root));
  await access(new URL(`web/public/engine/${asset.wasm}`, root));
}
const thumbnails = JSON.parse(
  await readFile(new URL("web/src/content/thumbnails.json", root)),
);
for (const game of catalog) {
  if (!thumbnails.includes(game.id))
    throw Error(`Missing board thumbnail: ${game.id}`);
  await access(new URL(`web/public/assets/boards/${game.id}.png`, root));
}
