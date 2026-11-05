import { describe, expect, it } from "vitest";
import { parseAuthenticationResults, verifyImportSource } from "../src/importVerify";

// Header texts follow RFC 8601 and the shapes mail systems write; domains are fictional.
const EXCHANGE_PASS =
  "spf=pass (sender IP is 203.0.113.5) smtp.mailfrom=abccorp.vn; dkim=pass (signature was verified) header.d=abccorp.vn;dmarc=pass action=none header.from=abccorp.vn;compauth=pass reason=100";
const GATEWAY_PASS =
  "mx.abccorp.vn 1; dkim=pass header.d=abccorp.vn header.s=sel1; dmarc=pass (p=reject; sp=reject) header.from=abccorp.vn";

const base = {
  senderAddress: "an@abccorp.vn",
  internalDomains: ["abccorp.vn"],
  authenticationResults: [EXCHANGE_PASS],
  issuer: "an@abccorp.vn",
};
const check = (over: Partial<typeof base> = {}) => verifyImportSource({ ...base, ...over });

describe("parseAuthenticationResults (RFC 8601)", () => {
  it("reads methods, results and properties, with or without an authserv-id", () => {
    const withId = parseAuthenticationResults(GATEWAY_PASS);
    expect(withId.map((r) => [r.method, r.result])).toEqual([
      ["dkim", "pass"],
      ["dmarc", "pass"],
    ]);
    expect(withId[0]?.props.get("header.d")).toBe("abccorp.vn");
    expect(withId[0]?.props.get("header.s")).toBe("sel1");
    const exchange = parseAuthenticationResults(EXCHANGE_PASS);
    expect(exchange.map((r) => r.method)).toEqual(["spf", "dkim", "dmarc", "compauth"]);
    expect(parseAuthenticationResults("dkim=pass header.d=abccorp.vn")).toHaveLength(1);
  });

  it("ignores comments, even nested ones with semicolons, and extra spaces", () => {
    const r = parseAuthenticationResults(
      "srv; dkim=pass (a (nested; comment) here) header.d=x.vn;\r\n   dmarc=fail   header.from=x.vn",
    );
    expect(r.map((x) => [x.method, x.result])).toEqual([
      ["dkim", "pass"],
      ["dmarc", "fail"],
    ]);
    expect(r[0]?.props.get("header.d")).toBe("x.vn");
    expect(
      parseAuthenticationResults("srv; dkim=pass (unbalanced header.d=evil.vn")[0]?.props.size,
    ).toBe(0);
  });

  it("reads quoted values, lower-cases names and keeps the first of a repeated property", () => {
    const r = parseAuthenticationResults('srv; DKIM=PASS Header.D="a.vn" header.d=b.vn');
    expect(r[0]).toMatchObject({ method: "dkim", result: "pass" });
    expect(r[0]?.props.get("header.d")).toBe("a.vn");
  });

  it("returns nothing for text that is not a header", () => {
    for (const junk of ["", ";", "no results here", "x; ; ;", "dkim pass"]) {
      expect(parseAuthenticationResults(junk), junk).toEqual([]);
    }
  });
});

describe("parseAuthenticationResults: edge cases", () => {
  it("keeps what follows a nested comment, and honours an escaped parenthesis inside one", () => {
    const nested = parseAuthenticationResults(
      "srv; dkim=pass (a (b; dmarc=pass header.from=evil.vn) c) header.d=ok.vn",
    );
    expect(nested).toHaveLength(1);
    expect(nested[0]?.props.get("header.d")).toBe("ok.vn");
    const escaped = parseAuthenticationResults(
      "srv; dkim=pass (c \\) more; dmarc=pass) header.d=ok.vn",
    );
    expect(escaped).toHaveLength(1);
    expect(escaped[0]?.props.get("header.d")).toBe("ok.vn");
    // A backslash outside a comment is ordinary text.
    expect(
      parseAuthenticationResults("srv; dkim=pass header.d=a\\b.vn")[0]?.props.get("header.d"),
    ).toBe("a\\b.vn");
  });

  it("reads a result only when the whole first token is method=letters", () => {
    for (const junk of ["dkim=pass123", "1dkim=pass", "x dkim=pass", "dkim=pass=extra"]) {
      expect(parseAuthenticationResults(`srv; ${junk} header.d=a.vn`), junk).toEqual([]);
    }
  });

  it("reads a property only when its whole token is ptype.name=value", () => {
    const props = (token: string) =>
      parseAuthenticationResults(`srv; dkim=pass ${token}`)[0]?.props.size;
    expect(props("!header.d=a.vn")).toBe(0);
    expect(props("x.header.d=a.vn")).toBe(0);
    expect(props("header.d=a.vn")).toBe(1);
  });

  it("strips only the quotes around a value", () => {
    const value = (v: string) =>
      parseAuthenticationResults(`srv; dkim=pass header.d=${v}`)[0]?.props.get("header.d");
    expect(value('"a.vn"')).toBe("a.vn");
    expect(value('a"b')).toBe('a"b');
    expect(value('"a')).toBe("a");
    expect(value('a"')).toBe("a");
  });

  it("splits on spaces however many there are and on every semicolon", () => {
    const r = parseAuthenticationResults(
      "  srv ;;   dkim=pass    header.d=a.vn   ;   dmarc=pass header.from=a.vn  ",
    );
    expect(r.map((x) => x.method)).toEqual(["dkim", "dmarc"]);
    expect(r[0]?.props.get("header.d")).toBe("a.vn");
  });
});

