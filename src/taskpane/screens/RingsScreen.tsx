import {
  Badge,
  Button,
  Card,
  CardHeader,
  Input,
  makeStyles,
  shorthands,
  Subtitle2,
  Text,
  tokens,
} from "@fluentui/react-components";
import type { Ring } from "@smr/core";
import { useState } from "react";
import type { Translator } from "../../shared/contracts";
import type { ScreenId } from "../types";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("12px"),
    ...shorthands.padding("12px"),
  },
  toolbar: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("8px"),
  },
  topActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    ...shorthands.gap("8px"),
  },
  list: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("8px"),
  },
  card: {
    ...shorthands.padding("10px"),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  cardHeader: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    ...shorthands.gap("4px"),
  },
  ringName: {
    fontWeight: 600,
    cursor: "pointer",
    wordBreak: "break-word",
  },
  badges: {
    display: "flex",
    flexWrap: "wrap",
    ...shorthands.gap("4px"),
    marginTop: "4px",
  },
  cardActions: {
    display: "flex",
    flexWrap: "wrap",
    ...shorthands.gap("6px"),
    marginTop: "8px",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    ...shorthands.padding("32px", "16px"),
    textAlign: "center",
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius("4px"),
    ...shorthands.gap("8px"),
  },
});

interface RingsScreenProps {
  t: Translator;
  rings: readonly Ring[];
  onSelectRing: (ringId: string) => void;
  onNavigate: (screen: ScreenId, ringId?: string) => void;
  onDuplicateRing: (ring: Ring) => void;
  onDeleteRing: (ringId: string) => void;
  onCreateNewRing: () => void;
  onToggleEmptyState?: () => void;
  isEmptyVariant?: boolean;
}

export function RingsScreen({
  t,
  rings,
  onSelectRing,
  onNavigate,
  onDuplicateRing,
  onDeleteRing,
  onCreateNewRing,
  onToggleEmptyState,
  isEmptyVariant,
}: RingsScreenProps) {
  const styles = useStyles();
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredRings = rings.filter((r) =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase().trim()),
  );

  const isExpired = (r: Ring) => (r.expiresAt ? new Date(r.expiresAt) < new Date() : false);
  const isStrict = (r: Ring) =>
    r.policy.outsider === "block" &&
    r.policy.missingToken === "block" &&
    r.policy.foreignRingToken === "block";

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <div className={styles.topActions}>
          <Subtitle2>{t("rings.title")}</Subtitle2>
          <div style={{ display: "flex", gap: "6px" }}>
            {onToggleEmptyState && (
              <Button
                size="small"
                appearance="subtle"
                onClick={onToggleEmptyState}
                title="Toggle empty state fixture"
              >
                {isEmptyVariant ? "Reset Fixtures" : "Simulate Empty"}
              </Button>
            )}
            <Button
              appearance="primary"
              size="small"
              onClick={onCreateNewRing}
              aria-label={t("rings.new")}
            >
              + {t("rings.new")}
            </Button>
          </div>
        </div>

        <Input
          placeholder={t("rings.search.placeholder")}
          value={searchTerm}
          onChange={(_e, data) => setSearchTerm(data.value)}
          size="small"
          aria-label={t("rings.search.placeholder")}
        />
      </div>

      {filteredRings.length === 0 ? (
        <div className={styles.emptyState}>
          <Text weight="semibold">{t("rings.empty")}</Text>
          <Button size="small" appearance="outline" onClick={onCreateNewRing}>
            {t("rings.new")}
          </Button>
        </div>
      ) : (
        <div className={styles.list}>
          {filteredRings.map((ring) => {
            const expired = isExpired(ring);
            const strict = isStrict(ring);
            const isConfirmingDelete = deletingId === ring.id;

            return (
              <Card key={ring.id} className={styles.card}>
                <CardHeader
                  header={
                    <div className={styles.cardHeader}>
                      <span
                        className={styles.ringName}
                        onClick={() => {
                          onSelectRing(ring.id);
                          onNavigate("editor", ring.id);
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            onSelectRing(ring.id);
                            onNavigate("editor", ring.id);
                          }
                        }}
                      >
                        {ring.name}
                      </span>
                      <div className={styles.badges}>
                        <Badge size="small" appearance="tint" color="brand">
                          {ring.members.length} {t("rings.members.count")}
                        </Badge>
                        {ring.subjectTag && (
                          <Badge size="small" appearance="outline" color="informative">
                            {ring.subjectTag}
                          </Badge>
                        )}
                        {strict && (
                          <Badge size="small" appearance="filled" color="important">
                            Strict
                          </Badge>
                        )}
                        {expired && (
                          <Badge size="small" appearance="filled" color="danger">
                            {t("rings.expired")}
                          </Badge>
                        )}
                      </div>
                    </div>
                  }
                />

                {isConfirmingDelete ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      marginTop: "8px",
                      backgroundColor: tokens.colorPaletteRedBackground1,
                      padding: "8px",
                      borderRadius: "4px",
                    }}
                  >
                    <Text
                      size={200}
                      weight="semibold"
                      style={{ color: tokens.colorPaletteRedForeground1 }}
                    >
                      {t("rings.delete.confirm")}
                    </Text>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <Button
                        size="small"
                        appearance="primary"
                        onClick={() => {
                          onDeleteRing(ring.id);
                          setDeletingId(null);
                        }}
                      >
                        {t("common.confirm")}
                      </Button>
                      <Button size="small" appearance="subtle" onClick={() => setDeletingId(null)}>
                        {t("common.cancel")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.cardActions}>
                    <Button
                      size="small"
                      appearance="primary"
                      onClick={() => {
                        onSelectRing(ring.id);
                        onNavigate("editor", ring.id);
                      }}
                      aria-label={`${t("common.edit")} ${ring.name}`}
                    >
                      ✏️ {t("common.edit")}
                    </Button>
                    <Button
                      size="small"
                      appearance="outline"
                      onClick={() => {
                        onSelectRing(ring.id);
                        onNavigate("share", ring.id);
                      }}
                      aria-label={`${t("share.title")} ${ring.name}`}
                    >
                      📤 {t("share.title")}
                    </Button>
                    <Button
                      size="small"
                      appearance="subtle"
                      onClick={() => onDuplicateRing(ring)}
                      aria-label={`${t("common.duplicate")} ${ring.name}`}
                    >
                      📑 {t("common.duplicate")}
                    </Button>
                    <Button
                      size="small"
                      appearance="subtle"
                      onClick={() => setDeletingId(ring.id)}
                      aria-label={`${t("common.delete")} ${ring.name}`}
                    >
                      🗑️ {t("common.delete")}
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
