import { configDefaults, defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: {
    // Private opt-in diagnostics may contact real services or apply migrations.
    // Ordinary unit-test runs must never execute those operational scripts.
    exclude: [...configDefaults.exclude, ".codex/**", ".next*/**"],
  },
});
