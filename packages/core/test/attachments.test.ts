import { describe, expect, it } from "vitest";
import { checkAttachments, foldForMatch, tokenMatches } from "../src/attachments";
import type { AttachmentInfo } from "../src/model";

const file = (name: string, over: Partial<AttachmentInfo> = {}): AttachmentInfo => ({
  name,
  isInline: false,
  kind: "file",
  ...over,
});
const NOW = new Date("2026-10-29T00:00:00Z");
const ring = (
  id: string,
  tokens: string[],
  over: { ignoreInline?: boolean; exemptExtensions?: string[]; expiresAt?: string | null } = {},
) => ({
  id,
  expiresAt: over.expiresAt ?? null,
  attachments: {
    tokens,
    mode: "any" as const,
    ignoreInline: over.ignoreInline ?? true,
    exemptExtensions: over.exemptExtensions ?? [".ics", ".vcf"],
  },
});
const statuses = (checks: ReturnType<typeof checkAttachments>) => checks.map((c) => c.status);

describe("tokenMatches (FR-4.4, FR-4.5)", () => {
  it("is boundary-aware: ABC matches x_ABC.pdf and [ABC] x.pdf but not ABCD_x.pdf", () => {
    expect(tokenMatches("ABC", "x_ABC.pdf")).toBe(true);
    expect(tokenMatches("ABC", "[ABC] x.pdf")).toBe(true);
    expect(tokenMatches("ABC", "ABC.pdf")).toBe(true);
    expect(tokenMatches("ABC", "ABC")).toBe(true);
    expect(tokenMatches("ABC", "ABCD_x.pdf")).toBe(false);
    expect(tokenMatches("ABC", "xABC.pdf")).toBe(false);
    expect(tokenMatches("ABC", "x1ABC.pdf")).toBe(false);
    expect(tokenMatches("ABC", "ABC2.pdf")).toBe(false);
  });

  it.each(["_", "-", ".", "[", "]", "(", ")", " "])("treats %j as a boundary", (sep) => {
    expect(tokenMatches("ABC", `r${sep}ABC${sep}x.pdf`)).toBe(true);
  });

  it("finds a later occurrence when an earlier one is glued to letters", () => {
    expect(tokenMatches("ABC", "ABCD_ABC.pdf")).toBe(true);
    expect(tokenMatches("ABC", "xABC ABC")).toBe(true);
    expect(tokenMatches("ABC", "ABCD xABC")).toBe(false);
  });

  it("is case-insensitive and NFC/diacritic-insensitive (decision D2)", () => {
    expect(tokenMatches("alpha", "Báo cáo ALPHA.xlsx")).toBe(true);
    expect(tokenMatches("BÁO CÁO", "bao cao.xlsx")).toBe(true);
    expect(tokenMatches("Alpha", "ALPHA.xlsx")).toBe(true);
    expect(tokenMatches("đầu tư", "DAU TU.pdf")).toBe(true);
    expect(tokenMatches("DAU", "Đau tu.pdf")).toBe(true);
    expect(tokenMatches("é", "é.pdf")).toBe(true);
  });

  it("treats a letter from any script as part of a word", () => {
    expect(tokenMatches("ABC", "éABC.pdf")).toBe(false);
    expect(tokenMatches("ABC", "中ABC.pdf")).toBe(false);
    expect(tokenMatches("ABC", "ABC中.pdf")).toBe(false);
    expect(tokenMatches("ABC", "—ABC—.pdf")).toBe(true);
  });

  it("needs no further boundary on a token edge that is punctuation itself", () => {
    expect(tokenMatches("ABC-IA", "ABC-IA_v2.xlsx")).toBe(true);
    expect(tokenMatches("ABC-IA", "ABC-IAx.xlsx")).toBe(false);
    expect(tokenMatches("-IA", "ABC-IA.xlsx")).toBe(true);
    expect(tokenMatches("[ABC]", "x[ABC]y.pdf")).toBe(true);
    expect(tokenMatches("ABC-", "ABC-x.pdf")).toBe(true);
  });

  it("never matches an empty or blank token", () => {
    expect(tokenMatches("", "a.pdf")).toBe(false);
    expect(tokenMatches("   ", "a b.pdf")).toBe(false);
  });

  it("trims the token and does not match across code-point boundaries", () => {
    expect(tokenMatches(" ABC ", "x ABC.pdf")).toBe(true);
    expect(tokenMatches("😀", "a😀b")).toBe(true);
    expect(tokenMatches("ABC", "AB")).toBe(false);
  });
});

