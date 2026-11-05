import {
  Badge,
  Button,
  Checkbox,
  Field,
  Input,
  makeStyles,
  ProgressBar,
  Select,
  shorthands,
  Subtitle2,
  Text,
  tokens,
} from "@fluentui/react-components";
import type { GlobalSettings, Language, Policy, PolicyKey, PolicyMode } from "@smr/core";
import { useState } from "react";
import type { StorageUsage, Translator } from "../../shared/contracts";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("12px"),
    ...shorthands.padding("12px"),
  },
  section: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("8px"),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.padding("12px"),
    ...shorthands.borderRadius("4px"),
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    ...shorthands.gap("8px"),
  },
  itemRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    ...shorthands.padding("6px", "8px"),
    ...shorthands.borderRadius("4px"),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.gap("6px"),
  },
});

interface SettingsScreenProps {
  t: Translator;
  settings: GlobalSettings;
  storageUsage: StorageUsage;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onSaveSettings: (settings: GlobalSettings) => void;
}

const POLICY_KEYS: readonly PolicyKey[] = [
  "outsider",
  "missingToken",
  "foreignRingToken",
  "lookalike",
  "firstTime",
  "fieldRule",
];

export function SettingsScreen({
  t,
  settings,
  storageUsage,
  language,
  onLanguageChange,
  onSaveSettings,
}: SettingsScreenProps) {
  const styles = useStyles();
  const [draft, setDraft] = useState<GlobalSettings>(() => structuredClone(settings));
  const [newExceptA, setNewExceptA] = useState("");
  const [newExceptB, setNewExceptB] = useState("");
  const [pasteAddresses, setPasteAddresses] = useState("");
  const [showPasteArea, setShowPasteArea] = useState(false);

  const usedKb = (storageUsage.usedBytes / 1024).toFixed(1);
  const totalKb = (storageUsage.budgetBytes / 1024).toFixed(1);
  const percent = Math.min(
    100,
    Math.round((storageUsage.usedBytes / storageUsage.budgetBytes) * 100),
  );

  const handleAddException = () => {
    if (!newExceptA.trim() || !newExceptB.trim()) return;
    const nextExceptions = [
      ...draft.lookalikeExceptions,
      { a: newExceptA.trim().toLowerCase(), b: newExceptB.trim().toLowerCase() },
    ];
    const updated = { ...draft, lookalikeExceptions: nextExceptions };
    setDraft(updated);
    onSaveSettings(updated);
    setNewExceptA("");
    setNewExceptB("");
  };

  const handleRemoveException = (idx: number) => {
    const nextExceptions = draft.lookalikeExceptions.filter((_, i) => i !== idx);
    const updated = { ...draft, lookalikeExceptions: nextExceptions };
    setDraft(updated);
    onSaveSettings(updated);
  };

  const handleToggleLearning = (checked: boolean) => {
    const updated = {
      ...draft,
      learning: {
        ...draft.learning,
        enabled: checked,
      },
    };
    setDraft(updated);
    onSaveSettings(updated);
  };

  const handlePasteKnown = () => {
    if (!pasteAddresses.trim()) return;
    setShowPasteArea(false);
    setPasteAddresses("");
  };

  const handleFloorChange = (key: PolicyKey, mode: PolicyMode | "none") => {
    const nextFloor: Partial<Policy> = {};
    for (const [k, v] of Object.entries(draft.policyFloor) as [
      PolicyKey,
      PolicyMode | undefined,
    ][]) {
      if (k !== key && v !== undefined) {
        nextFloor[k] = v;
      }
    }
    if (mode !== "none") {
      nextFloor[key] = mode;
    }
    const updated = { ...draft, policyFloor: nextFloor };
    setDraft(updated);
    onSaveSettings(updated);
  };

  return (
    <div className={styles.container}>
      <Subtitle2>{t("settings.title")}</Subtitle2>

      {/* Language Section */}
      <div className={styles.section}>
        <Text weight="semibold" size={300}>
          🌐 {t("settings.language")}
        </Text>
        <div className={styles.row}>
          <Text size={200}>{t("settings.language")}</Text>
          <Select
            value={language}
            onChange={(_e, d) => onLanguageChange(d.value as Language)}
            size="small"
            aria-label={t("settings.language")}
          >
            <option value="vi">Tiếng Việt (VI)</option>
            <option value="en">English (EN)</option>
          </Select>
        </div>
      </div>

      {/* Storage Meter Section */}
      <div className={styles.section}>
        <div className={styles.row}>
          <Text weight="semibold" size={300}>
            💾 {t("settings.storage")}
          </Text>
          <Badge size="small" appearance="tint" color={percent > 80 ? "danger" : "brand"}>
            {percent}%
          </Badge>
        </div>
        <ProgressBar value={percent / 100} color={percent > 80 ? "error" : "brand"} />
        <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
          {t("settings.storage.usage")}: {usedKb} / {totalKb} KB ({percent}%)
        </Text>
      </div>

      {/* Global Policy Floor Section */}
      <div className={styles.section}>
        <Text weight="semibold" size={300}>
          🛡️ {t("settings.floor")}
        </Text>
        <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
          Đặt mức phạt tối thiểu trên toàn bộ các vòng gửi thư.
        </Text>
        {POLICY_KEYS.map((key) => {
          const val = draft.policyFloor[key] ?? "none";
          return (
            <div key={key} className={styles.row}>
              <Text size={200}>{t(`policy.key.${key}`)}</Text>
              <Select
                value={val}
                onChange={(_e, d) => handleFloorChange(key, d.value as PolicyMode | "none")}
                size="small"
                aria-label={t(`policy.key.${key}`)}
              >
                <option value="none">-- Không áp sàn --</option>
                <option value="warn">{t("policy.mode.warn")}</option>
                <option value="acknowledge">{t("policy.mode.acknowledge")}</option>
                <option value="block">{t("policy.mode.block")}</option>
              </Select>
            </div>
          );
        })}
      </div>

      {/* Lookalike Exceptions Section */}
      <div className={styles.section}>
        <Text weight="semibold" size={300}>
          🔍 {t("settings.lookalike.exceptions")}
        </Text>
        {draft.lookalikeExceptions.map((pair, idx) => (
          <div key={`${pair.a}-${pair.b}-${idx}`} className={styles.itemRow}>
            <span style={{ fontSize: "12px" }}>
              <code>{pair.a}</code> ↔ <code>{pair.b}</code>
            </span>
            <Button
              size="small"
              appearance="subtle"
              onClick={() => handleRemoveException(idx)}
              aria-label={`Remove exception ${pair.a} and ${pair.b}`}
            >
              ✕
            </Button>
          </div>
        ))}
        <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
          <Input
            placeholder="domain1.vn"
            value={newExceptA}
            onChange={(_e, d) => setNewExceptA(d.value)}
            size="small"
            style={{ flex: 1 }}
            aria-label="Domain A"
          />
          <Input
            placeholder="domain2.vn"
            value={newExceptB}
            onChange={(_e, d) => setNewExceptB(d.value)}
            size="small"
            style={{ flex: 1 }}
            aria-label="Domain B"
          />
          <Button size="small" appearance="primary" onClick={handleAddException}>
            +
          </Button>
        </div>
      </div>

      {/* Learning Mode Section */}
      <div className={styles.section}>
        <Text weight="semibold" size={300}>
          🎓 {t("settings.learning")}
        </Text>
        <Checkbox
          label={t("settings.learning")}
          checked={draft.learning.enabled}
          onChange={(_e, d) => handleToggleLearning(Boolean(d.checked))}
        />
        {draft.learning.until && (
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            Hiệu lực đến: {new Date(draft.learning.until).toLocaleDateString()}
          </Text>
        )}
        <Button size="small" appearance="outline" onClick={() => setShowPasteArea(!showPasteArea)}>
          📋 {t("settings.learning.paste")}
        </Button>
        {showPasteArea && (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "6px" }}>
            <Field label="Dán danh sách email (mỗi dòng một địa chỉ):">
              <textarea
                rows={3}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  fontFamily: "monospace",
                  fontSize: "12px",
                }}
                value={pasteAddresses}
                onChange={(e) => setPasteAddresses(e.target.value)}
              />
            </Field>
            <Button size="small" appearance="primary" onClick={handlePasteKnown}>
              {t("common.confirm")}
            </Button>
          </div>
        )}
      </div>

      {/* About Section */}
      <div className={styles.section}>
        <Text weight="semibold" size={300}>
          ℹ️ {t("settings.about")}
        </Text>
        <Text size={200}>{t("settings.about.bundle")}: 0.1.0</Text>
        <Text size={200}>{t("settings.about.manifest")}: 1.0.0.0</Text>
      </div>
    </div>
  );
}
