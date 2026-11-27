import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

/**
 * next/core-web-vitals = Next rules + react + react-hooks (rules-of-hooks,
 * exhaustive-deps) + jsx-a11y basics. next/typescript adds @typescript-eslint.
 * vendor/ is copied code (design kit + shared contracts) — linted at its source.
 */
const config = [
  { ignores: [".next/**", "node_modules/**", "src/vendor/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // `_`-prefixed names are intentionally unused (destructured-away args).
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      // frontend-architecture §7: no aggregate barrels, alias instead of deep relative paths.
      "no-restricted-syntax": [
        "error",
        { selector: "ExportAllDeclaration", message: "No `export *` barrels — re-export names explicitly." },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../../../*"],
              message: "Use the @/ alias for imports outside the current folder tree (frontend-architecture §7).",
            },
          ],
        },
      ],
    },
  },
  {
    // Tests import JSON messages from client/messages/ (outside src/, no alias).
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: { "no-restricted-imports": "off" },
  },
];

export default config;
