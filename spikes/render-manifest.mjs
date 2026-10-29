// Usage: node spikes/render-manifest.mjs https://<project>.pages.dev [version] > spikes/dist/manifest.xml
// Bump the version argument for every manifest change (Spike 7 reinstall step).
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const [host, version = "1.0.0.0"] = process.argv.slice(2);
if (!host || !/^https:\/\/[^/]+$/.test(host)) {
  console.error("Usage: render-manifest.mjs https://host [version]");
  process.exit(1);
}
const id = process.env.SPIKE_ADDIN_ID ?? randomUUID();
const tpl = readFileSync(new URL("./manifest.template.xml", import.meta.url), "utf8");
process.stdout.write(
  tpl
    .replaceAll("{{HOST}}", host)
    .replaceAll("{{VERSION}}", version)
    .replaceAll("{{ADDIN_ID}}", id),
);
