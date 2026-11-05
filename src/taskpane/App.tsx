import { FluentProvider, makeStyles, webLightTheme } from "@fluentui/react-components";
import type { ComposeSnapshot, GlobalSettings, Language, Ring } from "@smr/core";
import { useEffect, useMemo, useState } from "react";
import {
  fixtures,
  MockOfficeAdapter,
  MockStorageAdapter,
  type StorageUsage,
} from "../shared/contracts";
import { Header } from "./components/Header";
import { NavBar } from "./components/NavBar";
import { getTranslator } from "./i18n";
import { AcknowledgeScreen } from "./screens/AcknowledgeScreen";
import { ComposeScreen } from "./screens/ComposeScreen";
import { ImportScreen } from "./screens/ImportScreen";
import { RingEditorScreen } from "./screens/RingEditorScreen";
import { RingsScreen } from "./screens/RingsScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { ShareScreen } from "./screens/ShareScreen";
import type { AppNotification, ScreenId } from "./types";

const useStyles = makeStyles({
  root: {
    minHeight: "100vh",
    width: "100%",
    maxWidth: "500px",
    margin: "0 auto",
    backgroundColor: webLightTheme.colorNeutralBackground1,
    color: webLightTheme.colorNeutralForeground1,
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
    overflowX: "hidden",
  },
  content: {
    flex: 1,
    overflowY: "auto",
  },
});

