import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts", "src/helpers/index.ts"],
    format: ["cjs", "esm"],
    dts: true,
    shims: true,
    clean: true,
  },

  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
    typecheck: {
      tsconfig: "./tsconfig.test.json",
    },
  },

  lint: {
    ignorePatterns: [
      "dist/",
      "scripts/",
      "**/*.test.ts",
      ".private/",
      ".sample/",
      "examples/",
      "pages/",
    ],
  },

  fmt: {
    tabWidth: 2,
    ignorePatterns: [
      ".github/**",
      "pages/**",
      "proto/**",
      "dist/**",
      "scripts/**",
      ".private/**",
      ".sample/**",
    ],
  },
});
