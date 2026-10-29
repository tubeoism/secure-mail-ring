# Step 0: deploy and sideload (Day 1 gate)

## Deploy the harness to Cloudflare Pages
1. Create a Pages project, for example `smr-spikes` (free tier, direct upload).
2. From the repo root: `npx wrangler pages deploy spikes/public --project-name smr-spikes`. The host is `https://smr-spikes.pages.dev` (or the one Cloudflare prints).
3. Open `<host>/taskpane.html` in a browser. It loads (Office features will not work outside Outlook).

## Render the manifest
`mkdir -p spikes/dist && node spikes/render-manifest.mjs <host> 1.0.0.0 > spikes/dist/manifest.xml`

Use the same `SPIKE_ADDIN_ID` for every render so a reinstall replaces the add-in instead of adding a second one: `SPIKE_ADDIN_ID=<guid> node spikes/render-manifest.mjs ...`. Bump the version for every manifest change.

## Sideload (user self-install, decision D-03)
Outlook, Get Add-ins, My add-ins, Add a custom add-in, Add from file, choose `manifest.xml`.

## Record
- Did the tenant allow it? Exact error text if not (screenshot).
- Does the compose window show the "SMR spikes" group and the "Spike pane" button? Does a read message show "Spike (read)"?
- If the manifest is rejected, copy the exact error. The manifest has not been checked by the Microsoft validator (no network access from the build container). Fixing manifest errors found here is part of CL-01 and is reported back to Claude.

Pass: add-in installed and both buttons visible. Fail on tenant policy: stop (plan gate).