export function App() {
  const styles = useStyles();

  const initialSnapshot = fixtures.composeByName("clean-alpha");
  const office = useMemo(() => new MockOfficeAdapter(initialSnapshot), [initialSnapshot]);
  const storage = useMemo(() => new MockStorageAdapter(), []);

  const getInitialScreen = (): ScreenId => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("screen");
      if (
        p === "rings" ||
        p === "editor" ||
        p === "settings" ||
        p === "compose" ||
        p === "ack" ||
        p === "share" ||
        p === "import"
      ) {
        return p;
      }
    }
    return "rings";
  };

  // State
  const [language, setLanguage] = useState<Language>("vi");
  const [currentScreen, setCurrentScreen] = useState<ScreenId>(getInitialScreen);
  const [rings, setRings] = useState<readonly Ring[]>(() => structuredClone(fixtures.rings));
  const [settings, setSettings] = useState<GlobalSettings>(() =>
    structuredClone(fixtures.settings),
  );
  const [selectedRingId, setSelectedRingId] = useState<string | null>(
    () => fixtures.rings[0]?.id ?? null,
  );
  const [snapshot, setSnapshot] = useState<ComposeSnapshot>(initialSnapshot);
  const [storageUsage, setStorageUsage] = useState<StorageUsage>({
    usedBytes: 12400,
    budgetBytes: 32768,
  });
  const [notification, setNotification] = useState<AppNotification | null>(null);
  const [isEmptyVariant, setIsEmptyVariant] = useState(false);

  // Initialize mock storage with fixture data
  useEffect(() => {
    storage.saveRings(rings);
    storage.saveSettings(settings);
    storage.usage().then((res) => {
      if (res.ok) setStorageUsage(res.value);
    });
  }, [rings, settings, storage]);

  // Translator
  const t = useMemo(() => getTranslator(language), [language]);

  const handleNavigate = (screen: ScreenId, ringId?: string) => {
    if (ringId) setSelectedRingId(ringId);
    setCurrentScreen(screen);
  };

  const handleSaveRing = (updatedRing: Ring) => {
    const nextRings = rings.map((r) => (r.id === updatedRing.id ? updatedRing : r));
    setRings(nextRings);
    setNotification({ type: "success", message: `Đã lưu vòng "${updatedRing.name}"!` });
    setCurrentScreen("rings");
  };

  const handleDuplicateRing = (ringToDup: Ring) => {
    const dup: Ring = {
      ...structuredClone(ringToDup),
      id: `${ringToDup.id.slice(0, 20)}${Math.floor(Math.random() * 8999 + 1000)}`,
      name: `${ringToDup.name} (Copy)`,
      rev: 1,
      updatedAt: new Date().toISOString(),
    };
    setRings([dup, ...rings]);
    setNotification({ type: "info", message: `Đã nhân bản vòng "${ringToDup.name}"!` });
  };

  const handleDeleteRing = (ringId: string) => {
    const toDelete = rings.find((r) => r.id === ringId);
    setRings(rings.filter((r) => r.id !== ringId));
    setNotification({
      type: "warning",
      message: `Đã xóa vòng "${toDelete?.name ?? ringId}"!`,
    });
  };

  const handleCreateNewRing = () => {
    const newRing: Ring = {
      schema: "smr/1",
      id: `01JBX${Date.now().toString(36).toUpperCase().padStart(19, "0")}`,
      rev: 1,
      name: `Vòng gửi thư mới #${rings.length + 1}`,
      subjectTag: "",
      owner: "current.user@abccorp.vn",
      updatedAt: new Date().toISOString(),
      members: [],
      internalDomain: "allow",
      order: { to: ["*"], cc: ["*"], bcc: [] },
      attachments: { tokens: [], mode: "any", ignoreInline: true, exemptExtensions: [] },
      policy: {
        outsider: "warn",
        missingToken: "warn",
        foreignRingToken: "warn",
        lookalike: "warn",
        firstTime: "warn",
        fieldRule: "warn",
      },
      fieldRules: [],
      firstTimeCheck: true,
      expiresAt: null,
    };
    setRings([newRing, ...rings]);
    setSelectedRingId(newRing.id);
    setCurrentScreen("editor");
  };

  const handleImportRing = (importedRing: Ring) => {
    const exists = rings.some((r) => r.id === importedRing.id);
    const nextRings = exists
      ? rings.map((r) => (r.id === importedRing.id ? importedRing : r))
      : [importedRing, ...rings];
    setRings(nextRings);
    setNotification({
      type: "success",
      message: `Đã nhập thành công vòng "${importedRing.name}" (rev ${importedRing.rev})!`,
    });
  };

  const handleToggleEmptyState = () => {
    if (isEmptyVariant) {
      setRings(structuredClone(fixtures.rings));
      setIsEmptyVariant(false);
    } else {
      setRings([]);
      setIsEmptyVariant(true);
    }
  };

  const handleSendSuccess = () => {
    setNotification({
      type: "success",
      message: "Thư đã được gửi thành công sau khi xác nhận an toàn!",
    });
    setCurrentScreen("compose");
  };

  const selectedRing = rings.find((r) => r.id === selectedRingId) ?? rings[0];

  return (
    <FluentProvider theme={webLightTheme}>
      <div className={styles.root}>
        <Header
          t={t}
          language={language}
          onLanguageChange={setLanguage}
          notification={notification}
          onDismissNotification={() => setNotification(null)}
        />

        <NavBar t={t} currentScreen={currentScreen} onNavigate={handleNavigate} />

        <main className={styles.content}>
          {currentScreen === "rings" && (
            <RingsScreen
              t={t}
              rings={rings}
              onSelectRing={setSelectedRingId}
              onNavigate={handleNavigate}
              onDuplicateRing={handleDuplicateRing}
              onDeleteRing={handleDeleteRing}
              onCreateNewRing={handleCreateNewRing}
              onToggleEmptyState={handleToggleEmptyState}
              isEmptyVariant={isEmptyVariant}
            />
          )}

          {currentScreen === "editor" && selectedRing && (
            <RingEditorScreen
              t={t}
              ring={selectedRing}
              settings={settings}
              onSave={handleSaveRing}
              onBack={() => setCurrentScreen("rings")}
            />
          )}

          {currentScreen === "settings" && (
            <SettingsScreen
              t={t}
              settings={settings}
              storageUsage={storageUsage}
              language={language}
              onLanguageChange={setLanguage}
              onSaveSettings={setSettings}
            />
          )}

          {currentScreen === "compose" && (
            <ComposeScreen
              t={t}
              rings={rings}
              selectedRingId={selectedRingId}
              onSelectRing={setSelectedRingId}
              snapshot={snapshot}
              onSnapshotChange={setSnapshot}
              office={office}
              onNavigate={handleNavigate}
            />
          )}

          {currentScreen === "ack" && (
            <AcknowledgeScreen
              t={t}
              snapshot={snapshot}
              onNavigate={handleNavigate}
              onSendSuccess={handleSendSuccess}
            />
          )}

          {currentScreen === "share" && (
            <ShareScreen
              t={t}
              rings={rings}
              selectedRingId={selectedRingId}
              onSelectRing={setSelectedRingId}
              office={office}
              onNavigate={handleNavigate}
            />
          )}

          {currentScreen === "import" && (
            <ImportScreen
              t={t}
              rings={rings}
              onImportRing={handleImportRing}
              onNavigate={handleNavigate}
            />
          )}
        </main>
      </div>
    </FluentProvider>
  );
}
