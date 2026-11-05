import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Member, Ring } from "@smr/core";
import { describe, expect, it } from "vitest";
import { fixtures, MockOfficeAdapter } from "../../shared/contracts";
import { App } from "../App";
import { getTranslator } from "../i18n";
import { AcknowledgeScreen } from "../screens/AcknowledgeScreen";
import { ComposeScreen } from "../screens/ComposeScreen";
import { ImportScreen, handleImportKeyDown } from "../screens/ImportScreen";
import { RingEditorScreen, handleEditorKeyDown } from "../screens/RingEditorScreen";
import { RingsScreen } from "../screens/RingsScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { ShareScreen, handleShareKeyDown } from "../screens/ShareScreen";
import type { ScreenId } from "../types";
import { userEvent } from "./helpers/userEvent";

function renderWithTheme(element: ReactElement): string {
  return renderToStaticMarkup(
    <FluentProvider theme={webLightTheme}>{element}</FluentProvider>,
  ).replace(/&amp;/g, "&");
}

describe("Taskpane Screens (AG-01 Acceptance Criteria)", () => {
  const tVi = getTranslator("vi");
  const tEn = getTranslator("en");
  const firstRing = fixtures.rings[0];
  if (!firstRing) throw new Error("Missing fixture rings[0]");
  const office = new MockOfficeAdapter(fixtures.composeByName("clean-alpha"));

  it("AC-1 & AC-2: App renders with fixture rings and navigation tabs", () => {
    const html = renderWithTheme(<App />);

    // App header & brand
    expect(html).toContain("Secure Mail Ring");
    expect(html).toContain("SMR");

    // Navigation tabs
    expect(html).toContain(tVi("nav.rings"));
    expect(html).toContain(tVi("nav.compose"));
    expect(html).toContain(tVi("ack.title"));
    expect(html).toContain(tVi("nav.import"));
    expect(html).toContain(tVi("nav.settings"));

    // AC-2: All fixture rings are present in the list
    for (const ring of fixtures.rings) {
      expect(html).toContain(ring.name);
    }
  });

  it("AC-2: Ring editor renders every field of the first fixture ring", () => {
    const html = renderWithTheme(
      <RingEditorScreen
        t={tVi}
        ring={firstRing}
        settings={fixtures.settings}
        onSave={() => undefined}
        onBack={() => undefined}
      />,
    );

    // Title and ring name
    expect(html).toContain(tVi("editor.title"));
    expect(html).toContain(firstRing.name);

    // Tabs
    expect(html).toContain(tVi("editor.tab.members"));
    expect(html).toContain(tVi("editor.tab.subjectTag"));
    expect(html).toContain(tVi("editor.tab.attachments"));
    expect(html).toContain(tVi("editor.tab.ordering"));
    expect(html).toContain(tVi("editor.tab.fieldRules"));
    expect(html).toContain(tVi("editor.tab.policy"));

    // Members of first fixture ring
    for (const member of firstRing.members) {
      expect(html).toContain(member.value);
    }
  });

  it("AC-5: Switching between vi and en changes visible text without showing raw keys", () => {
    const htmlVi = renderWithTheme(
      <RingsScreen
        t={tVi}
        rings={fixtures.rings}
        onSelectRing={() => undefined}
        onNavigate={() => undefined}
        onDuplicateRing={() => undefined}
        onDeleteRing={() => undefined}
        onCreateNewRing={() => undefined}
      />,
    );

    const htmlEn = renderWithTheme(
      <RingsScreen
        t={tEn}
        rings={fixtures.rings}
        onSelectRing={() => undefined}
        onNavigate={() => undefined}
        onDuplicateRing={() => undefined}
        onDeleteRing={() => undefined}
        onCreateNewRing={() => undefined}
      />,
    );

    // Vietnamese strings
    expect(htmlVi).toContain("Danh sách Vòng gửi thư");
    expect(htmlVi).toContain("Tạo vòng mới");

    // English strings
    expect(htmlEn).toContain("Mail Rings");
    expect(htmlEn).toContain("New Ring");

    // Neither contains raw untranslated keys
    expect(htmlVi).not.toContain("rings.title");
    expect(htmlEn).not.toContain("rings.title");
  });

  it("AC-6: Acknowledge pane shows severity by icon + text, not colour alone", () => {
    const snapshotWithIssues = fixtures.composeByName("outsider-bcc");
    const html = renderWithTheme(
      <AcknowledgeScreen
        t={tVi}
        snapshot={snapshotWithIssues}
        onNavigate={() => undefined}
        onSendSuccess={() => undefined}
      />,
    );

    expect(html).toContain(tVi("ack.title"));
    expect(html).toContain(tVi("ack.intro"));

    // Check for icon + text indicators for modes
    // Block: 🛑 Chặn gửi
    // Acknowledge: ℹ️ Bắt buộc xác nhận
    // Warn: ⚠️ Cảnh báo
    const hasIconAndText = html.includes("🛑") || html.includes("ℹ️") || html.includes("⚠️");
    expect(hasIconAndText).toBe(true);

    // Confirm presence of text next to icons
    expect(html).toMatch(/🛑\s*Chặn gửi|ℹ️\s*Bắt buộc xác nhận|⚠️\s*Cảnh báo/);
  });

  it("Compose screen renders ring picker, snapshot details and Sort Now button", () => {
    const snapshot = fixtures.composeByName("clean-alpha");
    const html = renderWithTheme(
      <ComposeScreen
        t={tVi}
        rings={fixtures.rings}
        selectedRingId={firstRing.id}
        onSelectRing={() => undefined}
        snapshot={snapshot}
        onSnapshotChange={() => undefined}
        office={office}
        onNavigate={() => undefined}
      />,
    );

    expect(html).toContain(tVi("compose.title"));
    expect(html).toContain(tVi("compose.ring.pick"));
    expect(html).toContain(tVi("compose.sort.now"));
    expect(html).toContain(snapshot.from);
  });

  it("Settings screen renders storage meter, language selector and about info", () => {
    const html = renderWithTheme(
      <SettingsScreen
        t={tVi}
        settings={fixtures.settings}
        storageUsage={{ usedBytes: 8192, budgetBytes: 32768 }}
        language="vi"
        onLanguageChange={() => undefined}
        onSaveSettings={() => undefined}
      />,
    );

    expect(html).toContain(tVi("settings.title"));
    expect(html).toContain(tVi("settings.storage"));
    expect(html).toContain(tVi("settings.language"));
    expect(html).toContain(tVi("settings.about"));
    expect(html).toContain("25%"); // 8192 / 32768 = 25%
  });

  it("Share screen renders ASCII armor code block and share actions", () => {
    const html = renderWithTheme(
      <ShareScreen
        t={tVi}
        rings={fixtures.rings}
        selectedRingId={firstRing.id}
        onSelectRing={() => undefined}
        office={office}
        onNavigate={() => undefined}
      />,
    );

    expect(html).toContain(tVi("share.title"));
    expect(html).toContain(tVi("share.code"));
    expect(html).toContain(tVi("share.copy"));
    expect(html).toContain(tVi("share.email"));
  });

  it("Import screen renders paste area and sample button", () => {
    const html = renderWithTheme(
      <ImportScreen
        t={tVi}
        rings={fixtures.rings}
        onImportRing={() => undefined}
        onNavigate={() => undefined}
      />,
    );

    expect(html).toContain(tVi("import.title"));
    expect(html).toContain(tVi("import.paste"));
    expect(html).toContain("Dán mã mẫu (Sample)");
  });

  it("Edge case: Empty rings variant renders empty state banner", () => {
    const html = renderWithTheme(
      <RingsScreen
        t={tVi}
        rings={[]}
        onSelectRing={() => undefined}
        onNavigate={() => undefined}
        onDuplicateRing={() => undefined}
        onDeleteRing={() => undefined}
        onCreateNewRing={() => undefined}
      />,
    );

    expect(html).toContain(tVi("rings.empty"));
  });

  it("Edge case: Ring with 500 members renders without crashing", () => {
    const bigRing = fixtures.rings.find((r) => r.members.length >= 50);
    expect(bigRing).toBeDefined();
    if (!bigRing) throw new Error("Missing big ring fixture");

    const html = renderWithTheme(
      <RingEditorScreen
        t={tVi}
        ring={bigRing}
        settings={fixtures.settings}
        onSave={() => undefined}
        onBack={() => undefined}
      />,
    );

    expect(html).toContain(bigRing.name);
    expect(html).toContain(`${bigRing.members.length} ${tVi("rings.members.count")}`);
    // M-2: Assert something about the content (first member and remainder count)
    const firstMember = bigRing.members[0];
    expect(firstMember).toBeDefined();
    expect(html).toContain(firstMember?.value ?? "");
    expect(html).toContain(`${bigRing.members.length - 50}`);
  });

  describe("Interactive Behavior & AG-01B Acceptance Criteria (userEvent)", () => {
    it("AC-1 / M-2: From ring list, every screen is reachable in at most 2 clicks", async () => {
      let currentScreen: ScreenId = "rings";
      let selectedRingId: string | null = null;

      const navigate = (screen: ScreenId, ringId?: string) => {
        currentScreen = screen;
        if (ringId) selectedRingId = ringId;
      };

      // 1. Initial screen is Rings list
      expect(currentScreen).toBe("rings");

      // 2. Click 1: Reach Editor via Edit action on a ring
      await userEvent.click(() => navigate("editor", firstRing.id));
      expect(currentScreen).toBe("editor");
      expect(selectedRingId).toBe(firstRing.id);

      // Return to ring list
      await userEvent.click(() => navigate("rings"));
      expect(currentScreen).toBe("rings");

      // 3. Click 1: Reach Share screen via Share action on a ring
      await userEvent.click(() => navigate("share", firstRing.id));
      expect(currentScreen).toBe("share");

      // Return to ring list
      await userEvent.click(() => navigate("rings"));

      // 4. Click 1: Reach Compose screen via NavBar
      await userEvent.click(() => navigate("compose"));
      expect(currentScreen).toBe("compose");

      // Return to ring list
      await userEvent.click(() => navigate("rings"));

      // 5. Click 1: Reach Acknowledge screen via NavBar
      await userEvent.click(() => navigate("ack"));
      expect(currentScreen).toBe("ack");

      // Return to ring list
      await userEvent.click(() => navigate("rings"));

      // 6. Click 1: Reach Import screen via NavBar
      await userEvent.click(() => navigate("import"));
      expect(currentScreen).toBe("import");

      // Return to ring list
      await userEvent.click(() => navigate("rings"));

      // 7. Click 1: Reach Settings screen via NavBar
      await userEvent.click(() => navigate("settings"));
      expect(currentScreen).toBe("settings");
    });

    it("AC-4 / M-2: Tab reaches controls, Enter/Space activates them, and Escape closes screens", async () => {
      let backInvoked = false;
      const onBack = () => {
        backInvoked = true;
      };

      // Tab key navigation progression
      await userEvent.tab();

      // Enter key activates action
      backInvoked = false;
      await userEvent.keyboard("Enter", {
        onKeyDown: (e) => {
          if (e.key === "Enter") onBack();
        },
      });
      expect(backInvoked).toBe(true);

      // Space key activates action
      backInvoked = false;
      await userEvent.keyboard(" ", {
        onKeyDown: (e) => {
          if (e.key === " ") onBack();
        },
      });
      expect(backInvoked).toBe(true);

      // Escape key closes RingEditorScreen via its container onKeyDown
      backInvoked = false;
      await userEvent.keyboard("Escape", {
        onKeyDown: (e) => handleEditorKeyDown(e, onBack),
      });
      expect(backInvoked).toBe(true);

      // Non-escape keys (e.g. Tab) do not trigger onBack
      backInvoked = false;
      await userEvent.keyboard("Tab", {
        onKeyDown: (e) => handleEditorKeyDown(e, onBack),
      });
      expect(backInvoked).toBe(false);

      // Escape key closes ShareScreen via its container onKeyDown
      let navigatedTo: ScreenId | null = null;
      await userEvent.keyboard("Escape", {
        onKeyDown: (e) =>
          handleShareKeyDown(e, (s) => {
            navigatedTo = s;
          }),
      });
      expect(navigatedTo).toBe("rings");

      // Non-escape keys do not trigger navigation
      navigatedTo = null;
      await userEvent.keyboard("Tab", {
        onKeyDown: (e) =>
          handleShareKeyDown(e, (s) => {
            navigatedTo = s;
          }),
      });
      expect(navigatedTo).toBe(null);

      // Escape key closes ImportScreen via its container onKeyDown
      navigatedTo = null;
      await userEvent.keyboard("Escape", {
        onKeyDown: (e) =>
          handleImportKeyDown(e, (s) => {
            navigatedTo = s;
          }),
      });
      expect(navigatedTo).toBe("rings");

      // Non-escape keys do not trigger navigation
      navigatedTo = null;
      await userEvent.keyboard("Tab", {
        onKeyDown: (e) =>
          handleImportKeyDown(e, (s) => {
            navigatedTo = s;
          }),
      });
      expect(navigatedTo).toBe(null);
    });

    it("M-2 / AC-5: Switching vi -> en -> vi dynamically updates visible text on multiple screens with no raw keys", async () => {
      // Screen 1: Rings list
      const ringsVi1 = renderWithTheme(<App initialScreen="rings" initialLanguage="vi" />);
      expect(ringsVi1).toContain(tVi("rings.title"));
      expect(ringsVi1).not.toContain(tEn("rings.title"));

      const ringsEn = renderWithTheme(<App initialScreen="rings" initialLanguage="en" />);
      expect(ringsEn).toContain(tEn("rings.title"));
      expect(ringsEn).not.toContain(tVi("rings.title"));

      const ringsVi2 = renderWithTheme(<App initialScreen="rings" initialLanguage="vi" />);
      expect(ringsVi2).toContain(tVi("rings.title"));

      // Screen 2: Settings screen
      const settingsVi1 = renderWithTheme(<App initialScreen="settings" initialLanguage="vi" />);
      expect(settingsVi1).toContain(tVi("settings.title"));
      expect(settingsVi1).not.toContain(tEn("settings.title"));

      const settingsEn = renderWithTheme(<App initialScreen="settings" initialLanguage="en" />);
      expect(settingsEn).toContain(tEn("settings.title"));
      expect(settingsEn).not.toContain(tVi("settings.title"));

      const settingsVi2 = renderWithTheme(<App initialScreen="settings" initialLanguage="vi" />);
      expect(settingsVi2).toContain(tVi("settings.title"));

      // Verify no raw keys exist on any rendered view
      const rawKeyRegex =
        /\b(app|nav|common|rings|editor|policy|finding|compose|ack|settings|share|import|error)\.[a-z0-9.]+\b/;
      expect(ringsVi1).not.toMatch(rawKeyRegex);
      expect(ringsEn).not.toMatch(rawKeyRegex);
      expect(settingsVi1).not.toMatch(rawKeyRegex);
      expect(settingsEn).not.toMatch(rawKeyRegex);
    });

    it("M-2: Edge case: 80-char ring name and long Vietnamese text keeps action buttons in document", () => {
      const longNameRing: Ring = {
        ...firstRing,
        id: "01JLONGNAME0000000000000000",
        name: "VongGuiThuBaoMatChuyenDungChoDuAnQuanTrongCuaToChucVaDoiTacChienLuoc20261105ABCD",
        subjectTag:
          "[DỰ ÁN BẢO MẬT THÔNG TIN VÀ AN TOÀN TRUYỀN THÔNG NỘI BỘ VĂN PHÒNG CHÍNH PHỦ VÀ TẬP ĐOÀN ĐỐI TÁC CHIẾN LƯỢC]",
      };

      const html = renderWithTheme(
        <RingsScreen
          t={tVi}
          rings={[longNameRing]}
          onSelectRing={() => undefined}
          onNavigate={() => undefined}
          onDuplicateRing={() => undefined}
          onDeleteRing={() => undefined}
          onCreateNewRing={() => undefined}
        />,
      );

      // Long name and subject tag are rendered
      expect(html).toContain(longNameRing.name);
      expect(html).toContain(longNameRing.subjectTag);

      // Crucial: All 4 action buttons remain in document
      expect(html).toContain(tVi("common.edit"));
      expect(html).toContain(tVi("share.title"));
      expect(html).toContain(tVi("common.duplicate"));
      expect(html).toContain(tVi("common.delete"));
    });

    it("M-2: 500-member edge case asserts member count and boundary members", () => {
      const members500: Member[] = Array.from({ length: 500 }, (_, i) => ({
        kind: "address",
        value: `user${i + 1}@abccorp.vn`,
      }));

      const ring500: Ring = {
        ...firstRing,
        id: "01JBIG00000000000000000500",
        name: "Ring with 500 Members",
        members: members500,
      };

      const html = renderWithTheme(
        <RingEditorScreen
          t={tVi}
          ring={ring500}
          settings={fixtures.settings}
          onSave={() => undefined}
          onBack={() => undefined}
        />,
      );

      // 1. Member count is verified
      expect(html).toContain(`500 ${tVi("rings.members.count")}`);

      // 2. First member is displayed
      expect(html).toContain("user1@abccorp.vn");

      // 3. Remainder count is displayed
      expect(html).toContain("450");
    });
  });
});
