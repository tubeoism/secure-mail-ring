import type { Language } from "@smr/core";

export type ScreenId = "rings" | "editor" | "settings" | "compose" | "ack" | "share" | "import";

export interface AppNotification {
  type: "info" | "success" | "warning" | "error";
  message: string;
}

export interface AppNavProps {
  currentScreen: ScreenId;
  onNavigate: (screen: ScreenId, ringId?: string) => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
}
