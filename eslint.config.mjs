import nextCoreWebVitals from "eslint-config-next/core-web-vitals"
import nextTypeScript from "eslint-config-next/typescript"

export default [
  {
    ignores: [
      ".agents/**",
      ".next/**",
      ".next-app/**",
      "node_modules/**",
      "tsconfig.tsbuildinfo",
      "tsconfig.typecheck.tsbuildinfo",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/incompatible-library": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["scripts/**/*.cjs", "server.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["eslint.config.mjs"],
    rules: {
      "import/no-anonymous-default-export": "off",
    },
  },
  {
    files: ["lib/supabase/admin.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
]
