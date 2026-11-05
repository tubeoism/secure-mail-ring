import { createRoot } from "react-dom/client";
import type { Language } from "@smr/core";
import { App } from "./App";
import type { ScreenId } from "./types";

const rootElement = document.getElementById("root");
if (rootElement) {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const initialScreen = params?.get("screen") as ScreenId | undefined;
  const initialLanguage = params?.get("lang") as Language | undefined;

  const root = createRoot(rootElement);
  root.render(<App initialScreen={initialScreen} initialLanguage={initialLanguage} />);
}
