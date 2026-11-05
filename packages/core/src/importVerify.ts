// Import-source check for "Import from this email" (FR-2.9, D-15, threat T-1). Pure: the caller
// reads the mail (sender, the `Authentication-Results` header lines) and the decoded code, and gets
// back what to show next to the diff preview. It never blocks by itself; the UI decides.
//
// Trust rule (RFC 8601): the server that received the mail prepends its own `Authentication-Results`
// header; lower ones may have been written by the sender, so only the topmost header is read. A
// missing or unreadable header is "unverified", not "failed".
import { normalizeAddress, normalizeDomain, splitAddress } from "./normalize";

export type AuthenticationVerdict = "pass" | "fail" | "unverified";
export type ImportWarning = "senderExternal" | "authFailed" | "authUnverified" | "issuerMismatch";

export interface ImportSourceInput {
  readonly senderAddress: string;
  /** Domains of the organisation. */
  readonly internalDomains: readonly string[];
  /** Raw values of the `Authentication-Results` headers, in message order (topmost first). */
  readonly authenticationResults: readonly string[];
  /** `issuer` of the decoded share code. */
  readonly issuer: string;
}

export interface ImportSourceCheck {
  readonly senderInternal: boolean;
  readonly authentication: AuthenticationVerdict;
  readonly issuerMatchesSender: boolean;
  readonly warnings: readonly ImportWarning[];
  /** All three checks passed. */
  readonly trusted: boolean;
}

interface Result8601 {
  readonly method: string;
  readonly result: string;
  readonly props: ReadonlyMap<string, string>;
}

/** Removes RFC 5322 comments (nested parentheses). An unbalanced comment drops the rest. */
function stripComments(text: string): string {
  let depth = 0;
  let out = "";
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charAt(i);
    if (ch === "\\" && depth > 0) i += 1;
    else if (ch === "(") depth += 1;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (depth === 0) out += ch;
  }
  return out;
}

/** Method results of one header value: `dkim=pass header.d=example.com; dmarc=pass ...`. */
export function parseAuthenticationResults(value: string): Result8601[] {
  const parts = stripComments(value).replace(/\s+/g, " ").split(";");
  const out: Result8601[] = [];
  // A part that is not `method=result` is the authserv-id (and its version) and is skipped. Some
  // servers, Exchange Online among them, write no authserv-id, so every part is looked at.
  for (const part of parts) {
    const tokens = part.split(" ").filter((t) => t !== "");
    const head = /^([A-Za-z][A-Za-z0-9-]*)=([A-Za-z]+)$/.exec(tokens[0] ?? "");
    if (!head) continue;
    const [, method = "", result = ""] = head;
    const props = new Map<string, string>();
    for (const token of tokens.slice(1)) {
      const kv = /^([A-Za-z][A-Za-z0-9-]*\.[A-Za-z][A-Za-z0-9-]*)=(.*)$/.exec(token);
      if (!kv) continue;
      const [, name = "", rawValue = ""] = kv;
      const key = name.toLowerCase();
      if (!props.has(key)) props.set(key, rawValue.replace(/^"|"$/g, ""));
    }
    out.push({ method: method.toLowerCase(), result: result.toLowerCase(), props });
  }
  return out;
}

const domainOf = (raw: string | undefined): string | null => {
  if (raw === undefined) return null;
  const at = raw.lastIndexOf("@");
  const d = normalizeDomain(at >= 0 ? raw.slice(at + 1) : raw);
  return d.ok ? d.value : null;
};

/** True when `domain` equals `parent` or lies below it (relaxed alignment). */
const alignedWith = (domain: string, parent: string) =>
  domain === parent || domain.endsWith(`.${parent}`);

function judge(header: string | undefined, senderDomain: string | null): AuthenticationVerdict {
  if (header === undefined || senderDomain === null) return "unverified";
  const results = parseAuthenticationResults(header).filter(
    (r) => r.method === "dkim" || r.method === "dmarc",
  );
  let failed = false;
  for (const r of results) {
    const target = domainOf(r.props.get(r.method === "dmarc" ? "header.from" : "header.d"));
    if (target === null) continue;
    const aligned =
      r.method === "dmarc" ? target === senderDomain : alignedWith(senderDomain, target);
    if (!aligned) continue;
    if (r.result === "pass") return "pass";
    if (["fail", "softfail", "permerror", "policy", "reject"].includes(r.result)) failed = true;
  }
  return failed ? "fail" : "unverified";
}

export function verifyImportSource(input: ImportSourceInput): ImportSourceCheck {
  const sender = splitAddress(input.senderAddress);
  const senderDomain = sender.ok ? sender.value.domain : null;
  const internal = new Set(
    input.internalDomains.flatMap((d) => {
      const n = normalizeDomain(d);
      return n.ok ? [n.value] : [];
    }),
  );
  const senderInternal = senderDomain !== null && internal.has(senderDomain);

  const authentication = judge(input.authenticationResults[0], senderDomain);

  const issuer = normalizeAddress(input.issuer);
  const from = normalizeAddress(input.senderAddress);
  const issuerMatchesSender = issuer.ok && from.ok && issuer.value === from.value;

  const warnings: ImportWarning[] = [];
  if (!senderInternal) warnings.push("senderExternal");
  if (authentication === "fail") warnings.push("authFailed");
  if (authentication === "unverified") warnings.push("authUnverified");
  if (!issuerMatchesSender) warnings.push("issuerMismatch");

  return {
    senderInternal,
    authentication,
    issuerMatchesSender,
    warnings,
    trusted: warnings.length === 0,
  };
}
