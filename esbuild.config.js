const esbuild = require("esbuild");
const { nodeExternalsPlugin } = require("esbuild-node-externals");

esbuild.build({
  entryPoints: ["src/index.js"],
  bundle: true,
  minify: true,
  platform: "node",
  outfile: "dist/index.js",
  sourcemap: true,
  plugins: [nodeExternalsPlugin()],
});
