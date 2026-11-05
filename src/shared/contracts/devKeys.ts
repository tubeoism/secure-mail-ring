// Development and test keys for the share-code codec (contract-v2). THESE ARE NOT SECRETS: the
// bytes are fixed and public, so that the dev server, the mocks and the tests can run the real
// codec and round-trip a ring in a plain browser. The production add-in builds its keys from the
// organisation secret and the licence result (`createLicensedKeyProvider`) and never uses these.
import { keyIdOf, type KeyMaterial, type KeyProvider } from "@smr/core";

const DEV_SECRET = Uint8Array.from({ length: 32 }, (_, i) => (i * 11 + 5) & 255);
const DEV_KEY: KeyMaterial = { keyId: keyIdOf(DEV_SECRET), secret: DEV_SECRET };

export const devKeys: KeyProvider = {
  current: () => DEV_KEY,
  byId: (keyId) => (keyId === DEV_KEY.keyId ? DEV_KEY : null),
};

/** A second key that the dev keys do not know: codes made with it must fail to decode. */
const FOREIGN_SECRET = Uint8Array.from({ length: 32 }, (_, i) => (i * 7 + 1) & 255);
const FOREIGN_KEY: KeyMaterial = { keyId: keyIdOf(FOREIGN_SECRET), secret: FOREIGN_SECRET };
export const foreignDevKeys: KeyProvider = {
  current: () => FOREIGN_KEY,
  byId: (keyId) => (keyId === FOREIGN_KEY.keyId ? FOREIGN_KEY : null),
};
