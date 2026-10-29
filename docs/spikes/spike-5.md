# Spike 5: obfuscated bundle in the JS-only runtime

Plan: Stage 0 spike 5. Decision fed: obfuscator options for CL-09.

1. Build a variant: `npx javascript-obfuscator spikes/public/launchevent.js --output spikes/dist/obf/launchevent.js` (default options first).
2. Deploy a copy of `spikes/public` with that file replaced, as a separate Pages deployment, render a manifest for it (new add-in id), install.
3. Press **block** and send. Does the handler still run? Check the log.
4. If it fails, retry with fewer options (`--control-flow-flattening false --string-array false --self-defending false`) and record which option breaks it.

Output: list of options that work in the runtime, and those that do not. `self-defending` and `debug-protection` are the usual suspects.
