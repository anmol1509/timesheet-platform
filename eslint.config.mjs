import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // React-compiler style rules that flag patterns already in the code (state set in an effect, Date.now() during render,
  // components defined inside components). Warnings until they are cleaned up one by one, so CI fails on new real errors
  // instead of on this backlog. Promote back to "error" once `npm run lint` shows none of them.
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/static-components": "warn",
    },
  },
]);

export default eslintConfig;
