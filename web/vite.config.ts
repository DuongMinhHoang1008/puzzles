import { defineConfig } from "vite";
export default defineConfig({
  base: process.env.PAGES_BASE || "/puzzles/",
  build: { target: "es2022" },
});
