// The core UI code uses: real functions where they exist, the fixture stub for the rest. The share-code
// codec is real too (contract-v2) and runs on the public development keys, so the export and import
// screens can round-trip a ring in a plain browser. Production builds their own keys.
import { createCore, type CoreApi } from "@smr/core";
import { devKeys } from "./devKeys";
import { stubCore } from "./stubCore";

export const core: CoreApi = createCore({ fallback: stubCore, keys: devKeys });
