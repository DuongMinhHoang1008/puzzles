import { readFile } from "node:fs/promises";
const status = JSON.parse(
  await readFile(new URL("../../web/release-status.json", import.meta.url)),
);
if (!status.ready || status.blockingGates.length)
  throw Error("Release gates incomplete:\n" + status.blockingGates.join("\n"));
