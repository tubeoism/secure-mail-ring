// Field constraints (F8): who must, must not or may only sit in To, CC or BCC. Warn-only: nothing
// is ever moved between fields (FR-8.3).
import type { RuleConflict } from "./api";
import type { ComposeSnapshot, FieldName, FieldRule, RecipientEntry } from "./model";
import { covers, matchesPattern, parsePattern, type OrderPattern } from "./order";
import { splitAddress } from "./normalize";

const FIELDS: readonly FieldName[] = ["to", "cc", "bcc"];

export interface FieldRuleViolation {
  readonly rule: FieldRule;
  /** Index of the rule in the evaluated list. */
  readonly ruleIndex: number;
  /**
   * `missing`: a `mustBeIn` match is absent from the mail; `forbidden`: a `mustNotBeIn` match sits
   * in the field; `misplaced`: a match sits outside the field it is bound to.
   */
  readonly kind: "missing" | "forbidden" | "misplaced";
  /** The recipient at fault; absent for `missing`. */
  readonly entry?: RecipientEntry;
  /** Where the offending recipient actually is (`forbidden` and `misplaced`). */
  readonly foundIn?: FieldName;
}

const patternOf = (rule: FieldRule): OrderPattern | null => {
  const pattern = parsePattern(rule.pattern);
  return pattern?.kind === "rest" ? null : pattern;
};

/** Evaluates every rule against the mail. `*` and unparseable patterns are ignored. */
export function evaluateFieldRules(
  rules: readonly FieldRule[],
  snapshot: Pick<ComposeSnapshot, "from" | FieldName>,
): FieldRuleViolation[] {
  const sender = splitAddress(snapshot.from);
  const external = FIELDS.some((field) =>
    snapshot[field].some((entry) => {
      const parsed = splitAddress(entry.address);
      return !parsed.ok || !sender.ok || parsed.value.domain !== sender.value.domain;
    }),
  );
  const out: FieldRuleViolation[] = [];
  rules.forEach((rule, ruleIndex) => {
    const pattern = patternOf(rule);
    if (pattern === null || (rule.when === "anyExternal" && !external)) return;
    const hits = FIELDS.flatMap((field) =>
      snapshot[field].filter((e) => matchesPattern(pattern, e)).map((entry) => ({ field, entry })),
    );
    if (rule.type === "mustBeIn") {
      if (hits.some((h) => h.field === rule.field)) return;
      const elsewhere = hits[0];
      out.push(
        elsewhere
          ? { rule, ruleIndex, kind: "misplaced", entry: elsewhere.entry, foundIn: elsewhere.field }
          : { rule, ruleIndex, kind: "missing" },
      );
    } else if (rule.type === "mustNotBeIn") {
      for (const h of hits.filter((x) => x.field === rule.field)) {
        out.push({ rule, ruleIndex, kind: "forbidden", entry: h.entry, foundIn: h.field });
      }
    } else {
      for (const h of hits.filter((x) => x.field !== rule.field)) {
        out.push({ rule, ruleIndex, kind: "misplaced", entry: h.entry, foundIn: h.field });
      }
    }
  });
  return out;
}

const incompatible = (a: FieldRule, b: FieldRule): boolean => {
  const pair = (x: FieldRule["type"], y: FieldRule["type"]) =>
    (a.type === x && b.type === y) || (a.type === y && b.type === x);
  const sameField = a.field === b.field;
  if (pair("mustBeIn", "mustNotBeIn")) return sameField;
  if (pair("mustNotBeIn", "onlyIn")) return sameField;
  if (pair("mustBeIn", "onlyIn")) return !sameField;
  return a.type === "onlyIn" && b.type === "onlyIn" && !sameField;
};

/** FR-8.4: pairs of rules that overlap on some recipient and can not both hold. */
export function detectFieldRuleConflicts(rules: readonly FieldRule[]): RuleConflict[] {
  const patterns = rules.map(patternOf);
  const out: RuleConflict[] = [];
  rules.forEach((a, i) => {
    const pa = patterns[i];
    if (!pa) return;
    rules.forEach((b, j) => {
      const pb = patterns[j];
      if (j <= i || !pb || !incompatible(a, b)) return;
      if (covers(pa, pb) || covers(pb, pa)) out.push({ a, b });
    });
  });
  return out;
}
