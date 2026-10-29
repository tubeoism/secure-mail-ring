// Single import surface for app code (Antigravity): `import { ... } from "../shared/contracts"`.
export * from "@smr/core";
export type * from "./adapters";
export { I18N_KEYS, type I18nKey } from "./i18nKeys";
export { stubCore } from "./stubCore";
export {
  MockOfficeAdapter,
  type MockCall,
  type MockOfficeOptions,
} from "../office/MockOfficeAdapter";
export { MockStorageAdapter, DEFAULT_BUDGET_BYTES } from "../storage/MockStorageAdapter";
export { createTranslator, type Catalog, type Translator } from "../i18n/translator";
export * as fixtures from "./fixtures";
