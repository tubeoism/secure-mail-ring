// `t(key, params)` with compile-time key checking. Catalogs are injected so this module has
// no dependency on the locale files that Antigravity owns (AG-07). A key missing at runtime
// renders as the key itself, which is visible in review without breaking the screen.
import type { Language } from "@smr/core";
import type { I18nKey } from "../contracts/i18nKeys";

export type Catalog = Partial<Record<I18nKey, string>>;
export type Translator = (
  key: I18nKey,
  params?: Readonly<Record<string, string | number>>,
) => string;

export function createTranslator(
  language: Language,
  catalogs: Readonly<Partial<Record<Language, Catalog>>>,
): Translator {
  const catalog = catalogs[language] ?? {};
  return (key, params) => {
    const template = catalog[key];
    if (template === undefined) return key;
    return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
      const value = params?.[name];
      return value === undefined ? whole : String(value);
    });
  };
}
