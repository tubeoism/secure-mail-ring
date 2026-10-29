import { describe, expect, it } from "vitest";
import {
  compileMember,
  createMemberIndex,
  findMatchingMember,
  findOutsiders,
  isStrictSubdomain,
  matchMember,
} from "../src/match";
import type { Member, RecipientEntry } from "../src/model";

const m = (kind: Member["kind"], value: string): Member => ({ kind, value });
const entry = (address: string, displayName = ""): RecipientEntry => ({
  address,
  displayName,
  resolved: address.includes("@"),
});

describe("matchMember: exact domain", () => {
  const domain = m("domain", "abccorp.vn");
  it("matches addresses at the domain, ignoring case", () => {
    expect(matchMember(domain, "CFO@ABCCorp.vn")).toBe(true);
  });
  it("does not match a subdomain (plan mandatory case)", () => {
    expect(matchMember(domain, "x@mail.abccorp.vn")).toBe(false);
  });
  it("does not match a longer or shorter domain by substring", () => {
    expect(matchMember(domain, "x@abccorp.vn.evil.com")).toBe(false);
    expect(matchMember(domain, "x@notabccorp.vn")).toBe(false);
    expect(matchMember(domain, "x@corp.vn")).toBe(false);
  });
});

describe("matchMember: subdomains", () => {
  const stored = m("subdomains", "abccorp.vn");
  const shown = m("subdomains", "*.abccorp.vn");
  it.each([stored, shown])("matches one or many levels below the base (%j)", (member) => {
    expect(matchMember(member, "x@mail.abccorp.vn")).toBe(true);
    expect(matchMember(member, "x@a.b.abccorp.vn")).toBe(true);
  });
  it.each([stored, shown])("does not match the base itself (%j)", (member) => {
    expect(matchMember(member, "x@abccorp.vn")).toBe(false);
  });
  it.each([stored, shown])("does not match abccorp.vn.evil.com (%j)", (member) => {
    expect(matchMember(member, "x@abccorp.vn.evil.com")).toBe(false);
    expect(matchMember(member, "x@evil-abccorp.vn")).toBe(false);
    expect(matchMember(member, "x@mailabccorp.vn")).toBe(false);
  });
});

describe("matchMember: address and look-alikes", () => {
  it("matches an address case-insensitively and keeps +tag significant", () => {
    expect(matchMember(m("address", "CFO@abccorp.vn"), "cfo@ABCCORP.VN")).toBe(true);
    expect(matchMember(m("address", "cfo@abccorp.vn"), "cfo+x@abccorp.vn")).toBe(false);
    expect(matchMember(m("address", "cfo@abccorp.vn"), "ceo@abccorp.vn")).toBe(false);
  });
  it("does not match a Cyrillic а in the domain (plan mandatory case)", () => {
    expect(matchMember(m("domain", "abccorp.vn"), "x@аbccorp.vn")).toBe(false);
    expect(matchMember(m("address", "x@abccorp.vn"), "x@аbccorp.vn")).toBe(false);
    expect(matchMember(m("subdomains", "abccorp.vn"), "x@m.аbccorp.vn")).toBe(false);
  });
  it("matches an internationalised member against its punycode form", () => {
    expect(matchMember(m("domain", "bücher.de"), "x@xn--bcher-kva.de")).toBe(true);
    expect(matchMember(m("domain", "xn--bcher-kva.de"), "x@BÜCHER.de")).toBe(true);
  });
  it("trims member values and only strips *. from subdomain members", () => {
    expect(matchMember(m("domain", "  abccorp.vn "), "x@abccorp.vn")).toBe(true);
    expect(matchMember(m("subdomains", "  *.abccorp.vn "), "x@a.abccorp.vn")).toBe(true);
    expect(compileMember(m("domain", "*.abccorp.vn"))).toEqual({
      kind: "domain",
      value: "*.abccorp.vn",
    });
    expect(matchMember(m("domain", "*.abccorp.vn"), "x@abccorp.vn")).toBe(false);
    expect(matchMember(m("domain", "*.abccorp.vn"), "x@a.abccorp.vn")).toBe(false);
  });
  it("never matches unparseable members or addresses", () => {
    expect(matchMember(m("domain", ""), "x@abccorp.vn")).toBe(false);
    expect(matchMember(m("address", "no-at"), "no-at")).toBe(false);
    expect(matchMember(m("domain", "abccorp.vn"), "Nguyen Van A")).toBe(false);
    expect(compileMember(m("subdomains", "*."))).toBeNull();
  });
});

describe("isStrictSubdomain", () => {
  it("requires whole labels and at least one extra label", () => {
    expect(isStrictSubdomain("a.abccorp.vn", "abccorp.vn")).toBe(true);
    expect(isStrictSubdomain("abccorp.vn", "abccorp.vn")).toBe(false);
    expect(isStrictSubdomain("vn", "abccorp.vn")).toBe(false);
    expect(isStrictSubdomain("a.xabccorp.vn", "abccorp.vn")).toBe(false);
  });
});

