import {
  Button,
  Field,
  makeStyles,
  Select,
  shorthands,
  Subtitle2,
  Text,
  tokens,
} from "@fluentui/react-components";
import type { ComposeSnapshot, Ring } from "@smr/core";
import { useState } from "react";
import {
  fixtures,
  stubCore,
  type MockOfficeAdapter,
  type Translator,
} from "../../shared/contracts";
import type { ScreenId } from "../types";

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
    ...shorthands.padding("10px"),
    ...shorthands.borderRadius("4px"),
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
  },
  findingCard: {
    ...shorthands.padding("8px", "10px"),
    backgroundColor: tokens.colorPaletteYellowBackground1,
    ...shorthands.border("1px", "solid", tokens.colorPaletteYellowBorder1),
    ...shorthands.borderRadius("4px"),
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("6px"),
  },
});

interface ComposeScreenProps {
  t: Translator;
  rings: readonly Ring[];
  selectedRingId: string | null;
  onSelectRing: (id: string | null) => void;
  snapshot: ComposeSnapshot;
  onSnapshotChange: (snapshot: ComposeSnapshot) => void;
  office: MockOfficeAdapter;
  onNavigate: (screen: ScreenId) => void;
}

export function ComposeScreen({
  t,
  rings,
  selectedRingId,
  onSelectRing,
  snapshot,
  onSnapshotChange,
  office,
  onNavigate,
}: ComposeScreenProps) {
  const styles = useStyles();
  const [sortStatus, setSortStatus] = useState<string | null>(null);

  const activeRing = rings.find((r) => r.id === selectedRingId);
  const suggestedRingId = stubCore.suggestRing(rings, snapshot);
  const suggestedRing = rings.find((r) => r.id === suggestedRingId);

  // Evaluate snapshot
  const evalResult = stubCore.evaluate({
    ring: activeRing ?? null,
    allRings: rings,
    settings: fixtures.settings,
    snapshot,
    history: { schema: "smr/1", salt: "stub", current: "", previous: null, count: 0 },
    acknowledged: [],
  });
  const hasFindings = evalResult.findings.length > 0;

  const handleSortNow = async () => {
    if (!activeRing) return;
    const mutations = stubCore.sortRecipients(activeRing, snapshot);
    if (mutations.length === 0) {
      setSortStatus(t("compose.sort.done"));
      return;
    }

    try {
      for (const m of mutations) {
        await office.setRecipients(m.field, m.entries);
      }
      const updated = await office.getSnapshot();
      if (updated.ok) {
        onSnapshotChange(updated.value);
        setSortStatus(t("compose.sort.done"));
      }
    } catch {
      setSortStatus(t("compose.sort.failed"));
    }
  };

  const handleSelectFixture = (fixtureName: string) => {
    const found = fixtures.compose.find((c) => c.name === fixtureName);
    if (found) {
      onSnapshotChange(found.snapshot);
      setSortStatus(null);
    }
  };

  return (
    <div className={styles.container}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Subtitle2>{t("compose.title")}</Subtitle2>
        <Select
          size="small"
          aria-label="Select test email scenario"
          onChange={(_e, d) => handleSelectFixture(d.value)}
        >
          {fixtures.compose.map((c) => (
            <option key={c.name} value={c.name}>
              Scenario: {c.name}
            </option>
          ))}
        </Select>
      </div>

      {/* Ring Selection Section */}
      <div className={styles.section}>
        <Field label={t("compose.ring.pick")}>
          <Select
            value={selectedRingId ?? "none"}
            onChange={(_e, d) => onSelectRing(d.value === "none" ? null : d.value)}
            size="small"
            aria-label={t("compose.ring.pick")}
          >
            <option value="none">-- {t("compose.ring.none")} --</option>
            {rings.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>

        {suggestedRing && suggestedRing.id !== selectedRingId && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: tokens.colorNeutralBackground2,
              padding: "6px 8px",
              borderRadius: "4px",
            }}
          >
            <Text size={200}>
              💡 {t("compose.ring.suggested")}: <strong>{suggestedRing.name}</strong>
            </Text>
            <Button
              size="small"
              appearance="outline"
              onClick={() => onSelectRing(suggestedRing.id)}
            >
              Áp dụng
            </Button>
          </div>
        )}

        <Button
          appearance="primary"
          size="small"
          onClick={handleSortNow}
          disabled={!activeRing}
          aria-label={t("compose.sort.now")}
        >
          🔀 {t("compose.sort.now")}
        </Button>

        {sortStatus && (
          <Text size={200} weight="semibold" style={{ color: tokens.colorPaletteGreenForeground1 }}>
            ✓ {sortStatus}
          </Text>
        )}
      </div>

      {/* Mail Snapshot Details */}
      <div className={styles.section}>
        <Text weight="semibold" size={200}>
          ✉️ Chi tiết thư đang soạn:
        </Text>
        <div style={{ fontSize: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <div>
            <strong>Từ (From):</strong> {snapshot.from}
          </div>
          <div>
            <strong>Tiêu đề:</strong> {snapshot.subject || <em>(trống)</em>}
          </div>
          <div>
            <strong>Đến (To):</strong>{" "}
            {snapshot.to.map((r) => r.address).join(", ") || <em>(trống)</em>}
          </div>
          <div>
            <strong>Đồng kính gửi (CC):</strong>{" "}
            {snapshot.cc.map((r) => r.address).join(", ") || <em>(trống)</em>}
          </div>
          <div>
            <strong>Kính gửi ẩn (BCC):</strong>{" "}
            {snapshot.bcc.map((r) => r.address).join(", ") || <em>(trống)</em>}
          </div>
          <div>
            <strong>Tệp đính kèm:</strong>{" "}
            {snapshot.attachments.map((a) => a.name).join(", ") || <em>(không có)</em>}
          </div>
        </div>
      </div>

      {/* Findings Alert */}
      {hasFindings && (
        <div className={styles.findingCard}>
          <Text
            weight="semibold"
            size={200}
            style={{ color: tokens.colorPaletteYellowForeground1 }}
          >
            ⚠️ Phát hiện {evalResult.findings.length} vấn đề an toàn thư gửi!
          </Text>
          <Button
            appearance="primary"
            size="small"
            onClick={() => onNavigate("ack")}
            aria-label="Open Acknowledge Pane"
          >
            🛡️ Mở màn hình xác nhận (Acknowledge)
          </Button>
        </div>
      )}
    </div>
  );
}
