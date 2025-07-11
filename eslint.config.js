
import globals from "globals";
import tseslint from "typescript-eslint";
import eslint from "@eslint/js";

export default [
  {
    ignores: ["dist", "node_modules"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/no-explicit-any": "warn",
      "prefer-const": "error",
      "no-console": "off",
    },
  },
];
