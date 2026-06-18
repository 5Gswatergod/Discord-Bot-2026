module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module"
  },
  ignorePatterns: [
    "node_modules",
    ".next",
    "dist",
    "coverage",
    "packages/database/src/generated",
    "next-env.d.ts",
    "pnpm-lock.yaml"
  ],
  rules: {
    "@typescript-eslint/no-explicit-any": "off"
  }
};
