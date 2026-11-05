import { Badge, Button, makeStyles, shorthands, tokens, Title3 } from "@fluentui/react-components";
import type { Language } from "@smr/core";
import type { Translator } from "../../shared/contracts";
import type { AppNotification } from "../types";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderBottom("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.padding("8px", "12px"),
  },
  topRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap("6px"),
  },
  langButton: {
    minWidth: "48px",
    fontWeight: 600,
  },
  banner: {
    marginTop: "8px",
    display: "flex",
    alignItems: "center",
    ...shorthands.gap("8px"),
    ...shorthands.padding("6px", "8px"),
    ...shorthands.borderRadius("4px"),
  },
  bannerSuccess: {
    backgroundColor: tokens.colorPaletteGreenBackground1,
    color: tokens.colorPaletteGreenForeground1,
  },
  bannerWarning: {
    backgroundColor: tokens.colorPaletteYellowBackground1,
    color: tokens.colorPaletteYellowForeground1,
  },
  bannerError: {
    backgroundColor: tokens.colorPaletteRedBackground1,
    color: tokens.colorPaletteRedForeground1,
  },
  bannerInfo: {
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground1,
  },
});

interface HeaderProps {
  t: Translator;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  notification: AppNotification | null;
  onDismissNotification: () => void;
}

export function Header({
  t,
  language,
  onLanguageChange,
  notification,
  onDismissNotification,
}: HeaderProps) {
  const styles = useStyles();

  return (
    <header className={styles.container}>
      <div className={styles.topRow}>
        <div className={styles.brand}>
          <Badge appearance="filled" color="brand">
            SMR
          </Badge>
          <Title3>{t("app.title")}</Title3>
        </div>
        <Button
          className={styles.langButton}
          appearance="outline"
          size="small"
          aria-label={t("settings.language")}
          onClick={() => onLanguageChange(language === "vi" ? "en" : "vi")}
        >
          {language === "vi" ? "VI" : "EN"}
        </Button>
      </div>

      {notification && (
        <div
          role="status"
          className={`${styles.banner} ${
            notification.type === "success"
              ? styles.bannerSuccess
              : notification.type === "warning"
                ? styles.bannerWarning
                : notification.type === "error"
                  ? styles.bannerError
                  : styles.bannerInfo
          }`}
        >
          <span style={{ flex: 1, fontSize: "12px" }}>{notification.message}</span>
          <Button
            appearance="subtle"
            size="small"
            aria-label={t("common.close")}
            onClick={onDismissNotification}
          >
            ✕
          </Button>
        </div>
      )}
    </header>
  );
}