describe("verifyImportSource: alignment details", () => {
  const verdict = (header: string, over: Partial<typeof base> = {}) =>
    verifyImportSource({ ...base, authenticationResults: [header], ...over }).authentication;

  it("reads a domain out of an address or an @domain value, and ignores a missing property", () => {
    expect(verdict("srv; dmarc=pass header.from=an@abccorp.vn")).toBe("pass");
    expect(verdict("srv; dmarc=pass header.from=@abccorp.vn")).toBe("pass");
    expect(verdict("srv; dkim=pass")).toBe("unverified");
    expect(verdict("srv; dmarc=pass")).toBe("unverified");
    expect(verdict("srv; dkim=pass header.d=")).toBe("unverified");
  });

  it("counts only DKIM and DMARC, whatever properties other methods carry", () => {
    expect(verdict("srv; spf=pass header.d=abccorp.vn")).toBe("unverified");
    expect(verdict("srv; compauth=pass header.d=abccorp.vn header.from=abccorp.vn")).toBe(
      "unverified",
    );
    expect(verdict("srv; arc=pass header.d=abccorp.vn")).toBe("unverified");
  });

  it("holds DMARC to an exact match and DKIM to a relaxed one", () => {
    const sub = {
      senderAddress: "an@mail.abccorp.vn",
      internalDomains: ["mail.abccorp.vn"],
      issuer: "an@mail.abccorp.vn",
    };
    expect(verdict("srv; dmarc=pass header.from=abccorp.vn", sub)).toBe("unverified");
    expect(verdict("srv; dkim=pass header.d=abccorp.vn", sub)).toBe("pass");
  });

  it("counts only real failures as a failure", () => {
    for (const result of ["none", "neutral", "temperror", "pass1"]) {
      expect(verdict(`srv; dkim=${result} header.d=abccorp.vn`), result).toBe("unverified");
    }
  });

  it("does not match the issuer to the sender when neither can be read", () => {
    const r = verifyImportSource({ ...base, senderAddress: "", issuer: "" });
    expect(r.issuerMatchesSender).toBe(false);
    expect(r.senderInternal).toBe(false);
    expect(
      verifyImportSource({ ...base, senderAddress: "x", issuer: "y" }).issuerMatchesSender,
    ).toBe(false);
  });
});

