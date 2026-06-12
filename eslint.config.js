import js from "@eslint/js";
import i18next from "eslint-plugin-i18next";
import tseslint from "typescript-eslint";

const ignoredFiles = [
  "**/dist/**",
  "**/node_modules/**",
  "packages/kernel/src/__violation__.ts",
];

const f5AndF10RestrictedSyntax = [
  {
    selector: "TSAnyKeyword",
    message: "F5 forbids any.",
  },
  {
    selector: "TSNonNullExpression",
    message: "F5 forbids non-null assertions.",
  },
  {
    selector:
      "TSAsExpression[expression.type='TSAsExpression'][expression.typeAnnotation.type='TSUnknownKeyword']",
    message: "F5 forbids as unknown as casts.",
  },
  {
    selector:
      "CatchClause > BlockStatement[body.length=1] ExpressionStatement > CallExpression[callee.object.name='console']",
    message: "F10 forbids console-only catch blocks.",
  },
];

const kernelDeterminismRestrictedSyntax = [
  {
    selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message: "F3 forbids Date.now() inside packages/kernel.",
  },
  {
    selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
    message: "F3 forbids Math.random() inside packages/kernel.",
  },
  {
    selector:
      "CallExpression[callee.object.name='performance'][callee.property.name='now']",
    message: "F3 forbids performance.now() inside packages/kernel.",
  },
  {
    selector: "CallExpression[callee.name='setTimeout']",
    message: "F3 forbids setTimeout inside packages/kernel.",
  },
];

export default tseslint.config(
  {
    ignores: ignoredFiles,
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["packages/*/src/*-regression.ts"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/only-throw-error": "error",
      "@typescript-eslint/prefer-promise-reject-errors": "error",
      "@typescript-eslint/use-unknown-in-catch-callback-variable": "error",
      "no-empty": ["error", { "allowEmptyCatch": false }],
      "no-restricted-syntax": ["error", ...f5AndF10RestrictedSyntax],
    },
  },
  {
    files: ["packages/kernel/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...f5AndF10RestrictedSyntax,
        ...kernelDeterminismRestrictedSyntax,
      ],
    },
  },
  {
    files: ["packages/**/*.{ts,tsx}", "apps/**/*.{ts,tsx}"],
    ignores: ["**/locales/**", "apps/web/**/i18n/**"],
    plugins: {
      i18next,
    },
    rules: {
      "i18next/no-literal-string": "error",
    },
  },
  {
    files: ["**/*.js", "**/*.cjs", "**/*.config.ts", "tests/**/*.ts"],
    ...tseslint.configs.disableTypeChecked,
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      "i18next/no-literal-string": "off",
    },
  },
  {
    files: ["**/*.cjs"],
    languageOptions: {
      globals: {
        module: "readonly",
      },
    },
  },
);
