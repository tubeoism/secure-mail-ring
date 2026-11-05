import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { acknowledgementKey, computeFingerprint } from "../src/fingerprint";
import type { Finding } from "../src/model";
import { sortRecipients } from "../src/order";
import { entry, file, mail, ring } from "./helpers";

const r = ring();
const base = mail({
  to: [entry("a@abccorp.vn"), entry("b@abccorp.vn")],
  cc: [entry("kt@partner.vn")],
  attachments: [file("ALPHA_1.xlsx"), file("ALPHA_2.xlsx")],
});

describe("computeFingerprint (D7)", () => {
  it("is a stable 64-character hex string that shows no address", () => {
    const fp = computeFingerprint(r, base);
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
    expect(computeFingerprint(r, base)).toBe(fp);
    expect(fp).not.toContain("abccorp");
  });

  it("ignores the order inside a field and the order of files", () => {
    const shuffled = mail({
      to: [entry("b@abccorp.vn"), entry("a@abccorp.vn")],
      cc: [entry("kt@partner.vn")],
      attachments: [file("ALPHA_2.xlsx"), file("ALPHA_1.xlsx")],
    });
    expect(computeFingerprint(r, shuffled)).toBe(computeFingerprint(r, base));
  });

  it("ignores the subject, the display names and address notation", () => {
    const other = mail({
      subject: "[ALPHA] changed",
      to: [entry("A@AbcCorp.vn", "Anna"), entry("b@abccorp.vn.", "Bob")],
      cc: [entry("kt@partner.vn")],
      attachments: base.attachments,
    });
    expect(computeFingerprint(r, other)).toBe(computeFingerprint(r, base));
  });

  it("changes when a recipient, its field, a file name or the ring changes", () => {
    const fp = computeFingerprint(r, base);
    const variants = [
      mail({ ...base, to: [entry("a@abccorp.vn"), entry("c@abccorp.vn")] }),
      mail({ ...base, to: [entry("a@abccorp.vn")], bcc: [entry("b@abccorp.vn")] }),
      mail({ ...base, to: [...base.to, entry("x@gmail.com")] }),
      mail({ ...base, attachments: [file("ALPHA_1.xlsx"), file("ALPHA_3.xlsx")] }),
      mail({ ...base, attachments: [file("ALPHA_1.xlsx")] }),
    ];
    for (const v of variants) expect(computeFingerprint(r, v)).not.toBe(fp);
    expect(computeFingerprint(ring({ id: "r2" }), base)).not.toBe(fp);
    expect(computeFingerprint(null, base)).not.toBe(fp);
  });

  it("keeps its published value: a stored acknowledgement must survive an update (golden)", () => {
    const golden = mail({
      to: [entry("a@abccorp.vn"), entry("", "Nguyễn Văn A", false)],
      cc: [entry("kt@partner.vn")],
      attachments: [file("ALPHA_1.xlsx")],
    });
    expect(computeFingerprint(r, golden)).toBe(
      "905795aad93c9e63de6a78216b13baac1e55abf9d9b06ff8c1b6423ebb7db62e",
    );
  });

  it("tells two unresolved recipients apart by display name", () => {
    const one = mail({ to: [entry("", "Nguyễn Văn A", false)] });
    const two = mail({ to: [entry("", "Nguyễn Văn B", false)] });
    expect(computeFingerprint(r, one)).not.toBe(computeFingerprint(r, two));
    expect(computeFingerprint(r, one)).toBe(
      computeFingerprint(r, mail({ to: [entry("", "NGUYỄN VĂN A", false)] })),
    );
  });

  it("falls back to the raw address when an unresolved entry has no display name", () => {
    const a = computeFingerprint(r, mail({ to: [entry("???", "", false)] }));
    const b = computeFingerprint(r, mail({ to: [entry("!!!", "", false)] }));
    expect(a).not.toBe(b);
  });

  it("tells an unresolved name from a resolved address that starts with a question mark (M-2)", () => {
    const unresolved = mail({ to: [entry("", "a@x.vn", false)] });
    const resolvedQ = mail({ to: [entry("?a@x.vn")] });
    expect(computeFingerprint(r, unresolved)).not.toBe(computeFingerprint(r, resolvedQ));
  });

  it("is unaffected by applying the reordering the engine asks for (property)", () => {
    const sorted = ring({
      order: { to: ["b@abccorp.vn", "a@abccorp.vn", "*"], cc: [], bcc: [] },
    });
    const addr = fc.constantFrom("a@abccorp.vn", "b@abccorp.vn", "c@x.vn", "d@y.vn");
    fc.assert(
      fc.property(fc.array(addr, { maxLength: 6 }), (to) => {
        const m = mail({ to: to.map((a) => entry(a)) });
        const mutated = { ...m };
        for (const mutation of sortRecipients(sorted, m)) {
          Object.assign(mutated, { [mutation.field]: mutation.entries });
        }
        expect(computeFingerprint(sorted, mutated)).toBe(computeFingerprint(sorted, m));
      }),
    );
  });

  it("is injective on small distinct mails (property)", () => {
    const addr = fc.constantFrom("a@x.vn", "b@x.vn", "c@y.vn");
    const field = fc.array(addr, { maxLength: 3 });
    fc.assert(
      fc.property(field, field, field, field, (a, b, c, d) => {
        const m1 = mail({ to: a.map((x) => entry(x)), cc: b.map((x) => entry(x)) });
        const m2 = mail({ to: c.map((x) => entry(x)), cc: d.map((x) => entry(x)) });
        const same = (x: string[], y: string[]) => [...x].sort().join() === [...y].sort().join();
        expect(computeFingerprint(r, m1) === computeFingerprint(r, m2)).toBe(
          same(a, c) && same(b, d),
        );
      }),
    );
  });
});

describe("acknowledgementKey (D7)", () => {
  const finding: Pick<Finding, "kind" | "field" | "subject" | "messageKey"> = {
    kind: "outsider",
    messageKey: "finding.outsider",
    field: "bcc",
    subject: "x@gmail.com",
  };
  const fp = computeFingerprint(r, base);

  it("has a versioned prefix and 32 hex characters", () => {
    expect(acknowledgementKey(fp, finding)).toMatch(/^ak2:[0-9a-f]{32}$/);
  });

  it("keeps its published value (golden)", () => {
    const goldenFp = "905795aad93c9e63de6a78216b13baac1e55abf9d9b06ff8c1b6423ebb7db62e";
    expect(acknowledgementKey(goldenFp, finding)).toBe("ak2:72b9267efe4740d3ceaa08be7aa45087");
  });

  it("depends on the fingerprint, kind, field, subject and message key", () => {
    const key = acknowledgementKey(fp, finding);
    expect(acknowledgementKey(fp, finding)).toBe(key);
    expect(acknowledgementKey("other", finding)).not.toBe(key);
    expect(acknowledgementKey(fp, { ...finding, kind: "firstTime" })).not.toBe(key);
    expect(acknowledgementKey(fp, { ...finding, field: "cc" })).not.toBe(key);
    expect(acknowledgementKey(fp, { ...finding, subject: "y@gmail.com" })).not.toBe(key);
    expect(
      acknowledgementKey(fp, {
        kind: finding.kind,
        subject: finding.subject,
        messageKey: finding.messageKey,
      }),
    ).not.toBe(key);
    // M-1: two rules of different type on the same address and field must not share a key.
    expect(
      acknowledgementKey(fp, { ...finding, messageKey: "finding.fieldRule.mustNotBeIn" }),
    ).not.toBe(key);
  });
});
