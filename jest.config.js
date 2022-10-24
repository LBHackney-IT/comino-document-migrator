module.exports = {
  roots: ["<rootDir>/test"],
  testMatch: ["**/test/**/*.ts", "!**/test/helpers.ts"],
  transform: {
    "^.+\\.ts?$": "ts-jest",
  },
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
    },
  },
  coveragePathIgnorePatterns: ["test"],
};
