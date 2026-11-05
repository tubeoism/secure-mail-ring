import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fixtures } from "../shared/contracts";
import { getTranslator } from "../taskpane/i18n";
import { renderApp } from "./renderApp";

// Worked example of the pattern for component tests (CL-14): render the real `App`, find controls
// by role and accessible name, act through `userEvent`, assert what the user would see.
const vi = getTranslator("vi");
const en = getTranslator("en");
const firstRing = fixtures.rings[0];
if (!firstRing) throw new Error("fixtures.rings is empty");

describe("task pane wiring (example for CL-14)", () => {
  it("starts on the ring list and lists the fixture rings", () => {
    renderApp();
    expect(screen.getByRole("tab", { name: new RegExp(vi("nav.rings")) }).ariaSelected).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: firstRing.name })).toBeTruthy();
  });

  it("opens the editor when a ring is clicked", async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole("button", { name: firstRing.name }));
    expect(screen.getByText(vi("editor.title"))).toBeTruthy();
  });

  it("opens the editor from the keyboard with Enter on a focused ring", async () => {
    const { user } = renderApp();
    // Tab order cannot be tested here: Fluent UI's Tabster takes over Tab and treats every element
    // as hidden because jsdom has no layout, so focus falls to <body>. Focus is set directly; the
    // order of the tab stops stays a real-browser check (docs/tasks/CL-14.md, edge cases).
    screen.getByRole("button", { name: firstRing.name }).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByText(vi("editor.title"))).toBeTruthy();
  });

  it("switches the language with the real control and back", async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole("button", { name: vi("settings.language") }));
    expect(screen.getByRole("tab", { name: new RegExp(en("nav.rings")) })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: en("settings.language") }));
    expect(screen.getByRole("tab", { name: new RegExp(vi("nav.rings")) })).toBeTruthy();
  });
});
