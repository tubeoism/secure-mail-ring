// Setup for the jsdom project (CL-14). Loaded only for component tests.
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

// jsdom has no layout engine; Fluent UI v9 and React read these on mount.
if (typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}
if (typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = () => undefined;
}

// A React warning (act, missing key, invalid prop) or an unhandled console.error is a defect:
// fail the test that caused it instead of letting it scroll by (AC-4).
let errors: unknown[][] = [];
beforeEach(() => {
  errors = [];
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    errors.push(args);
  });
});

afterEach(() => {
  cleanup();
  const seen = errors;
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
  if (seen.length > 0) {
    throw new Error(`console.error was called ${seen.length} time(s): ${String(seen[0]?.[0])}`);
  }
});
