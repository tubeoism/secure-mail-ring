import { makeStyles, shorthands, Tab, TabList, tokens } from "@fluentui/react-components";
import type { Translator } from "../../shared/contracts";
import type { ScreenId } from "../types";

const useStyles = makeStyles({
  container: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderBottom("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.padding("0", "8px"),
    overflowX: "auto",
    scrollbarWidth: "none",
    "::-webkit-scrollbar": {
      display: "none",
    },
  },
  tabList: {
    display: "flex",
    flexWrap: "nowrap",
  },
  tab: {
    minWidth: "auto",
    fontSize: "12px",
    paddingLeft: "8px",
    paddingRight: "8px",
  },
});

interface NavBarProps {
  t: Translator;
  currentScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
}

export function NavBar({ t, currentScreen, onNavigate }: NavBarProps) {
  const styles = useStyles();

  // If we are on editor or share, map to rings tab visually
  const activeValue =
    currentScreen === "editor" || currentScreen === "share" ? "rings" : currentScreen;

  return (
    <nav className={styles.container} aria-label="Main Navigation">
      <TabList
        className={styles.tabList}
        selectedValue={activeValue}
        onTabSelect={(_event, data) => onNavigate(data.value as ScreenId)}
        size="small"
      >
        <Tab className={styles.tab} value="rings">
          📋 {t("nav.rings")}
        </Tab>
        <Tab className={styles.tab} value="compose">
          ✉️ {t("nav.compose")}
        </Tab>
        <Tab className={styles.tab} value="ack">
          🛡️ {t("ack.title")}
        </Tab>
        <Tab className={styles.tab} value="import">
          📥 {t("nav.import")}
        </Tab>
        <Tab className={styles.tab} value="settings">
          ⚙️ {t("nav.settings")}
        </Tab>
      </TabList>
    </nav>
  );
}
