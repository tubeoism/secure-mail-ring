import {
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Field,
  Input,
  makeStyles,
  Select,
  shorthands,
  Subtitle2,
  Tab,
  TabList,
  Text,
  tokens,
} from "@fluentui/react-components";
import type { FieldRule, GlobalSettings, Member, PolicyKey, PolicyMode, Ring } from "@smr/core";
import { useState } from "react";
import { stubCore, type Translator } from "../../shared/contracts";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("12px"),
    ...shorthands.padding("12px"),
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    ...shorthands.gap("8px"),
  },
  topFields: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("10px"),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.padding("10px"),
    ...shorthands.borderRadius("4px"),
  },
  tabs: {
    overflowX: "auto",
    scrollbarWidth: "none",
    "::-webkit-scrollbar": { display: "none" },
  },
  tabContent: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("12px"),
    marginTop: "8px",
  },
  itemRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    ...shorthands.padding("6px", "8px"),
    ...shorthands.borderRadius("4px"),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.gap("6px"),
  },
  itemValue: {
    flex: 1,
    overflowWrap: "anywhere",
    fontSize: "12px",
  },
  alertBox: {
    ...shorthands.padding("8px", "10px"),
    ...shorthands.borderRadius("4px"),
    backgroundColor: tokens.colorPaletteYellowBackground1,
    color: tokens.colorPaletteYellowForeground1,
    fontSize: "12px",
  },
  dangerBox: {
    ...shorthands.padding("8px", "10px"),
    ...shorthands.borderRadius("4px"),
    backgroundColor: tokens.colorPaletteRedBackground1,
    color: tokens.colorPaletteRedForeground1,
    fontSize: "12px",
  },
  addRow: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("6px"),
    marginTop: "4px",
  },
});

type EditorTab = "members" | "subjectTag" | "attachments" | "ordering" | "fieldRules" | "policy";

interface RingEditorScreenProps {
  t: Translator;
  ring: Ring;
  settings: GlobalSettings;
  onSave: (updatedRing: Ring) => void;
  onBack: () => void;
}

const POLICY_KEYS: readonly PolicyKey[] = [
  "outsider",
  "missingToken",
  "foreignRingToken",
  "lookalike",
  "firstTime",
  "fieldRule",
];

export function handleEditorKeyDown(
  e: { key: string; preventDefault?: () => void; stopPropagation?: () => void },
  onBack: () => void,
) {
  if (e.key === "Escape") {
    e.stopPropagation?.();
    onBack();
  }
}

