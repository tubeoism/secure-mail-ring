// Ring membership matching (FR-1.2, FR-1.6, FR-1.7). Domains are compared by whole labels from the
// right, never by substring, so `abccorp.vn.evil.com` can not pass for `*.abccorp.vn`.
import type { ComposeSnapshot, FieldName, Member, RecipientEntry, Ring } from "./model";
import { domainLabels, normalizeAddress, normalizeDomain, splitAddress } from "./normalize";

/** A member in comparison form. `value` is a normalised address or a normalised domain. */
export interface CompiledMember {
  readonly kind: Member["kind"];
  readonly value: string;
}

const SUBDOMAIN_PREFIX = "*.";

/**
 * Compiles a member or an order pattern. A `subdomains` value may be written `abccorp.vn` (as
 * stored) or `*.abccorp.vn` (as shown). Unparseable values yield null and match nothing.
 */
export function compileMember(member: Member): CompiledMember | null {
  if (member.kind === "address") {
    const address = normalizeAddress(member.value);
    return address.ok ? { kind: "address", value: address.value } : null;
  }
  const raw = member.value.trim();
  const base =
    member.kind === "subdomains" && raw.startsWith(SUBDOMAIN_PREFIX) ? raw.slice(2) : raw;
  const domain = normalizeDomain(base);
  return domain.ok ? { kind: member.kind, value: domain.value } : null;
}

/** True when `domain` ends with the whole labels of `base` and has at least one more label. */
export function isStrictSubdomain(domain: string, base: string): boolean {
  const d = domainLabels(domain);
  const b = domainLabels(base);
  return d.length > b.length && b.every((label, i) => d[i] === label);
}

export function matchCompiled(member: CompiledMember, address: { local: string; domain: string }) {
  switch (member.kind) {
    case "address":
      return member.value === `${address.local}@${address.domain}`;
    case "domain":
      return member.value === address.domain;
    case "subdomains":
      return isStrictSubdomain(address.domain, member.value);
  }
}

export function matchMember(member: Member, address: string): boolean {
  const compiled = compileMember(member);
  const parsed = splitAddress(address);
  return compiled !== null && parsed.ok && matchCompiled(compiled, parsed.value);
}

export interface MemberIndex {
  /** First member in list order matching the address, or undefined. */
  find(address: string): Member | undefined;
}

/** Hash-indexed lookup so a 50-recipient check against 500 members costs microseconds. */
export function createMemberIndex(members: readonly Member[]): MemberIndex {
  const exact = new Map<string, number>();
  const domains = new Map<string, number>();
  const subdomains = new Map<string, number>();
  members.forEach((member, i) => {
    const compiled = compileMember(member);
    if (compiled === null) return;
    const table =
      compiled.kind === "address" ? exact : compiled.kind === "domain" ? domains : subdomains;
    if (!table.has(compiled.value)) table.set(compiled.value, i);
  });
  return {
    find(address) {
      const parsed = splitAddress(address);
      if (!parsed.ok) return undefined;
      const { local, domain } = parsed.value;
      const hits = [exact.get(`${local}@${domain}`), domains.get(domain)];
      const labels = domainLabels(domain);
      for (let n = 1; n < labels.length; n += 1) {
        hits.push(subdomains.get(labels.slice(0, n).reverse().join(".")));
      }
      let best: number | undefined;
      for (const hit of hits)
        if (hit !== undefined && (best === undefined || hit < best)) best = hit;
      return best === undefined ? undefined : members[best];
    },
  };
}

export const findMatchingMember = (members: readonly Member[], address: string) =>
  createMemberIndex(members).find(address);

export interface Outsider {
  readonly field: FieldName;
  readonly entry: RecipientEntry;
  /**
   * `unresolved`: no usable address (display name only); `outside`: not a member;
   * `internal`: same domain as the sender under `internalDomain: "warn"` (FR-1.7).
   */
  readonly reason: "unresolved" | "outside" | "internal";
}

const FIELDS: readonly FieldName[] = ["to", "cc", "bcc"];

/** Recipients of To, CC and BCC that the ring does not cover, in field order then list order. */
export function findOutsiders(
  ring: Pick<Ring, "members" | "internalDomain">,
  snapshot: Pick<ComposeSnapshot, "from" | FieldName>,
): Outsider[] {
  const index = createMemberIndex(ring.members);
  const sender = splitAddress(snapshot.from);
  const out: Outsider[] = [];
  for (const field of FIELDS) {
    for (const entry of snapshot[field]) {
      const parsed = splitAddress(entry.address);
      if (!parsed.ok) {
        out.push({ field, entry, reason: "unresolved" });
        continue;
      }
      if (index.find(entry.address) !== undefined) continue;
      const internal =
        sender.ok &&
        ring.internalDomain !== "outsider" &&
        sender.value.domain === parsed.value.domain;
      if (internal && ring.internalDomain === "allow") continue;
      out.push({ field, entry, reason: internal ? "internal" : "outside" });
    }
  }
  return out;
}
