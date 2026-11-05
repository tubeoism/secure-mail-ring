import { describe, expect, it } from "vitest";
import { createSuggestRing, externalAddresses } from "../src/suggest";
import { NOW, entry, mail, members, ring } from "./helpers";

const suggestRing = createSuggestRing(() => NOW);
const alpha = ring({ id: "alpha", members: members("abccorp.vn", "kt@partner.vn") });
const beta = ring({ id: "beta", members: members("*.betacorp.vn", "ceo@betacorp.vn") });

describe("externalAddresses", () => {
  it("lists distinct normalised recipients outside the sender's domain", () => {
    const m = mail({
      from: "me@tunt.pro",
      to: [entry("A@Abccorp.vn"), entry("colleague@tunt.pro")],
      cc: [entry("a@abccorp.vn"), entry("", "Name", false)],
      bcc: [entry("x@gmail.com")],
    });
    expect(externalAddresses(m)).toEqual(["a@abccorp.vn", "x@gmail.com"]);
  });

  it("treats everyone as external when the sender does not parse", () => {
    expect(externalAddresses(mail({ from: "", to: [entry("a@tunt.pro")] }))).toEqual([
      "a@tunt.pro",
    ]);
  });
});

describe("suggestRing (E-3, D10)", () => {
  it("suggests the ring that covers the most external recipients", () => {
    const m = mail({
      to: [entry("a@abccorp.vn"), entry("b@abccorp.vn")],
      cc: [entry("ceo@betacorp.vn")],
    });
    expect(suggestRing([beta, alpha], m)).toBe("alpha");
    expect(suggestRing([alpha, beta], m)).toBe("alpha");
  });

  it("accepts a partial cover: the send check will flag the rest", () => {
    const m = mail({ to: [entry("a@abccorp.vn")], bcc: [entry("x@gmail.com")] });
    expect(suggestRing([alpha, beta], m)).toBe("alpha");
  });

  it("returns null on a tie, however the rings are ordered", () => {
    const m = mail({ to: [entry("a@abccorp.vn"), entry("ceo@betacorp.vn")] });
    expect(suggestRing([alpha, beta], m)).toBeNull();
    expect(suggestRing([beta, alpha], m)).toBeNull();
  });

  it("a later, stronger ring beats an earlier tie", () => {
    const gamma = ring({ id: "gamma", members: members("abccorp.vn", "betacorp.vn") });
    const m = mail({ to: [entry("a@abccorp.vn"), entry("b@betacorp.vn")] });
    expect(suggestRing([alpha, beta, gamma], m)).toBe("gamma");
  });

  it("returns null when nothing matches, there are no rings or no recipients", () => {
    expect(suggestRing([alpha], mail({ to: [entry("x@gmail.com")] }))).toBeNull();
    expect(suggestRing([], mail({ to: [entry("a@abccorp.vn")] }))).toBeNull();
    expect(suggestRing([alpha], mail())).toBeNull();
  });

  it("ignores internal recipients even when a ring lists the internal domain", () => {
    const internal = ring({ id: "internal", members: members("tunt.pro") });
    const m = mail({ to: [entry("colleague@tunt.pro")] });
    expect(suggestRing([internal], m)).toBeNull();
  });

  it("ignores expired rings", () => {
    const old = ring({ id: "old", members: alpha.members, expiresAt: "2026-06-30T00:00:00Z" });
    const m = mail({ to: [entry("a@abccorp.vn")] });
    expect(suggestRing([old], m)).toBeNull();
    expect(suggestRing([old, alpha], m)).toBe("alpha");
  });

  it("uses the injected clock", () => {
    const early = createSuggestRing(() => new Date("2026-01-01T00:00:00Z"));
    const old = ring({ id: "old", members: alpha.members, expiresAt: "2026-06-30T00:00:00Z" });
    expect(early([old], mail({ to: [entry("a@abccorp.vn")] }))).toBe("old");
  });
});
