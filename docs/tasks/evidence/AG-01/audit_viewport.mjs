/* eslint-disable no-console, no-undef */
// Viewport audit script for AG-01B AC-2 & AC-3 verification
// Audits taskpane screens at 320px width to ensure zero horizontal scroll
// and captures evidence screenshots in docs/tasks/evidence/AG-01/

import puppeteer from "puppeteer";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SCREENS = ["rings", "editor", "share", "compose", "ack", "import", "settings"];
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

async function runAudit() {
  console.log(`Starting 320px viewport audit against ${BASE_URL}...`);
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 320, height: 600, deviceScaleFactor: 1 });

    for (const screen of SCREENS) {
      const url = `${BASE_URL}/?screen=${screen}&lang=vi`;
      console.log(`Auditing screen: ${screen} (${url})`);
      await page.goto(url, { waitUntil: "networkidle0", timeout: 10000 });

      // Verify no horizontal overflow
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        const body = document.body;
        const scrollWidth = Math.max(doc.scrollWidth, body.scrollWidth);
        const clientWidth = Math.max(doc.clientWidth, body.clientWidth);
        return {
          scrollWidth,
          clientWidth,
          hasHorizontalScroll: scrollWidth > clientWidth,
        };
      });

      if (overflow.hasHorizontalScroll) {
        console.error(
          `FAIL: Screen '${screen}' overflows horizontally: scrollWidth=${overflow.scrollWidth}, clientWidth=${overflow.clientWidth}`,
        );
      } else {
        console.log(`PASS: Screen '${screen}' fits within ${overflow.clientWidth}px.`);
      }

      const outPath = path.join(__dirname, `${screen}.png`);
      await page.screenshot({ path: outPath });
      console.log(`Saved screenshot: ${outPath}`);
    }
  } finally {
    await browser.close();
  }
}

// When run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runAudit().catch((err) => {
    console.error("Audit error:", err);
    process.exit(1);
  });
}