describe("verifyImportSource (FR-2.9)", () => {
  it("trusts an internal sender with an aligned DKIM or DMARC pass and a matching issuer", () => {
    expect(check()).toEqual({
      senderInternal: true,
      authentication: "pass",
      issuerMatchesSender: true,
      warnings: [],
      trusted: true,
    });
    expect(check({ authenticationResults: [GATEWAY_PASS] }).trusted).toBe(true);
    expect(check({ authenticationResults: ["srv; dkim=pass header.d=abccorp.vn"] }).trusted).toBe(
      true,
    );
    expect(
      check({ authenticationResults: ["srv; dmarc=pass header.from=abccorp.vn"] }).trusted,
    ).toBe(true);
  });

  it("compares domains and addresses by their normal form", () => {
    const r = check({
      senderAddress: "An@ABCCorp.VN",
      internalDomains: ["ABCCORP.vn."],
      issuer: " an@abccorp.vn ",
      authenticationResults: ["srv; dkim=pass header.d=ABCCorp.vn."],
    });
    expect(r.trusted).toBe(true);
  });

  it("warns about an external sender and still reports the other checks", () => {
    const r = check({
      senderAddress: "an@partner.vn",
      issuer: "an@partner.vn",
      authenticationResults: ["srv; dkim=pass header.d=partner.vn"],
    });
    expect(r).toMatchObject({
      senderInternal: false,
      authentication: "pass",
      issuerMatchesSender: true,
    });
    expect(r.warnings).toEqual(["senderExternal"]);
    expect(r.trusted).toBe(false);
  });

  it("accepts relaxed DKIM alignment (sender below the signing domain) but not the reverse", () => {
    expect(
      check({
        senderAddress: "an@mail.abccorp.vn",
        internalDomains: ["mail.abccorp.vn"],
        issuer: "an@mail.abccorp.vn",
        authenticationResults: ["srv; dkim=pass header.d=abccorp.vn"],
      }).authentication,
    ).toBe("pass");
    expect(
      check({ authenticationResults: ["srv; dkim=pass header.d=mail.abccorp.vn"] }).authentication,
    ).toBe("unverified");
    expect(
      check({ authenticationResults: ["srv; dkim=pass header.d=evilabccorp.vn"] }).authentication,
    ).toBe("unverified");
    expect(
      check({ authenticationResults: ["srv; dkim=pass header.d=abccorp.vn.evil.com"] })
        .authentication,
    ).toBe("unverified");
  });

  it("requires DMARC's header.from to equal the sender's domain", () => {
    expect(
      check({ authenticationResults: ["srv; dmarc=pass header.from=other.vn"] }).authentication,
    ).toBe("unverified");
    expect(
      check({ authenticationResults: ["srv; dmarc=pass header.from=mail.abccorp.vn"] })
        .authentication,
    ).toBe("unverified");
  });

  it("reports a failure for the sender's domain, but a pass elsewhere in the header wins", () => {
    for (const result of ["fail", "softfail", "permerror", "policy", "reject"]) {
      const r = check({ authenticationResults: [`srv; dkim=${result} header.d=abccorp.vn`] });
      expect(r.authentication, result).toBe("fail");
      expect(r.warnings).toContain("authFailed");
    }
    expect(
      check({
        authenticationResults: [
          "srv; dkim=fail header.d=abccorp.vn; dmarc=pass header.from=abccorp.vn",
        ],
      }).authentication,
    ).toBe("pass");
    // A failure about someone else's domain says nothing about this sender.
    expect(
      check({ authenticationResults: ["srv; dkim=fail header.d=other.vn"] }).authentication,
    ).toBe("unverified");
    // Other methods do not count.
    expect(
      check({ authenticationResults: ["srv; spf=pass smtp.mailfrom=abccorp.vn; compauth=pass"] })
        .authentication,
    ).toBe("unverified");
  });

  it("reads only the topmost header: a forged one lower down cannot help", () => {
    const forged = "evil; dkim=pass header.d=abccorp.vn";
    expect(
      check({ authenticationResults: ["srv; dkim=fail header.d=abccorp.vn", forged] })
        .authentication,
    ).toBe("fail");
    expect(check({ authenticationResults: ["srv; spf=none", forged] }).authentication).toBe(
      "unverified",
    );
    expect(
      check({ authenticationResults: [forged, "srv; dkim=fail header.d=abccorp.vn"] })
        .authentication,
    ).toBe("pass");
  });

  it("calls a missing or unreadable header unverified, never failed", () => {
    for (const authenticationResults of [[], [""], ["garbage"], [";;;"]]) {
      const r = check({ authenticationResults });
      expect(r.authentication).toBe("unverified");
      expect(r.warnings).toEqual(["authUnverified"]);
    }
  });

  it("warns when the issuer differs from the sender, or either is unreadable", () => {
    expect(check({ issuer: "boss@abccorp.vn" }).warnings).toEqual(["issuerMismatch"]);
    expect(check({ issuer: "" }).issuerMatchesSender).toBe(false);
    expect(check({ issuer: "not an address" }).issuerMatchesSender).toBe(false);
    expect(check({ senderAddress: "" }).warnings).toEqual([
      "senderExternal",
      "authUnverified",
      "issuerMismatch",
    ]);
  });

  it("ignores internal domains it cannot read", () => {
    expect(check({ internalDomains: ["", "a b", "abccorp.vn"] }).senderInternal).toBe(true);
    expect(check({ internalDomains: [] }).senderInternal).toBe(false);
  });
});
