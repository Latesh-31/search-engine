module.exports = {
  env: {
    es2022: true,
    node: true,
    jest: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint", "import", "jest"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "plugin:jest/recommended",
    "prettier",
  ],
  rules: {
    "import/order": [
      "error",
      {
        groups: [["builtin", "external"], ["internal"], ["parent", "sibling", "index"]],
        "newlines-between": "always",
        alphabetize: {
          order: "asc",
          caseInsensitive: true,
        },
      },
    ],
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/explicit-module-boundary-types": "off",
  },
  ignorePatterns: ["dist", "node_modules"],
};
