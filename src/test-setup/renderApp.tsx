import { render, type RenderResult } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { App } from "../taskpane/App";

export interface RenderAppOptions {
  /** Value of the `?screen=` query parameter, as `index.tsx` receives it from the dev server. */
  readonly screen?: string;
}

/**
 * The single entry point for component tests (CL-14). `App` owns the Fluent provider, the mock
 * Office adapter and the mock storage, so tests render the same wiring that the dev server uses.
 * Use `screen` from Testing Library for queries: Fluent portals render outside the container.
 */
export function renderApp(options: RenderAppOptions = {}): RenderResult & { user: UserEvent } {
  const query = options.screen === undefined ? "" : `?screen=${encodeURIComponent(options.screen)}`;
  window.history.replaceState(null, "", `/${query}`);
  const user = userEvent.setup();
  return { ...render(<App />), user };
}
