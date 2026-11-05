import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fixtures } from "../../shared/contracts";
import type { Language, Member, Ring } from "@smr/core";
import { getTranslator } from "../i18n";
import { App } from "../App";
import { renderApp } from "../../test-setup/renderApp";
import { RingsScreen } from "../screens/RingsScreen";
import { RingEditorScreen } from "../screens/RingEditorScreen";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";

const vi = getTranslator("vi");
const en = getTranslator("en");
const firstRing = fixtures.rings[0];
if (!firstRing) throw new Error("fixtures.rings is empty");

describe("Taskpane Interactive Behavior (Testing Library & userEvent)", () => {
  it("AC-1 / M-2: Reaches every screen from ring list in at most 2 clicks", async () => {
    const { user } = renderApp();

    // 1. Initial screen is Rings list
    expect(screen.getByRole("button", { name: firstRing.name })).toBeTruthy();

    // 2. Click 1: Reach Editor via clicking the ring
    await user.click(screen.getByRole("button", { name: firstRing.name }));
    expect(screen.getByText(vi("editor.title"))).toBeTruthy();

    // Return to rings list via Back button
    await user.click(screen.getByRole("button", { name: new RegExp(vi("common.back")) }));
    expect(screen.getByRole("button", { name: firstRing.name })).toBeTruthy();

    // 2b. Click 1: Reach Editor via clicking the '✏️ Chỉnh sửa' action button (kills RingsScreen.tsx:254 mutation)
    const editButtons = screen.getAllByRole("button", { name: new RegExp(vi("common.edit")) });
    const firstEditButton = editButtons[0];
    if (!firstEditButton) throw new Error("No edit buttons found");
    await user.click(firstEditButton);
    expect(screen.getByText(vi("editor.title"))).toBeTruthy();

    // Return to rings list via Back button
    await user.click(screen.getByRole("button", { name: new RegExp(vi("common.back")) }));
    expect(screen.getByRole("button", { name: firstRing.name })).toBeTruthy();

    // 3. Click 1: Reach Share screen via Share action button on ring
    const shareButtons = screen.getAllByRole("button", { name: new RegExp(vi("share.title")) });
    const firstShareButton = shareButtons[0];
    if (!firstShareButton) throw new Error("No share buttons found");
    await user.click(firstShareButton);
    expect(screen.getByText(vi("share.code"))).toBeTruthy();

    // Return to rings list via Back button
    await user.click(screen.getByRole("button", { name: new RegExp(vi("common.back")) }));
    expect(screen.getByRole("button", { name: firstRing.name })).toBeTruthy();

    // 4. Click 1: Reach Compose screen via NavBar tab
    await user.click(screen.getByRole("tab", { name: new RegExp(vi("nav.compose")) }));
    expect(screen.getByRole("button", { name: vi("compose.sort.now") })).toBeTruthy();

    // Return to rings list
    await user.click(screen.getByRole("tab", { name: new RegExp(vi("nav.rings")) }));
    expect(screen.getByRole("button", { name: firstRing.name })).toBeTruthy();

    // 5. Click 1: Reach Acknowledge screen via NavBar tab
    await user.click(screen.getByRole("tab", { name: new RegExp(vi("ack.title")) }));
    expect(screen.getByText(vi("ack.intro"))).toBeTruthy();

    // Return to rings list
    await user.click(screen.getByRole("tab", { name: new RegExp(vi("nav.rings")) }));
    expect(screen.getByRole("button", { name: firstRing.name })).toBeTruthy();

    // 6. Click 1: Reach Import screen via NavBar tab
    await user.click(screen.getByRole("tab", { name: new RegExp(vi("nav.import")) }));
    expect(screen.getByText(vi("import.paste"))).toBeTruthy();

    // Return to rings list
    await user.click(screen.getByRole("tab", { name: new RegExp(vi("nav.rings")) }));
    expect(screen.getByRole("button", { name: firstRing.name })).toBeTruthy();

    // 7. Click 1: Reach Settings screen via NavBar tab
    await user.click(screen.getByRole("tab", { name: new RegExp(vi("nav.settings")) }));
    expect(screen.getByText(new RegExp(vi("settings.storage")))).toBeTruthy();

    // Return to rings list
    await user.click(screen.getByRole("tab", { name: new RegExp(vi("nav.rings")) }));
    expect(screen.getByRole("button", { name: firstRing.name })).toBeTruthy();
  });

  it("AC-4 / M-2: Enter and Space activate controls, and Escape closes screens", async () => {
    // 1. Enter key opens Editor from focused ring, Escape key closes it
    const { user } = renderApp();
    const ringButton = screen.getByRole("button", { name: firstRing.name });
    ringButton.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByText(vi("editor.title"))).toBeTruthy();

    // Focus an element inside editor and press Escape
    screen.getByRole("button", { name: new RegExp(vi("common.back")) }).focus();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: firstRing.name })).toBeTruthy();

    // 2. Space key opens Editor from focused ring, Escape key closes it
    screen.getByRole("button", { name: firstRing.name }).focus();
    await user.keyboard(" ");
    expect(screen.getByText(vi("editor.title"))).toBeTruthy();

    screen.getByRole("button", { name: new RegExp(vi("common.back")) }).focus();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: firstRing.name })).toBeTruthy();

    // 3. Escape key closes ShareScreen
    const shareButtons = screen.getAllByRole("button", { name: new RegExp(vi("share.title")) });
    const firstShareButton = shareButtons[0];
    if (!firstShareButton) throw new Error("No share buttons found");
    await user.click(firstShareButton);
    expect(screen.getByText(vi("share.code"))).toBeTruthy();

    screen.getByRole("button", { name: new RegExp(vi("common.back")) }).focus();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: firstRing.name })).toBeTruthy();

    // 4. Escape key closes ImportScreen
    await user.click(screen.getByRole("tab", { name: new RegExp(vi("nav.import")) }));
    expect(screen.getByText(vi("import.paste"))).toBeTruthy();

    screen.getByRole("textbox").focus();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: firstRing.name })).toBeTruthy();
  });

  it("M-2 / AC-5: Switching vi -> en -> vi dynamically updates visible text on multiple screens with no raw keys", async () => {
    const { user } = renderApp({ screen: "settings" });

    // Initial language is Vietnamese
    expect(screen.getByRole("tab", { name: new RegExp(vi("nav.rings")) })).toBeTruthy();
    expect(screen.getByText(vi("settings.title"))).toBeTruthy();

    // Switch to English with real language button
    await user.click(screen.getByRole("button", { name: vi("settings.language") }));
    expect(screen.getByRole("tab", { name: new RegExp(en("nav.rings")) })).toBeTruthy();
    expect(screen.getAllByText(en("settings.title")).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(new RegExp(en("settings.storage")))).toBeTruthy();

    // Switch back to Vietnamese
    await user.click(screen.getByRole("button", { name: en("settings.language") }));
    expect(screen.getByRole("tab", { name: new RegExp(vi("nav.rings")) })).toBeTruthy();
    expect(screen.getByText(vi("settings.title"))).toBeTruthy();

    // Verify no raw key exists anywhere in visible document
    const rawKeyRegex =
      /\b(app|nav|common|rings|editor|policy|finding|compose|ack|settings|share|import|error)\.[a-z0-9.]+\b/;
    expect(document.body.textContent).not.toMatch(rawKeyRegex);
  });

  it("M-2: Edge case: 80-char ring name and long Vietnamese text keeps action buttons in document", () => {
    const longNameRing: Ring = {
      ...firstRing,
      id: "01JLONGNAME0000000000000000",
      name: "VongGuiThuBaoMatChuyenDungChoDuAnQuanTrongCuaToChucVaDoiTacChienLuoc20261105ABCD",
      subjectTag:
        "[DỰ ÁN BẢO MẬT THÔNG TIN VÀ AN TOÀN TRUYỀN THÔNG NỘI BỘ VĂN PHÒNG CHÍNH PHỦ VÀ TẬP ĐOÀN ĐỐI TÁC CHIẾN LƯỢC]",
    };

    render(
      <FluentProvider theme={webLightTheme}>
        <RingsScreen
          t={vi}
          rings={[longNameRing]}
          onSelectRing={() => undefined}
          onNavigate={() => undefined}
          onDuplicateRing={() => undefined}
          onDeleteRing={() => undefined}
          onCreateNewRing={() => undefined}
        />
      </FluentProvider>,
    );

    // Long name and subject tag are rendered
    expect(screen.getByText(longNameRing.name)).toBeTruthy();
    expect(screen.getByText(longNameRing.subjectTag)).toBeTruthy();

    // All action buttons remain accessible in the document
    expect(screen.getByRole("button", { name: new RegExp(vi("common.edit")) })).toBeTruthy();
    expect(screen.getByRole("button", { name: new RegExp(vi("share.title")) })).toBeTruthy();
    expect(screen.getByRole("button", { name: new RegExp(vi("common.duplicate")) })).toBeTruthy();
    expect(screen.getByRole("button", { name: new RegExp(vi("common.delete")) })).toBeTruthy();
  });

  it("M-2: 500-member edge case asserts member count, boundary members, and remainder", () => {
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

    render(
      <FluentProvider theme={webLightTheme}>
        <RingEditorScreen
          t={vi}
          ring={ring500}
          settings={fixtures.settings}
          onSave={() => undefined}
          onBack={() => undefined}
        />
      </FluentProvider>,
    );

    // 1. Member count is verified
    expect(screen.getByText(`500 ${vi("rings.members.count")}`)).toBeTruthy();

    // 2. First boundary member is displayed
    expect(screen.getByText("user1@abccorp.vn")).toBeTruthy();

    // 3. 50th boundary member is displayed
    expect(screen.getByText("user50@abccorp.vn")).toBeTruthy();

    // 4. 51st member is NOT rendered (hidden behind remainder)
    expect(screen.queryByText("user51@abccorp.vn")).toBeNull();

    // 5. Exact remainder text (450) is displayed
    expect(screen.getByText(/450 thành viên khác/)).toBeTruthy();
  });

  it("M-3: Editor Members tab contains accessible kind selector, value input, and add button", () => {
    render(
      <FluentProvider theme={webLightTheme}>
        <RingEditorScreen
          t={vi}
          ring={firstRing}
          settings={fixtures.settings}
          onSave={() => undefined}
          onBack={() => undefined}
        />
      </FluentProvider>,
    );

    // Kind select, value input, and add button are all present and accessible
    expect(screen.getByRole("combobox", { name: vi("editor.tab.members") })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: vi("editor.member.value") })).toBeTruthy();
    expect(screen.getByRole("button", { name: vi("editor.member.add") })).toBeTruthy();
  });

  it("Fallback behaviour: untrusted ?screen query param strictly falls back to 'rings'", () => {
    // Untrusted ?screen falls back to 'rings' (kills App.tsx screen allow-list mutation)
    renderApp({ screen: "untrusted_malicious_screen_xyz" });
    expect(screen.getByRole("button", { name: firstRing.name })).toBeTruthy();
  });

  it("Fallback behaviour: untrusted ?lang query param strictly falls back to 'vi'", () => {
    // Untrusted lang prop or query param falls back to 'vi' (kills App.tsx lang allow-list mutation)
    render(<App initialLanguage={"untrusted_lang" as unknown as Language} />);
    // Language button in header displays "VI" and tab list displays Vietnamese rings title
    expect(screen.getByRole("button", { name: vi("settings.language") }).textContent).toBe("VI");
    expect(screen.getByRole("tab", { name: new RegExp(vi("nav.rings")) })).toBeTruthy();
  });
});
