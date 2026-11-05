import {
  Badge,
  Button,
  Field,
  makeStyles,
  Select,
  shorthands,
  Subtitle2,
  Text,
  tokens,
} from "@fluentui/react-components";
import type { Ring } from "@smr/core";
import { useEffect, useState } from "react";
import { stubCore, type MockOfficeAdapter, type Translator } from "../../shared/contracts";
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
  codeCard: {
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.padding("10px"),
    ...shorthands.borderRadius("4px"),
    fontFamily: "monospace",
    fontSize: "11px",
    overflowWrap: "anywhere",
    whiteSpace: "pre-wrap",
    lineHeight: "1.4",
  },
  warningCard: {
    backgroundColor: tokens.colorPaletteYellowBackground1,
    color: tokens.colorPaletteYellowForeground1,
    ...shorthands.padding("8px", "10px"),
    ...shorthands.borderRadius("4px"),
    fontSize: "12px",
  },
});

interface ShareScreenProps {
  t: Translator;
  rings: readonly Ring[];
  selectedRingId: string | null;
  onSelectRing: (id: string) => void;
  office: MockOfficeAdapter;
  onNavigate: (screen: ScreenId) => void;
}

export function handleShareKeyDown(
  e: { key: string; preventDefault?: () => void; stopPropagation?: () => void },
  onNavigate: (screen: ScreenId) => void,
) {
  if (e.key === "Escape") {
    e.stopPropagation?.();
    onNavigate("rings");
  }
}

const CCR_STRINGS = {
  selectRing: "Select ring to share",
};

export function ShareScreen({
  t,
  rings,
  selectedRingId,
  onSelectRing,
  office,
  onNavigate,
}: ShareScreenProps) {
  const styles = useStyles();
  const [copied, setCopied] = useState(false);
  const [shareCode, setShareCode] = useState<string>("");
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  const activeRing = rings.find((r) => r.id === selectedRingId) ?? rings[0];

  useEffect(() => {
    if (!activeRing) return;
    stubCore
      .encodeRing(activeRing, {
        issuer: activeRing.owner,
        issuedAt: new Date().toISOString(),
      })
      .then((result) => {
        if (result.ok) {
          setShareCode(result.value);
        } else {
          // Fallback ASCII block for prototype demonstration
          setShareCode(
            `-----BEGIN MAILRING-----\nsmr1.k1.${btoa(activeRing.name)}\n${btoa(activeRing.id)}\n-----END MAILRING-----`,
          );
        }
      });
  }, [activeRing]);

  const hasExternalMembers =
    activeRing?.members.some(
      (m) => m.value.includes("partner.vn") || m.value.includes("external"),
    ) ?? false;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
    }
  };

  const handleShareEmail = async () => {
    if (!activeRing) return;
    if (hasExternalMembers) {
      setEmailStatus(t("share.blocked.external"));
      return;
    }

    const draft = {
      to: ["colleague@abccorp.vn"],
      cc: [],
      bcc: [],
      subject: `[MailRing] Cấu hình vòng ${activeRing.name}`,
      body: `Chào bạn,\n\nĐây là mã cấu hình vòng gửi thư "${activeRing.name}".\nVui lòng dán đoạn mã sau vào Secure Mail Ring để cập nhật:\n\n${shareCode}\n`,
    };

    await office.displayNewMessage(draft);
    setEmailStatus("Đã tạo thư chia sẻ với đồng nghiệp trong Outlook!");
  };

  return (
    <div
      className={styles.container}
      tabIndex={-1}
      onKeyDown={(e) => handleShareKeyDown(e, onNavigate)}
    >
      <div className={styles.header}>
        <Button size="small" appearance="subtle" onClick={() => onNavigate("rings")}>
          ← {t("common.back")}
        </Button>
        <Subtitle2>{t("share.title")}</Subtitle2>
        <div style={{ width: "32px" }} />
      </div>

      <Field label={CCR_STRINGS.selectRing}>
        <Select
          value={activeRing?.id ?? ""}
          onChange={(_e, d) => onSelectRing(d.value)}
          size="small"
          aria-label={CCR_STRINGS.selectRing}
        >
          {rings.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
      </Field>

      {hasExternalMembers && (
        <div className={styles.warningCard}>
          ⚠️ <strong>{t("share.blocked.external")}</strong>
        </div>
      )}

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Text weight="semibold" size={200}>
            {t("share.code")}
          </Text>
          <Badge size="small" appearance="outline">
            smr/1
          </Badge>
        </div>

        <div className={styles.codeCard} style={{ marginTop: "6px" }}>
          {shareCode}
        </div>
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        <Button appearance="primary" size="small" onClick={handleCopy} aria-label={t("share.copy")}>
          📋 {copied ? t("common.copied") : t("share.copy")}
        </Button>

        <Button
          appearance="outline"
          size="small"
          onClick={handleShareEmail}
          aria-label={t("share.email")}
        >
          ✉️ {t("share.email")}
        </Button>
      </div>

      {emailStatus && (
        <Text
          size={200}
          weight="semibold"
          style={{
            color: hasExternalMembers
              ? tokens.colorPaletteRedForeground1
              : tokens.colorPaletteGreenForeground1,
          }}
        >
          {emailStatus}
        </Text>
      )}
    </div>
  );
}
