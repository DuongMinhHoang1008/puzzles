import {
  readFile,
  writeFile,
  mkdir,
  copyFile,
  readdir,
  stat,
  unlink,
} from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const stage = join(root, "build/web/source");
const output = join(root, "web/public/engine");
const run = (exe, args, cwd = stage) => {
  const r = spawnSync(exe, args, { cwd, stdio: "inherit" });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${exe} failed (${r.status})`);
};
await mkdir(stage, { recursive: true });
await mkdir(output, { recursive: true });
for (const file of await readdir(root)) {
  if ((await stat(join(root, file))).isFile())
    await copyFile(join(root, file), join(stage, file));
}
await mkdir(join(stage, "icons"), { recursive: true });
for (const file of await readdir(join(root, "icons")))
  if ((await stat(join(root, "icons", file))).isFile())
    await copyFile(join(root, "icons", file), join(stage, "icons", file));
const perl =
  process.env.PERL ||
  (process.platform === "win32"
    ? "C:/Program Files/Git/usr/bin/perl.exe"
    : "perl");
run(perl, ["mkfiles.pl"]);
const make = (await readFile(join(stage, "Makefile.emcc"), "utf8")).replace(
  /\\\r?\n/g,
  " ",
);
const metadata = JSON.parse(
  await readFile(join(root, "tools/web/games.manifest.json"), "utf8"),
);
const inventory = [...make.matchAll(/^\$\(OUTPREFIX\)([a-z]+)\.js:/gm)]
  .map((m) => m[1])
  .filter((id) => id !== "nullgame")
  .sort();
if (
  inventory.join() !==
  metadata
    .map((g) => g.id)
    .sort()
    .join()
)
  throw new Error("Recipe / release inventory mismatch");
const requested = process.argv.includes("--game")
  ? process.argv[process.argv.indexOf("--game") + 1]
  : null;
if (requested && !inventory.includes(requested))
  throw new Error(`Unknown game: ${requested}`);
const games = requested ? [requested] : inventory;
const sdk = join(root, "build/web/emsdk");
if (process.platform === "win32" && !process.env.EMSDK_PYTHON)
  process.env.EMSDK_PYTHON = join(sdk, "python/3.13.3_64bit/python.exe");
const emcc =
  process.env.EMCC ||
  (process.platform === "win32"
    ? join(sdk, "upstream/emscripten/emcc.bat")
    : "emcc");
const compile = (args) => {
  // Avoid cmd string interpolation when calling the SDK's Windows launcher.
  if (process.platform === "win32" && /emcc\.bat$/i.test(emcc))
    run(process.env.EMSDK_PYTHON, [join(dirname(emcc), "emcc.py"), ...args]);
  else run(emcc, args);
};
const exports = JSON.parse(await readFile(join(root, "emccx.json"), "utf8"));
const flags = [
  "-O2",
  "-sMODULARIZE=1",
  "-sEXPORT_ES6=1",
  "-sENVIRONMENT=web",
  "-sALLOW_MEMORY_GROWTH=1",
  `-sASSERTIONS=${process.argv.includes("--debug") ? 1 : 0}`,
  "-sNO_EXIT_RUNTIME=1",
  "-sFILESYSTEM=0",
  `-sEXPORTED_FUNCTIONS=${JSON.stringify(exports)}`,
  '-sEXPORTED_RUNTIME_METHODS=["ccall","UTF8ToString","HEAPU8"]',
  "--js-library",
  "emcclib.js",
];
const hash = createHash("sha256");
hash.update(flags.join());
hash.update("emscripten-4.0.20");
for (const file of (await readdir(stage)).sort())
  if (/\.(c|h|R|js|json)$/.test(file) || file === "Recipe")
    hash.update(await readFile(join(stage, file)));
const buildId = hash.digest("hex").slice(0, 16);
const compiled = new Set();
const assetGames = [];
for (const id of games) {
  const target = new RegExp(`^\\$\\(OUTPREFIX\\)${id}\\.js: (.+)$`, "m").exec(
    make,
  );
  const objects = target[1].split(/\s+/).filter((s) => s.endsWith(".o"));
  for (const object of objects) {
    if (compiled.has(object)) continue;
    const rule = new RegExp(
      `^${object.replaceAll(".", "\\.")}:(.+)\\n\\t([^\\n]+)`,
      "m",
    ).exec(make);
    if (!rule) throw new Error(`No Recipe rule for ${object}`);
    const source = rule[1].trim().split(/\s+/)[0];
    const defs = rule[2].match(/-D[^\s]+/g) || [];
    compile([
      "-O2",
      "-DSLOW_SYSTEM",
      "-I.",
      "-Iicons",
      ...defs,
      "-c",
      source,
      "-o",
      object,
    ]);
    compiled.add(object);
  }
  const name = `${id}.${buildId}`;
  compile([...flags, ...objects, "-o", join(output, `${name}.js`)]);
  const binary = await stat(join(output, `${name}.wasm`));
  assetGames.push({
    id,
    module: `${name}.js`,
    wasm: `${name}.wasm`,
    bytes: binary.size,
  });
  console.log(`Built ${id}: ${binary.size} bytes`);
}
await writeFile(
  join(output, "manifest.json"),
  JSON.stringify(
    { buildId, compiler: "4.0.20", partial: !!requested, games: assetGames },
    null,
    2,
  ),
);
if (!requested) {
  const current = new Set(
    assetGames.flatMap((game) => [game.module, game.wasm]),
  );
  for (const file of await readdir(output)) {
    if (/^[a-z]+\.[a-f0-9]{16}\.(?:js|wasm)$/.test(file) && !current.has(file))
      await unlink(join(output, file));
  }
}
