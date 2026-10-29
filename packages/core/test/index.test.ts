import { describe, expect, it } from "vitest";
import { CORE_PACKAGE } from "../src/index";

describe("@smr/core scaffold", () => {
  it("exposes the package name", () => {
    expect(CORE_PACKAGE).toBe("@smr/core");
  });
});
