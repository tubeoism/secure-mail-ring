// Dev and smoke build for the task pane in a plain browser (no Outlook). The product build
// (launchevent bundle, obfuscation, manifest rendering) arrives with CL-06 and CL-09.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import HtmlWebpackPlugin from "html-webpack-plugin";

const at = (p) => fileURLToPath(new URL(p, import.meta.url));

// AG-01 creates src/taskpane/index.tsx; until then the placeholder page is served.
const entry = existsSync(at("./src/taskpane/index.tsx"))
  ? at("./src/taskpane/index.tsx")
  : at("./build/dev/placeholder.tsx");

export default (_env, argv) => ({
  mode: argv.mode ?? "development",
  entry,
  output: { path: at("./dist/taskpane"), filename: "taskpane.js", clean: true },
  devtool: argv.mode === "production" ? false : "eval-source-map",
  resolve: { extensions: [".tsx", ".ts", ".js", ".json"] },
  module: {
    rules: [
      {
        test: /\.tsx$/,
        loader: "esbuild-loader",
        options: { loader: "tsx", jsx: "automatic", target: "es2022" },
      },
      { test: /\.[jt]s$/, loader: "esbuild-loader", options: { loader: "ts", target: "es2022" } },
    ],
  },
  plugins: [new HtmlWebpackPlugin({ template: at("./build/dev/index.html") })],
  devServer: { port: 3000, hot: true, open: false },
  performance: { hints: false },
});
