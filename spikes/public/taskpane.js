/* CL-01 spike harness task pane. Throwaway. */
const MODE_KEY = "smr.spike.mode";
const LOG_KEY = "smr.spike.log";
const MODES = ["allow", "block", "prompt", "reorder", "throw", "ack"];
const SETS = ["1.1", "1.3", "1.4", "1.5", "1.8", "1.9", "1.10", "1.11", "1.12", "1.13", "1.14"];

const out = () => document.getElementById("out");
const show = (text) => {
  out().textContent = text;
};
const rs = () => Office.context.roamingSettings;

function renderMode() {
  document.getElementById("mode").textContent = rs().get(MODE_KEY) || "allow";
}

function saveSettings() {
  return new Promise((resolve) => rs().saveAsync((r) => resolve(r)));
}

async function setMode(m) {
  rs().set(MODE_KEY, m);
  const r = await saveSettings();
  renderMode();
  show(`mode=${m} save=${r.status}`);
}

function refreshLog() {
  const raw = rs().get(LOG_KEY);
  const log = raw ? JSON.parse(raw) : [];
  show(
    log.map((e) => `${e.t} ${e.ev} ${e.ok ? "ok" : "FAIL"} ${e.detail}`).join("\n") || "(empty)",
  );
}

function checkSets() {
  const rows = SETS.map(
    (v) => `Mailbox ${v}: ${Office.context.requirements.isSetSupported("Mailbox", v)}`,
  );
  const host = Office.context.diagnostics;
  show(`host=${host.host} platform=${host.platform} version=${host.version}\n` + rows.join("\n"));
}

// Spike 3: write incompressible chunks until saveAsync fails, report the last good size.
async function measureCapacity() {
  const key = "smr.spike.cap";
  let kb = 0;
  let lastGood = 0;
  const chunk = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(768)), (b) => b.toString(36))
      .join("")
      .slice(0, 1024);
  let payload = "";
  for (let i = 0; i < 200; i++) {
    payload += chunk();
    kb = Math.round(payload.length / 1024);
    rs().set(key, payload);
    const r = await saveSettings();
    if (r.status !== Office.AsyncResultStatus.Succeeded) break;
    lastGood = kb;
    show(`ok up to ${lastGood} KB...`);
  }
  rs().remove(key);
  await saveSettings();
  show(`Spike 3: last successful size ${lastGood} KB (first failure at ${kb} KB)`);
}

function acknowledge() {
  Office.context.mailbox.item.sessionData.setAsync("smrAck", "1", (r) =>
    show(`sessionData set: ${r.status}`),
  );
}

Office.onReady(() => {
  const box = document.getElementById("modes");
  MODES.forEach((m) => {
    const b = document.createElement("button");
    b.textContent = m;
    b.addEventListener("click", () => setMode(m));
    box.appendChild(b);
  });
  document.getElementById("req").addEventListener("click", checkSets);
  document.getElementById("cap").addEventListener("click", measureCapacity);
  document.getElementById("ack").addEventListener("click", acknowledge);
  document.getElementById("refresh").addEventListener("click", refreshLog);
  document.getElementById("clear").addEventListener("click", async () => {
    rs().remove(LOG_KEY);
    await saveSettings();
    refreshLog();
  });
  renderMode();
  refreshLog();
});