describe("createMemberIndex / findMatchingMember", () => {
  const members = [
    m("subdomains", "abccorp.vn"),
    m("domain", "abccorp.vn"),
    m("address", "cfo@abccorp.vn"),
    m("domain", "bad value with space@@"),
    m("domain", ""),
    m("address", "no-at"),
  ];
  it("returns the first matching member in list order", () => {
    expect(findMatchingMember(members, "cfo@abccorp.vn")).toBe(members[1]);
    expect(findMatchingMember(members, "x@abccorp.vn")).toBe(members[1]);
    expect(findMatchingMember(members, "x@a.b.abccorp.vn")).toBe(members[0]);
    expect(findMatchingMember([members[1] as Member, members[0] as Member], "x@m.abccorp.vn")).toBe(
      members[0],
    );
    expect(findMatchingMember(members, "x@other.vn")).toBeUndefined();
    expect(findMatchingMember(members, "")).toBeUndefined();
  });
  it("prefers the earlier member when two kinds both match", () => {
    const list = [m("domain", "abccorp.vn"), m("address", "cfo@abccorp.vn")];
    expect(findMatchingMember(list, "cfo@abccorp.vn")).toBe(list[0]);
    const reversed = [list[1] as Member, list[0] as Member];
    expect(createMemberIndex(reversed).find("cfo@abccorp.vn")).toBe(reversed[0]);
  });
  it("keeps the first of two duplicates", () => {
    const list = [m("domain", "ABCCORP.vn"), m("domain", "abccorp.vn")];
    expect(findMatchingMember(list, "x@abccorp.vn")).toBe(list[0]);
  });
  it("agrees with matchMember for every kind", () => {
    const addresses = ["a@abccorp.vn", "a@m.abccorp.vn", "cfo@abccorp.vn", "a@x.com", "a@vn"];
    for (const member of members) {
      for (const address of addresses) {
        expect(findMatchingMember([member], address) !== undefined).toBe(
          matchMember(member, address),
        );
      }
    }
  });
});

describe("findOutsiders", () => {
  const ring = (internalDomain: "allow" | "warn" | "outsider") => ({
    internalDomain,
    members: [m("domain", "abccorp.vn"), m("address", "kt@partner.vn")],
  });
  const snapshot = (over: Partial<Record<"from" | "to" | "cc" | "bcc", unknown>> = {}) => ({
    from: "me@auditfirm.vn",
    to: [entry("cfo@abccorp.vn")],
    cc: [entry("kt@partner.vn"), entry("x@gmail.com", "X")],
    bcc: [entry("Nguyen Van A")],
    ...over,
  });

  it("lists To, CC and BCC outsiders in field order with the reason", () => {
    const out = findOutsiders(ring("allow"), snapshot() as never);
    expect(out.map((o) => [o.field, o.entry.address, o.reason])).toEqual([
      ["cc", "x@gmail.com", "outside"],
      ["bcc", "Nguyen Van A", "unresolved"],
    ]);
  });
  it("treats the sender's own domain per ring policy (FR-1.7)", () => {
    const s = snapshot({ to: [entry("colleague@AuditFirm.vn")], cc: [], bcc: [] }) as never;
    expect(findOutsiders(ring("allow"), s)).toEqual([]);
    expect(findOutsiders(ring("warn"), s).map((o) => o.reason)).toEqual(["internal"]);
    expect(findOutsiders(ring("outsider"), s).map((o) => o.reason)).toEqual(["outside"]);
  });
  it("lets an explicit member beat the internal-domain policy", () => {
    const r = {
      internalDomain: "outsider" as const,
      members: [m("address", "colleague@auditfirm.vn")],
    };
    const s = snapshot({ to: [entry("colleague@auditfirm.vn")], cc: [], bcc: [] }) as never;
    expect(findOutsiders(r, s)).toEqual([]);
  });
  it("does not treat a sub-domain of the sender's domain as internal", () => {
    const s = snapshot({ to: [entry("x@mail.auditfirm.vn")], cc: [], bcc: [] }) as never;
    expect(findOutsiders(ring("allow"), s).map((o) => o.reason)).toEqual(["outside"]);
  });
  it("makes every recipient an outsider when the sender is unknown and the ring is empty", () => {
    const s = snapshot({ from: "", to: [entry("a@b.vn")], cc: [], bcc: [] }) as never;
    expect(findOutsiders({ internalDomain: "allow", members: [] }, s).map((o) => o.reason)).toEqual(
      ["outside"],
    );
  });
  it("returns nothing for an empty snapshot and keeps duplicates", () => {
    expect(findOutsiders(ring("allow"), snapshot({ to: [], cc: [], bcc: [] }) as never)).toEqual(
      [],
    );
    const twice = snapshot({ to: [entry("a@x.com"), entry("a@x.com")], cc: [], bcc: [] }) as never;
    expect(findOutsiders(ring("allow"), twice)).toHaveLength(2);
  });
});
