import { defineConfig } from "vitest/config";
import react from '@vitejs/plugin-react'
import mdx from "@mdx-js/rollup";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";

export default defineConfig({
  plugins: [
    { enforce: "pre", ...mdx({ remarkPlugins: [remarkGfm], rehypePlugins: [rehypeSlug] }) },
    react({ include: /\.(js|jsx|ts|tsx|mdx)$/ }),
  ],
  base: "/",
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    environmentOptions: {
      jsdom: { url: "http://localhost/" },
    },
    setupFiles: "./src/test-setup.ts",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/main.tsx",
        "src/vite-env.d.ts",
        "src/**/*.test.{ts,tsx}",
      ],
    },
  },
});
