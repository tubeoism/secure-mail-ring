import type { Language } from "@smr/core";
import { createTranslator, type Catalog, type I18nKey, type Translator } from "../shared/contracts";
import enCatalog from "../shared/i18n/locales/en.json";
import viCatalog from "../shared/i18n/locales/vi.json";

const catalogs: Record<Language, Catalog> = {
  vi: viCatalog as Record<I18nKey, string>,
  en: enCatalog as Record<I18nKey, string>,
};

export function getTranslator(lang: Language): Translator {
  return createTranslator(lang, catalogs);
}
