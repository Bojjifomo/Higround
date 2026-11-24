import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts", "supabase-tests/**/*.test.ts"],
    alias: { "server-only": new URL("./test-stubs/server-only.ts", import.meta.url).pathname },
    environment: "node",
    testTimeout: 30_000,
  },
});
