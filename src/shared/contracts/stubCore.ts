// The stub core wired to the fixtures: what UI code uses until CL-03 to CL-05 land.
import { createStubCore, type CoreApi } from "@smr/core";
import { compose, evaluations, shareCodes } from "./fixtures";

export const stubCore: CoreApi = createStubCore({
  evaluations: evaluations.flatMap((e) => {
    const c = compose.find((x) => x.name === e.compose);
    return c ? [{ snapshot: c.snapshot, result: e.result }] : [];
  }),
  shareCodes,
});
