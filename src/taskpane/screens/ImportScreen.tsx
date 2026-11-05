import {
  Badge,
  Button,
  Card,
  Field,
  makeStyles,
  shorthands,
  Subtitle2,
  Text,
  tokens,
} from "@fluentui/react-components";
import type { Ring, RingDiff, ShareCodePayload } from "@smr/core";
import { useState } from "react";
import { fixtures, stubCore, type Translator } from "../../shared/contracts";
import type { ScreenId } from "../types";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("12px"),
    ...shorthands.padding("12px"),
  },
  diffCard: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("8px"),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.padding("12px"),
    ...shorthands.borderRadius("4px"),
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
  },
  diffSection: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("4px"),
    fontSize: "12px",
  },
  badgeRow: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap("6px"),
  },
  itemAdded: {
    color: tokens.colorPaletteGreenForeground1,
    fontFamily: "monospace",
  },
  itemRemoved: {
    color: tokens.colorPaletteRedForeground1,
    fontFamily: "monospace",
    textDecorationLine: "line-through",
  },
  policyLoosened: {
    color: tokens.colorPaletteYellowForeground1,
    fontWeight: 600,
  },
});

interface ImportScreenProps {
  t: Translator;
  rings: readonly Ring[];
  onImportRing: (ring: Ring) => void;
  onNavigate: (screen: ScreenId) => void;
}

export function handleImportKeyDown(
  e: { key: string; preventDefault?: () => void; stopPropagation?: () => void },
  onNavigate: (screen: ScreenId) => void,
) {
  if (e.key === "Escape") {
    e.stopPropagation?.();
    onNavigate("rings");
  }
}

export function ImportScreen({ t, rings, onImportRing, onNavigate }: ImportScreenProps) {
  const styles = useStyles();
  const [inputCode, setInputCode] = useState("");
  const [decoded, setDecoded] = useState<ShareCodePayload | null>(null);
  const [diff, setDiff] = useState<RingDiff | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDecode = async (codeToDecode: string) => {
    setErrorMsg(null);
    if (!codeToDecode.trim()) {
      setDecoded(null);
      setDiff(null);
      return;
    }

    const res = await stubCore.decodeRing(codeToDecode);
    if (res.ok) {
      const payload = res.value;
      setDecoded(payload);
      const existing = rings.find((r) => r.id === payload.ring.id) ?? null;
      const computedDiff = stubCore.diffRings(existing, payload.ring);
      setDiff(computedDiff);
    } else {
      setDecoded(null);
      setDiff(null);
      setErrorMsg(t("import.error.malformed"));
    }
  };

  const handleLoadSample = () => {
    const sample = fixtures.shareCodes[0]?.code ?? "";
    setInputCode(sample);
    handleDecode(sample);
  };

  const handleConfirmImport = () => {
    if (!decoded) return;
    onImportRing(decoded.ring);
    onNavigate("rings");
  };

  return (
    <div
      className={styles.container}
      tabIndex={-1}
      onKeyDown={(e) => handleImportKeyDown(e, onNavigate)}
    >
      <Subtitle2>{t("import.title")}</Subtitle2>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button size="small" appearance="subtle" onClick={handleLoadSample}>
          📄 Dán mã mẫu (Sample)
        </Button>
      </div>

      <Field label={t("import.paste")}>
        <textarea
          rows={5}
          style={{
            width: "100%",
            boxSizing: "border-box",
            fontFamily: "monospace",
            fontSize: "11px",
            padding: "8px",
            border: `1px solid ${tokens.colorNeutralStroke1}`,
            borderRadius: "4px",
          }}
          placeholder="-----BEGIN MAILRING-----&#10;smr1.k1....&#10;-----END MAILRING-----"
          value={inputCode}
          onChange={(e) => {
            setInputCode(e.target.value);
            handleDecode(e.target.value);
          }}
          aria-label={t("import.paste")}
        />
      </Field>

      {errorMsg && (
        <Text size={200} weight="semibold" style={{ color: tokens.colorPaletteRedForeground1 }}>
          ❌ {errorMsg}
        </Text>
      )}

      {/* Diff Preview */}
      {decoded && diff && (
        <Card className={styles.diffCard}>
          <div className={styles.badgeRow}>
            <Badge size="small" appearance="filled" color="brand">
              {decoded.ring.name}
            </Badge>
            <Badge size="small" appearance="tint" color="informative">
              rev {decoded.ring.rev}
            </Badge>
            <Badge size="small" appearance="outline" color="success">
              ✓ {t("import.verified")}
            </Badge>
          </div>

          <Subtitle2>{t("import.preview")}</Subtitle2>

          {diff.revRelation === "older" && (
            <div
              style={{
                backgroundColor: tokens.colorPaletteYellowBackground1,
                color: tokens.colorPaletteYellowForeground1,
                padding: "6px 8px",
                borderRadius: "4px",
                fontSize: "12px",
              }}
            >
              ⚠️ {t("import.older")} (rev {decoded.ring.rev})
            </div>
          )}

          {/* Added members */}
          <div className={styles.diffSection}>
            <Text weight="semibold">
              + {t("import.diff.added")} ({diff.addedMembers.length})
            </Text>
            {diff.addedMembers.map((m, i) => (
              <div key={i} className={styles.itemAdded}>
                + [{m.kind}] {m.value}
              </div>
            ))}
            {diff.addedMembers.length === 0 && (
              <Text size={100} italic>
                Không có
              </Text>
            )}
          </div>

          {/* Removed members */}
          <div className={styles.diffSection}>
            <Text weight="semibold">
              - {t("import.diff.removed")} ({diff.removedMembers.length})
            </Text>
            {diff.removedMembers.map((m, i) => (
              <div key={i} className={styles.itemRemoved}>
                - [{m.kind}] {m.value}
              </div>
            ))}
            {diff.removedMembers.length === 0 && (
              <Text size={100} italic>
                Không có
              </Text>
            )}
          </div>

          {/* Loosened policy changes */}
          {diff.policyChanges.length > 0 && (
            <div className={styles.diffSection}>
              <Text weight="semibold" style={{ color: tokens.colorPaletteYellowForeground1 }}>
                ⚠️ Thay đổi chính sách:
              </Text>
              {diff.policyChanges.map((p, i) => (
                <div key={i} className={styles.policyLoosened}>
                  {p.loosened ? "⚠️ Nới lỏng: " : "Thắt chặt: "}
                  {t(`policy.key.${p.key}`)}: {t(`policy.mode.${p.from}`)} →{" "}
                  {t(`policy.mode.${p.to}`)}
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: "8px" }}>
            <Button
              appearance="primary"
              size="medium"
              onClick={handleConfirmImport}
              aria-label={t("import.confirm")}
            >
              📥 {t("import.confirm")}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
