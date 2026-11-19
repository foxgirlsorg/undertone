import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Ported verbatim from the official ListenBrainz frontend.
    files: ["src/lib/api.ts", "src/lib/lb-types.d.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off", "eslint-comments/no-unused-disable": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
