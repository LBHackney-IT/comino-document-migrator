const config = require("./jest.config");

module.exports = Object.assign({}, config, {
  coverageReporters: ["text", "html"],
  coverageDirectory: "/tmp/coverage",
});
