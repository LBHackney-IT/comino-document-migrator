module.exports = {
  env: {
    es2022: true,
    node: true,
    jest: true,
  },
  extends: ["eslint:recommended", "plugin:prettier/recommended"],
  parserOptions: {
    sourceType: "module",
    ecmaVersion: 2022,
  },
  ignorePatterns: ["/dist"],
};
