import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { fixtures, MockOfficeAdapter } from "../../shared/contracts";
import { App } from "../App";
import { getTranslator } from "../i18n";
import { AcknowledgeScreen } from "../screens/AcknowledgeScreen";
import { ComposeScreen } from "../screens/ComposeScreen";
import { ImportScreen } from "../screens/ImportScreen";
import { RingEditorScreen } from "../screens/RingEditorScreen";
import { RingsScreen } from "../screens/RingsScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { ShareScreen } from "../screens/ShareScreen";

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
  });
});