describe("foldForMatch", () => {
  it("lower-cases, composes, strips diacritics and maps d-stroke", () => {
    expect(foldForMatch("Độc Lập")).toBe("doc lap");
    expect(foldForMatch("é")).toBe("e");
  });
});

describe("checkAttachments", () => {
  const alpha = ring("alpha", ["ALPHA", "ABC-IA"]);
  const beta = ring("beta", ["BETA", "SHARED"]);

  it("accepts a name that carries a token of the ring", () => {
    expect(
      statuses(checkAttachments(alpha, [beta], [file("x_ALPHA.pdf"), file("ABC-IA q.xlsx")], NOW)),
    ).toEqual(["ok", "ok"]);
  });

  it("flags a name without any token as missingToken", () => {
    const [c] = checkAttachments(alpha, [beta], [file("ALPHAS.pdf")], NOW);
    expect(c?.status).toBe("missingToken");
    expect(c?.foreignRingIds).toEqual([]);
  });

  it("flags another ring's token as foreignRingToken and names the ring (FR-4.3)", () => {
    const [c] = checkAttachments(
      alpha,
      [beta, ring("gamma", ["GAMMA"])],
      [file("Report BETA.pdf")],
      NOW,
    );
    expect(c?.status).toBe("foreignRingToken");
    expect(c?.foreignRingIds).toEqual(["beta"]);
  });

  it("lists every foreign ring whose token the name carries", () => {
    const gamma = ring("gamma", ["GAMMA"]);
    const [c] = checkAttachments(alpha, [beta, gamma], [file("BETA GAMMA.pdf")], NOW);
    expect(c?.foreignRingIds).toEqual(["beta", "gamma"]);
  });

  it("is ok when the name carries both the own and a foreign token", () => {
    expect(statuses(checkAttachments(alpha, [beta], [file("ALPHA BETA.pdf")], NOW))).toEqual([
      "ok",
    ]);
  });

  it("does not call a token shared by two rings foreign", () => {
    const shared = ring("alpha", ["ALPHA", "shared"]);
    const [c] = checkAttachments(shared, [beta], [file("SHARED.pdf")], NOW);
    expect(c?.status).toBe("ok");
    const [d] = checkAttachments(ring("a2", ["ALPHA"]), [beta], [file("SHARED.pdf")], NOW);
    expect(d?.status).toBe("foreignRingToken");
  });

  it("compares shared tokens after folding", () => {
    const own = ring("alpha", ["BÁO"]);
    const other = ring("beta", ["bao"]);
    expect(statuses(checkAttachments(own, [other], [file("BAO.pdf")], NOW))).toEqual(["ok"]);
  });

  it("compares shared tokens after trimming them", () => {
    expect(
      statuses(checkAttachments(ring("a", [" SHARED "]), [beta], [file("SHARED.pdf")], NOW)),
    ).toEqual(["ok"]);
    expect(
      statuses(
        checkAttachments(
          ring("a", ["SHARED"]),
          [ring("b", [" shared "])],
          [file("SHARED.pdf")],
          NOW,
        ),
      ),
    ).toEqual(["ok"]);
  });

  it("does not use another revision of the same ring as a foreign source", () => {
    const stale = ring("alpha", ["OLDTOKEN"]);
    expect(statuses(checkAttachments(alpha, [stale], [file("OLDTOKEN.pdf")], NOW))).toEqual([
      "missingToken",
    ]);
  });

  it("ignores the ring itself if it appears among the others", () => {
    expect(statuses(checkAttachments(alpha, [alpha], [file("zzz.pdf")], NOW))).toEqual([
      "missingToken",
    ]);
  });

  it("ignores expired rings for the foreign check (decision D3)", () => {
    const old = ring("old", ["OLD"], { expiresAt: "2026-01-01T00:00:00Z" });
    const live = ring("live", ["LIVE"], { expiresAt: "2027-01-01T00:00:00Z" });
    const odd = ring("odd", ["ODD"], { expiresAt: "not a date" });
    const files = [file("OLD.pdf"), file("LIVE.pdf"), file("ODD.pdf")];
    expect(statuses(checkAttachments(alpha, [old, live, odd], files, NOW))).toEqual([
      "missingToken",
      "foreignRingToken",
      "foreignRingToken",
    ]);
  });

  it("treats a ring that expires exactly now as still valid", () => {
    const edge = ring("edge", ["EDGE"], { expiresAt: NOW.toISOString() });
    expect(statuses(checkAttachments(alpha, [edge], [file("EDGE.pdf")], NOW))).toEqual([
      "foreignRingToken",
    ]);
  });

  it("skips inline files when ignoreInline is set, checks them otherwise", () => {
    const inline = file("image001.png", { isInline: true });
    expect(statuses(checkAttachments(alpha, [], [inline], NOW))).toEqual(["ok"]);
    const strict = ring("alpha", ["ALPHA"], { ignoreInline: false });
    expect(statuses(checkAttachments(strict, [], [inline], NOW))).toEqual(["missingToken"]);
    expect(statuses(checkAttachments(alpha, [], [file("image001.png")], NOW))).toEqual([
      "missingToken",
    ]);
  });

  it("exempts configured extensions, with or without the dot, case-insensitively", () => {
    const files = [file("invite.ICS"), file("card.vcf"), file("notes.txt")];
    expect(statuses(checkAttachments(alpha, [], files, NOW))).toEqual(["ok", "ok", "missingToken"]);
    const spaced = ring("alpha", ["ALPHA"], { exemptExtensions: [" .ICS "] });
    expect(statuses(checkAttachments(spaced, [], [file("a.ics")], NOW))).toEqual(["ok"]);
    const empty = ring("alpha", ["ALPHA"], { exemptExtensions: [""] });
    expect(statuses(checkAttachments(empty, [], [file("report."), file("report")], NOW))).toEqual([
      "missingToken",
      "missingToken",
    ]);
    const bare = ring("alpha", ["ALPHA"], { exemptExtensions: ["ics", " ", ""] });
    expect(
      statuses(checkAttachments(bare, [], [file("a.ics"), file("ics"), file("b.vcf")], NOW)),
    ).toEqual(["ok", "missingToken", "missingToken"]);
  });

  it("exempt files are not flagged even with a foreign token", () => {
    expect(statuses(checkAttachments(alpha, [beta], [file("BETA.ics")], NOW))).toEqual(["ok"]);
  });

  it("checks item attachments by subject and cloud links by name", () => {
    const items = [
      file("RE: ALPHA kickoff", { kind: "item" }),
      file("Quarterly numbers", { kind: "item" }),
      file("ALPHA shared folder", { kind: "cloud" }),
      file("BETA plan", { kind: "cloud" }),
    ];
    expect(statuses(checkAttachments(alpha, [beta], items, NOW))).toEqual([
      "ok",
      "missingToken",
      "ok",
      "foreignRingToken",
    ]);
  });

  it("matches Vietnamese names with and without diacritics", () => {
    const files = [file("Báo cáo ALPHA.xlsx"), file("Bao cao ÁLPHA.xlsx")];
    expect(statuses(checkAttachments(alpha, [], files, NOW))).toEqual(["ok", "ok"]);
  });

  it("with no tokens configured, nothing is missing but foreign tokens still count", () => {
    const none = ring("none", []);
    expect(
      statuses(checkAttachments(none, [beta], [file("a.pdf"), file("BETA.pdf")], NOW)),
    ).toEqual(["ok", "foreignRingToken"]);
  });

  it("handles no attachments, no other rings and empty foreign token lists", () => {
    expect(checkAttachments(alpha, [], [], NOW)).toEqual([]);
    expect(statuses(checkAttachments(alpha, [ring("e", [])], [file("a.pdf")], NOW))).toEqual([
      "missingToken",
    ]);
  });

  it("returns one result per attachment, in order, carrying the attachment", () => {
    const a = file("ALPHA.pdf");
    const b = file("zzz.pdf");
    const out = checkAttachments(alpha, [], [a, b], NOW);
    expect(out.map((c) => c.attachment)).toEqual([a, b]);
  });
});
