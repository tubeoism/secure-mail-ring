/* CL-01 spike harness: throwaway, never imported by product code.
   Logs only event names, counts and timings. Never recipients, subjects or file names. */
const MODE_KEY = "smr.spike.mode";
const LOG_KEY = "smr.spike.log";
const LOG_MAX = 50;

function settings() {
  return Office.context.roamingSettings;
}

function mode() {
  return settings().get(MODE_KEY) || "allow";
}

function logEntry(ev, ok, detail) {
  try {
    const raw = settings().get(LOG_KEY);
    const log = raw ? JSON.parse(raw) : [];
    log.push({ t: new Date().toISOString(), ev, ok, detail: detail || "" });
    settings().set(LOG_KEY, JSON.stringify(log.slice(-LOG_MAX)));
    settings().saveAsync(() => {});
  } catch {
    // Logging must never affect sending.
  }
}

function getField(item, field) {
  return new Promise((resolve) => item[field].getAsync((r) => resolve(r)));
}

function setField(item, field, value) {
  return new Promise((resolve) => item[field].setAsync(value, (r) => resolve(r)));
}

// Spike 2: reverse To order inside OnMessageSend, then allow. Records outcome only.
async function reorderTo(item) {
  const got = await getField(item, "to");
  if (got.status !== Office.AsyncResultStatus.Succeeded) {
    logEntry("spike2.get", false, String(got.error && got.error.code));
    return;
  }
  const before = got.value.length;
  const set = await setField(item, "to", got.value.slice().reverse());
  const ok = set.status === Office.AsyncResultStatus.Succeeded;
  logEntry("spike2.set", ok, `count=${before} err=${ok ? "" : set.error && set.error.code}`);
}

async function onMessageSendHandler(event) {
  const m = mode();
  logEntry("OnMessageSend", true, `mode=${m}`);
  const item = Office.context.mailbox.item;
  if (m === "throw") {
    throw new Error("spike4 deliberate failure");
  }
  if (m === "block") {
    event.completed({
      allowEvent: false,
      errorMessage: "Spike 1: blocked on purpose.",
      errorMessageMarkdown:
        "**Spike 1** blocked on purpose.\n\nSecond line to check Markdown rendering.",
    });
    return;
  }
  if (m === "prompt") {
    event.completed({
      allowEvent: false,
      errorMessage: "Spike 1: prompt-user override.",
      sendModeOverride: Office.MailboxEnums.SendModeOverride.PromptUser,
    });
    return;
  }
  if (m === "reorder") {
    await reorderTo(item);
  }
  if (m === "ack") {
    const acked = await new Promise((resolve) =>
      item.sessionData.getAsync("smrAck", (r) =>
        resolve(r.status === "succeeded" && r.value === "1"),
      ),
    );
    if (!acked) {
      event.completed({
        allowEvent: false,
        errorMessage: "Spike 6: acknowledge in the task pane, then send again.",
        cancelLabel: "Open pane",
        commandId: "SmrPaneButton",
      });
      return;
    }
    logEntry("spike6.sendAfterAck", true);
  }
  event.completed({ allowEvent: true });
}

function onNewMessageComposeHandler(event) {
  logEntry("OnNewMessageCompose", true);
  event.completed();
}

Office.onReady(() => {});
Office.actions.associate("onMessageSendHandler", onMessageSendHandler);
Office.actions.associate("onNewMessageComposeHandler", onNewMessageComposeHandler);
