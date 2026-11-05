import {
  Badge,
  Button,
  Card,
  Checkbox,
  makeStyles,
  mergeClasses,
  shorthands,
  Subtitle2,
  Text,
  tokens,
} from "@fluentui/react-components";
import type { ComposeSnapshot, Finding, PolicyMode } from "@smr/core";
import { useState } from "react";
import { fixtures, stubCore, type I18nKey, type Translator } from "../../shared/contracts";
import { PrototypeToolbar } from "../components/PrototypeToolbar";
import type { ScreenId } from "../types";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("12px"),
    ...shorthands.padding("12px"),
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  introBox: {
    ...shorthands.padding("8px", "10px"),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius("4px"),
    fontSize: "12px",
  },
  findingList: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("8px"),
  },
  findingCard: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("6px"),
    ...shorthands.padding("10px"),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius("4px"),
  },
  cardBlock: {
    ...shorthands.borderLeft("4px", "solid", tokens.colorPaletteRedBorderActive),
  },
  cardAck: {
    ...shorthands.borderLeft("4px", "solid", tokens.colorPaletteBlueBorderActive),
  },
  cardWarn: {
    ...shorthands.borderLeft("4px", "solid", tokens.colorPaletteYellowBorderActive),
  },
  severityRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  staleBox: {
    ...shorthands.padding("8px", "10px"),
    backgroundColor: tokens.colorPaletteYellowBackground1,
    color: tokens.colorPaletteYellowForeground1,
    ...shorthands.borderRadius("4px"),
    fontSize: "12px",
  },
});

interface AcknowledgeScreenProps {
  t: Translator;
  snapshot: ComposeSnapshot;
  onNavigate: (screen: ScreenId) => void;
  onSendSuccess: () => void;
}

export function AcknowledgeScreen({
  t,
  snapshot,
  onNavigate,
  onSendSuccess,
}: AcknowledgeScreenProps) {
  const styles = useStyles();

  // Evaluate current snapshot
  const evalResult = stubCore.evaluate({
    ring: null,
    allRings: fixtures.rings,
    settings: fixtures.settings,
    snapshot,
    history: { schema: "smr/1", salt: "stub", current: "", previous: null, count: 0 },
    acknowledged: [],
  });
  // If current snapshot has 0 findings, fall back to fixture findings so PO can test every finding kind
  const activeFindings: readonly Finding[] =
    evalResult.findings.length > 0 ? evalResult.findings : fixtures.findings.slice(0, 4);

  const [tickedIndices, setTickedIndices] = useState<Record<number, boolean>>({});
  const [isStale, setIsStale] = useState(false);

  const hasBlock = activeFindings.some((f) => f.mode === "block");
  const ackFindings = activeFindings
    .map((f, i) => ({ finding: f, index: i }))
    .filter((x) => x.finding.mode === "acknowledge");
  const allAckTicked = ackFindings.every((x) => tickedIndices[x.index]);

  const canSend = !hasBlock && allAckTicked && !isStale;

  const getSeverityBadge = (mode: PolicyMode) => {
    switch (mode) {
      case "block":
        return (
          <Badge
            appearance="filled"
            color="danger"
            size="medium"
            aria-label={`${t("policy.mode.block")}: 🛑`}
          >
            🛑 {t("policy.mode.block")}
          </Badge>
        );
      case "acknowledge":
        return (
          <Badge
            appearance="filled"
            color="informative"
            size="medium"
            aria-label={`${t("policy.mode.acknowledge")}: ℹ️`}
          >
            ℹ️ {t("policy.mode.acknowledge")}
          </Badge>
        );
      case "warn":
        return (
          <Badge
            appearance="filled"
            color="important"
            size="medium"
            aria-label={`${t("policy.mode.warn")}: ⚠️`}
          >
            ⚠️ {t("policy.mode.warn")}
          </Badge>
        );
    }
  };

  const getFindingText = (f: Finding): string => {
    if (f.messageKey) {
      return t(f.messageKey as I18nKey, f.params as Record<string, string | number>);
    }
    switch (f.kind) {
      case "outsider":
        return t("finding.outsider", { address: f.subject, field: f.field ?? "To" });
      case "missingToken":
        return t("finding.missingToken", { file: f.subject });
      case "foreignRingToken":
        return t("finding.foreignRingToken", { file: f.subject, ring: "other" });
      case "lookalike":
        return t("finding.lookalike", { address: f.subject, similarTo: "target", ring: "ring" });
      case "firstTime":
        return t("finding.firstTime", { address: f.subject });
      case "fieldRule":
        return t("finding.fieldRule.mustBeIn", { address: f.subject, field: "BCC" });
    }
  };

  return (
    <div className={styles.container}>
      <PrototypeToolbar onSimulateStale={() => setIsStale(!isStale)} />
      <div className={styles.header}>
        <Subtitle2>{t("ack.title")}</Subtitle2>
      </div>

      <div className={styles.introBox}>
        <Text size={200}>{t("ack.intro")}</Text>
      </div>

      {isStale && (
        <div className={styles.staleBox}>
          ⚠️ <strong>{t("ack.stale")}</strong>
        </div>
      )}

      {/* Findings List */}
      <div className={styles.findingList}>
        {activeFindings.map((finding, idx) => {
          const isAckMode = finding.mode === "acknowledge";
          const isBlocked = finding.mode === "block";

          return (
            <Card
              key={`${finding.kind}-${finding.mode}-${idx}`}
              className={mergeClasses(
                styles.findingCard,
                finding.mode === "block"
                  ? styles.cardBlock
                  : finding.mode === "acknowledge"
                    ? styles.cardAck
                    : styles.cardWarn,
              )}
            >
              <div className={styles.severityRow}>
                <Text weight="semibold" size={200}>
                  {t(`policy.key.${finding.kind}`)}
                </Text>
                {/* AC-6: Icon + Text, not color alone */}
                {getSeverityBadge(finding.mode)}
              </div>

              <Text size={200} style={{ wordBreak: "break-word" }}>
                {getFindingText(finding)}
              </Text>

              {isAckMode && (
                <div style={{ marginTop: "6px" }}>
                  <Checkbox
                    label={t("ack.tick")}
                    checked={Boolean(tickedIndices[idx])}
                    onChange={(_e, d) =>
                      setTickedIndices({ ...tickedIndices, [idx]: Boolean(d.checked) })
                    }
                  />
                </div>
              )}

              {isBlocked && (
                <Text
                  size={100}
                  style={{ color: tokens.colorPaletteRedForeground1, fontWeight: 600 }}
                >
                  Thư bị chặn gửi theo chính sách nghiêm ngặt. Vui lòng chỉnh sửa danh sách người
                  nhận.
                </Text>
              )}
            </Card>
          );
        })}
      </div>

      {/* Action Footer */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
        <Button
          appearance="primary"
          size="large"
          disabled={!canSend}
          onClick={onSendSuccess}
          aria-label={t("ack.send")}
        >
          🚀 {t("ack.send")}
        </Button>
        <Button size="small" appearance="subtle" onClick={() => onNavigate("compose")}>
          ← {t("common.back")} {t("nav.compose")}
        </Button>
      </div>
    </div>
  );
}
