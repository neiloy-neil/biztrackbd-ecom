// A deliberately small linter set: the mistakes that cause real bugs (unused code, hook misuse, floating promises are NOT checked here
// because they need type information). Generated folders, tests and the design canvas are skipped.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import nextPlugin from "@next/eslint-plugin-next";

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/.next/**", "**/.turbo/**", "**/dist/**", "**/test-results/**", "design/**", "checkup/**", "**/*.d.ts", "**/next-env.d.ts", "packages/db/prisma/**", "tools/**", "scratchpad/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ["**/public/sw.js"], languageOptions: { globals: { ...globals.serviceworker } } },
  {
    files: ["**/*.{ts,tsx,mjs}"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    plugins: { "react-hooks": reactHooks, "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
);
