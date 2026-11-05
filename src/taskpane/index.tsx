import { createRoot } from "react-dom/client";
import type { Language } from "@smr/core";
import { App } from "./App";
import type { ScreenId } from "./types";

const ALLOWED_SCREENS: readonly ScreenId[] = [
  "rings",
  "editor",
  "settings",
  "compose",
  "ack",
  "share",
  "import",
];
const ALLOWED_LANGUAGES: readonly Language[] = ["vi", "en"];

const rootElement = document.getElementById("root");
if (rootElement) {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const rawScreen = params?.get("screen");
  const rawLang = params?.get("lang");
  const initialScreen = ALLOWED_SCREENS.includes(rawScreen as ScreenId)
    ? (rawScreen as ScreenId)
    : undefined;
  const initialLanguage = ALLOWED_LANGUAGES.includes(rawLang as Language)
    ? (rawLang as Language)
    : undefined;

  const root = createRoot(rootElement);
  root.render(<App initialScreen={initialScreen} initialLanguage={initialLanguage} />);
}
