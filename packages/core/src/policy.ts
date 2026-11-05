// Violation modes (plan section 3, decision D-04): each kind is Warn, Acknowledge or Block per ring,
// and the global floor can only raise a mode. The floor is applied at evaluation time and is never
// written into a stored ring, so no imported ring can lower it (threat T-1).
import {
  POLICY_KEYS,
  POLICY_MODES,
  type GlobalSettings,
  type Policy,
  type PolicyMode,
  type Ring,
} from "./model";

export const DEFAULT_POLICY: Policy = {
  outsider: "warn",
  missingToken: "warn",
  foreignRingToken: "warn",
  lookalike: "warn",
  firstTime: "warn",
  fieldRule: "warn",
};

/** One-tap preset for sensitive engagements. */
export const STRICT_POLICY: Policy = {
  outsider: "acknowledge",
  missingToken: "acknowledge",
  foreignRingToken: "block",
  lookalike: "block",
  firstTime: "acknowledge",
  fieldRule: "acknowledge",
};

export const rankMode = (mode: PolicyMode): number => POLICY_MODES.indexOf(mode);

export const stricter = (a: PolicyMode, b: PolicyMode): PolicyMode =>
  rankMode(b) > rankMode(a) ? b : a;

/** Raises every kind of `policy` to at least the floor; kinds without a floor stay as they are. */
export function applyFloor(policy: Policy, floor: GlobalSettings["policyFloor"]): Policy {
  const merged = { ...policy };
  for (const key of POLICY_KEYS) {
    const minimum = floor[key];
    if (minimum !== undefined) merged[key] = stricter(merged[key], minimum);
  }
  return merged;
}

/** Effective mode per kind: the stricter of the ring's policy and the global floor. */
export const mergePolicy = (
  ring: Pick<Ring, "policy">,
  settings: Pick<GlobalSettings, "policyFloor">,
): Policy => applyFloor(ring.policy, settings.policyFloor);
