// The core UI code uses: real functions where they exist, the fixture stub for the rest.
import { createCore, type CoreApi } from "@smr/core";
import { stubCore } from "./stubCore";

export const core: CoreApi = createCore({ fallback: stubCore });