export function RingEditorScreen({ t, ring, settings, onSave, onBack }: RingEditorScreenProps) {
  const styles = useStyles();
  const [activeTab, setActiveTab] = useState<EditorTab>("members");
  const [draft, setDraft] = useState<Ring>(() => structuredClone(ring));

  // Member form state
  const [newMemberKind, setNewMemberKind] = useState<Member["kind"]>("address");
  const [newMemberValue, setNewMemberValue] = useState("");

  // Token / Exempt form state
  const [newToken, setNewToken] = useState("");
  const [newExempt, setNewExempt] = useState("");

  // Field rule form state
  const [newRuleType, setNewRuleType] = useState<FieldRule["type"]>("mustBeIn");
  const [newRuleField, setNewRuleField] = useState<FieldRule["field"]>("to");
  const [newRulePattern, setNewRulePattern] = useState("");
  const [newRuleWhenExternal, setNewRuleWhenExternal] = useState(false);

  // Analyze shadowed patterns and rule conflicts with stubCore
  const allOrderPatterns = [
    ...(draft.order?.to ?? []),
    ...(draft.order?.cc ?? []),
    ...(draft.order?.bcc ?? []),
  ];
  const shadowedWarnings = stubCore.findShadowedPatterns(allOrderPatterns);
  const ruleConflicts = stubCore.detectFieldRuleConflicts(draft.fieldRules);
  const mergedPolicy = stubCore.mergePolicy(draft, settings);

  const handleAddMember = () => {
    if (!newMemberValue.trim()) return;
    const m: Member = { kind: newMemberKind, value: newMemberValue.trim().toLowerCase() };
    setDraft({ ...draft, members: [...draft.members, m] });
    setNewMemberValue("");
  };

  const handleRemoveMember = (idx: number) => {
    setDraft({ ...draft, members: draft.members.filter((_, i) => i !== idx) });
  };

  const handleAddToken = () => {
    if (!newToken.trim()) return;
    const current = draft.attachments?.tokens ?? [];
    setDraft({
      ...draft,
      attachments: {
        tokens: [...current, newToken.trim().toUpperCase()],
        mode: draft.attachments?.mode ?? "any",
        ignoreInline: draft.attachments?.ignoreInline ?? true,
        exemptExtensions: draft.attachments?.exemptExtensions ?? [],
      },
    });
    setNewToken("");
  };

  const handleRemoveToken = (tokenToRemove: string) => {
    if (!draft.attachments) return;
    setDraft({
      ...draft,
      attachments: {
        ...draft.attachments,
        tokens: draft.attachments.tokens.filter((tok) => tok !== tokenToRemove),
      },
    });
  };

  const handleAddExempt = () => {
    if (!newExempt.trim()) return;
    const current = draft.attachments?.exemptExtensions ?? [];
    const ext = newExempt.trim().startsWith(".") ? newExempt.trim() : `.${newExempt.trim()}`;
    setDraft({
      ...draft,
      attachments: {
        tokens: draft.attachments?.tokens ?? [],
        mode: draft.attachments?.mode ?? "any",
        ignoreInline: draft.attachments?.ignoreInline ?? true,
        exemptExtensions: [...current, ext.toLowerCase()],
      },
    });
    setNewExempt("");
  };

  const handleRemoveExempt = (extToRemove: string) => {
    if (!draft.attachments) return;
    setDraft({
      ...draft,
      attachments: {
        ...draft.attachments,
        exemptExtensions: draft.attachments.exemptExtensions.filter((e) => e !== extToRemove),
      },
    });
  };

  const handleAddFieldRule = () => {
    if (!newRulePattern.trim()) return;
    const rule: FieldRule = {
      type: newRuleType,
      field: newRuleField,
      pattern: newRulePattern.trim(),
      ...(newRuleWhenExternal ? { when: "anyExternal" as const } : {}),
    };
    setDraft({ ...draft, fieldRules: [...draft.fieldRules, rule] });
    setNewRulePattern("");
    setNewRuleWhenExternal(false);
  };

  const handleRemoveFieldRule = (idx: number) => {
    setDraft({ ...draft, fieldRules: draft.fieldRules.filter((_, i) => i !== idx) });
  };

  const handleApplyStrict = () => {
    setDraft({
      ...draft,
      policy: {
        outsider: "block",
        missingToken: "block",
        foreignRingToken: "block",
        lookalike: "block",
        firstTime: "warn",
        fieldRule: "block",
      },
    });
  };

  return (
    <div
      className={styles.container}
      tabIndex={-1}
      onKeyDown={(e) => handleEditorKeyDown(e, onBack)}
    >
      <div className={styles.headerRow}>
        <Button size="small" appearance="subtle" onClick={onBack} aria-label={t("common.back")}>
          ← {t("common.back")}
        </Button>
        <Subtitle2>{t("editor.title")}</Subtitle2>
        <Button
          size="small"
          appearance="primary"
          onClick={() => onSave(draft)}
          aria-label={t("common.save")}
        >
          💾 {t("common.save")}
        </Button>
      </div>

      <div className={styles.topFields}>
        <Field label={t("editor.name")} required>
          <Input
            value={draft.name}
            onChange={(_e, data) => setDraft({ ...draft, name: data.value })}
            size="small"
            aria-label={t("editor.name")}
          />
        </Field>

        <Field label={t("editor.expires")}>
          <Input
            type="date"
            value={draft.expiresAt ? draft.expiresAt.slice(0, 10) : ""}
            onChange={(_e, data) =>
              setDraft({
                ...draft,
                expiresAt: data.value ? `${data.value}T23:59:59Z` : null,
              })
            }
            size="small"
            aria-label={t("editor.expires")}
          />
        </Field>

        <Field label={t("editor.internalDomain")}>
          <Select
            value={draft.internalDomain}
            onChange={(_e, data) =>
              setDraft({
                ...draft,
                internalDomain: data.value as Ring["internalDomain"],
              })
            }
            size="small"
            aria-label={t("editor.internalDomain")}
          >
            <option value="allow">{t("editor.internalDomain.allow")}</option>
            <option value="warn">{t("editor.internalDomain.warn")}</option>
            <option value="outsider">{t("editor.internalDomain.outsider")}</option>
          </Select>
        </Field>
      </div>

      <div className={styles.tabs}>
        <TabList
          selectedValue={activeTab}
          onTabSelect={(_e, data) => setActiveTab(data.value as EditorTab)}
          size="small"
        >
          <Tab value="members">{t("editor.tab.members")}</Tab>
          <Tab value="subjectTag">{t("editor.tab.subjectTag")}</Tab>
          <Tab value="attachments">{t("editor.tab.attachments")}</Tab>
          <Tab value="ordering">{t("editor.tab.ordering")}</Tab>
          <Tab value="fieldRules">{t("editor.tab.fieldRules")}</Tab>
          <Tab value="policy">{t("editor.tab.policy")}</Tab>
        </TabList>
      </div>

      {activeTab === "members" && (
        <div className={styles.tabContent}>
          <Text size={200} weight="semibold">
            {draft.members.length} {t("rings.members.count")}
          </Text>

          {draft.members.slice(0, 50).map((m, idx) => (
            <div key={`${m.kind}-${m.value}-${idx}`} className={styles.itemRow}>
              <Badge size="small" appearance="tint">
                {m.kind === "address"
                  ? t("editor.member.kind.address")
                  : m.kind === "domain"
                    ? t("editor.member.kind.domain")
                    : t("editor.member.kind.subdomains")}
              </Badge>
              <span className={styles.itemValue}>{m.value}</span>
              <Button
                size="small"
                appearance="subtle"
                onClick={() => handleRemoveMember(idx)}
                aria-label={`${t("common.delete")} ${m.value}`}
              >
                ✕
              </Button>
            </div>
          ))}

          {draft.members.length > 50 && (
            <Text size={200} italic>
              ... và {draft.members.length - 50} thành viên khác.
            </Text>
          )}

          <div className={styles.addRow}>
            <Text weight="semibold" size={200}>
              {t("editor.member.add")}
            </Text>
            <div style={{ display: "flex", gap: "6px" }}>
              <Select
                value={newMemberKind}
                onChange={(_e, d) => setNewMemberKind(d.value as Member["kind"])}
                size="small"
                aria-label={t("editor.tab.members")}
              >
                <option value="address">{t("editor.member.kind.address")}</option>
                <option value="domain">{t("editor.member.kind.domain")}</option>
                <option value="subdomains">{t("editor.member.kind.subdomains")}</option>
              </Select>
              <Input
                placeholder={t("editor.member.value")}
                value={newMemberValue}
                onChange={(_e, d) => setNewMemberValue(d.value)}
                size="small"
                style={{ flex: 1 }}
                aria-label={t("editor.member.value")}
              />
              <Button size="small" appearance="primary" onClick={handleAddMember}>
                +
              </Button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "subjectTag" && (
        <div className={styles.tabContent}>
          <Field label={t("editor.subjectTag.label")}>
            <Input
              value={draft.subjectTag}
              onChange={(_e, d) => setDraft({ ...draft, subjectTag: d.value })}
              placeholder="[PROJECT-X]"
              size="small"
              aria-label={t("editor.subjectTag.label")}
            />
          </Field>

          <Card style={{ padding: "10px", backgroundColor: tokens.colorNeutralBackground2 }}>
            <Text size={200} weight="semibold">
              Preview tiêu đề thư:
            </Text>
            <Text size={200} style={{ fontFamily: "monospace", marginTop: "4px" }}>
              {draft.subjectTag ? `${draft.subjectTag} ` : ""}Báo cáo tài chính quý 3
            </Text>
          </Card>
        </div>
      )}

      {activeTab === "attachments" && (
        <div className={styles.tabContent}>
          <Subtitle2>{t("editor.attachments.tokens")}</Subtitle2>
          {(draft.attachments?.tokens ?? []).map((tok) => (
            <div key={tok} className={styles.itemRow}>
              <Badge size="small" color="brand">
                TOKEN
              </Badge>
              <span className={styles.itemValue}>{tok}</span>
              <Button
                size="small"
                appearance="subtle"
                onClick={() => handleRemoveToken(tok)}
                aria-label={`${t("common.delete")} ${tok}`}
              >
                ✕
              </Button>
            </div>
          ))}
          <div style={{ display: "flex", gap: "6px" }}>
            <Input
              placeholder={t("editor.attachments.tokens")}
              value={newToken}
              onChange={(_e, d) => setNewToken(d.value)}
              size="small"
              style={{ flex: 1 }}
              aria-label={t("editor.attachments.tokens")}
            />
            <Button size="small" appearance="primary" onClick={handleAddToken}>
              +
            </Button>
          </div>

          <Divider style={{ margin: "8px 0" }} />

          <Subtitle2>{t("editor.attachments.exempt")}</Subtitle2>
          {(draft.attachments?.exemptExtensions ?? []).map((ext) => (
            <div key={ext} className={styles.itemRow}>
              <Badge size="small" appearance="outline">
                EXT
              </Badge>
              <span className={styles.itemValue}>{ext}</span>
              <Button
                size="small"
                appearance="subtle"
                onClick={() => handleRemoveExempt(ext)}
                aria-label={`${t("common.delete")} ${ext}`}
              >
                ✕
              </Button>
            </div>
          ))}
          <div style={{ display: "flex", gap: "6px" }}>
            <Input
              placeholder={t("editor.attachments.exempt")}
              value={newExempt}
              onChange={(_e, d) => setNewExempt(d.value)}
              size="small"
              style={{ flex: 1 }}
              aria-label={t("editor.attachments.exempt")}
            />
            <Button size="small" appearance="primary" onClick={handleAddExempt}>
              +
            </Button>
          </div>
        </div>
      )}

      {activeTab === "ordering" && (
        <div className={styles.tabContent}>
          {shadowedWarnings.length > 0 && (
            <div className={styles.alertBox}>
              ⚠️{" "}
              {shadowedWarnings.map((w, idx) => (
                <div key={idx}>
                  {t("editor.ordering.shadowed")}: {w.shadowed} (by {w.by})
                </div>
              ))}
            </div>
          )}

          <div>
            <Text weight="semibold" size={200}>
              {t("editor.ordering.to")}
            </Text>
            <div style={{ marginTop: "4px" }}>
              {(draft.order?.to ?? []).map((p, i) => (
                <div key={`to-${i}`} className={styles.itemRow}>
                  <Badge size="small" appearance="tint">
                    #{i + 1}
                  </Badge>
                  <span className={styles.itemValue}>{p}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Text weight="semibold" size={200}>
              {t("editor.ordering.cc")}
            </Text>
            <div style={{ marginTop: "4px" }}>
              {(draft.order?.cc ?? []).map((p, i) => (
                <div key={`cc-${i}`} className={styles.itemRow}>
                  <Badge size="small" appearance="tint">
                    #{i + 1}
                  </Badge>
                  <span className={styles.itemValue}>{p}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Text weight="semibold" size={200}>
              {t("editor.ordering.bcc")}
            </Text>
            <div style={{ marginTop: "4px" }}>
              {(draft.order?.bcc ?? []).map((p, i) => (
                <div key={`bcc-${i}`} className={styles.itemRow}>
                  <Badge size="small" appearance="tint">
                    #{i + 1}
                  </Badge>
                  <span className={styles.itemValue}>{p}</span>
                </div>
              ))}
              {(draft.order?.bcc ?? []).length === 0 && (
                <Text size={200} italic style={{ color: tokens.colorNeutralForeground4 }}>
                  {t("common.empty")}
                </Text>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "fieldRules" && (
        <div className={styles.tabContent}>
          {ruleConflicts.length > 0 && (
            <div className={styles.dangerBox}>
              🛑 <strong>{t("editor.fieldRules.conflict")}</strong>: phát hiện{" "}
              {ruleConflicts.length} xung đột giữa các quy tắc trường!
            </div>
          )}

          {draft.fieldRules.map((r, idx) => (
            <div key={`rule-${idx}`} className={styles.itemRow}>
              <Badge
                size="small"
                appearance="filled"
                color={
                  r.type === "mustBeIn"
                    ? "brand"
                    : r.type === "mustNotBeIn"
                      ? "danger"
                      : "informative"
                }
              >
                {r.type === "mustBeIn"
                  ? t("editor.fieldRules.type.mustBeIn")
                  : r.type === "mustNotBeIn"
                    ? t("editor.fieldRules.type.mustNotBeIn")
                    : t("editor.fieldRules.type.onlyIn")}
              </Badge>
              <span className={styles.itemValue}>
                <strong>{r.field.toUpperCase()}</strong>: {r.pattern}
                {r.when === "anyExternal" && ` (${t("editor.fieldRules.when.anyExternal")})`}
              </span>
              <Button
                size="small"
                appearance="subtle"
                onClick={() => handleRemoveFieldRule(idx)}
                aria-label={`${t("common.delete")} ${idx + 1}`}
              >
                ✕
              </Button>
            </div>
          ))}

          {draft.fieldRules.length === 0 && (
            <Text size={200} italic style={{ color: tokens.colorNeutralForeground4 }}>
              {t("common.empty")}
            </Text>
          )}

          <div className={styles.addRow}>
            <Text weight="semibold" size={200}>
              {t("editor.fieldRules.add")}
            </Text>
            <div style={{ display: "flex", gap: "6px" }}>
              <Select
                value={newRuleType}
                onChange={(_e, d) => setNewRuleType(d.value as FieldRule["type"])}
                size="small"
                aria-label={t("editor.fieldRules.add")}
              >
                <option value="mustBeIn">{t("editor.fieldRules.type.mustBeIn")}</option>
                <option value="mustNotBeIn">{t("editor.fieldRules.type.mustNotBeIn")}</option>
                <option value="onlyIn">{t("editor.fieldRules.type.onlyIn")}</option>
              </Select>
              <Select
                value={newRuleField}
                onChange={(_e, d) => setNewRuleField(d.value as FieldRule["field"])}
                size="small"
                aria-label={t("editor.tab.fieldRules")}
              >
                <option value="to">TO</option>
                <option value="cc">CC</option>
                <option value="bcc">BCC</option>
              </Select>
            </div>
            <Input
              placeholder={t("editor.member.value")}
              value={newRulePattern}
              onChange={(_e, d) => setNewRulePattern(d.value)}
              size="small"
              aria-label={t("editor.member.value")}
            />
            <Checkbox
              label={t("editor.fieldRules.when.anyExternal")}
              checked={newRuleWhenExternal}
              onChange={(_e, d) => setNewRuleWhenExternal(Boolean(d.checked))}
            />
            <Button size="small" appearance="primary" onClick={handleAddFieldRule}>
              + {t("editor.fieldRules.add")}
            </Button>
          </div>
        </div>
      )}

      {activeTab === "policy" && (
        <div className={styles.tabContent}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button size="small" appearance="outline" onClick={handleApplyStrict}>
              ⚡ {t("editor.policy.preset.strict")}
            </Button>
          </div>

          {POLICY_KEYS.map((key) => {
            const currentMode = draft.policy[key];
            const flooredMode = mergedPolicy[key];
            const isFloored = flooredMode !== currentMode;

            return (
              <div key={key} className={styles.itemRow}>
                <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                  <Text weight="semibold" size={200}>
                    {t(`policy.key.${key}`)}
                  </Text>
                  {isFloored && (
                    <Text size={100} style={{ color: tokens.colorPaletteYellowForeground1 }}>
                      {t("editor.policy.floor")}: {t(`policy.mode.${flooredMode}`)}
                    </Text>
                  )}
                </div>
                <Select
                  value={currentMode}
                  onChange={(_e, data) =>
                    setDraft({
                      ...draft,
                      policy: {
                        ...draft.policy,
                        [key]: data.value as PolicyMode,
                      },
                    })
                  }
                  size="small"
                  aria-label={t(`policy.key.${key}`)}
                >
                  <option value="warn">{t("policy.mode.warn")}</option>
                  <option value="acknowledge">{t("policy.mode.acknowledge")}</option>
                  <option value="block">{t("policy.mode.block")}</option>
                </Select>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
