/**
 * Lightweight userEvent helper for interactive component testing
 * without third-party DOM dependencies.
 */
export const userEvent = {
  click: async (
    target:
      | { onClick?: (e?: unknown) => void; props?: { onClick?: (e?: unknown) => void } }
      | (() => void),
  ) => {
    if (typeof target === "function") {
      target();
      return;
    }
    const event = { preventDefault: () => {}, stopPropagation: () => {} };
    if (typeof target.onClick === "function") {
      target.onClick(event);
    } else if (target.props && typeof target.props.onClick === "function") {
      target.props.onClick(event);
    }
  },

  keyboard: async (
    key: string,
    target?: {
      onKeyDown?: (e: { key: string; preventDefault: () => void }) => void;
      props?: { onKeyDown?: (e: { key: string; preventDefault: () => void }) => void };
    },
  ) => {
    const event = { key, preventDefault: () => {} };
    if (target && typeof target.onKeyDown === "function") {
      target.onKeyDown(event);
    } else if (target?.props && typeof target.props.onKeyDown === "function") {
      target.props.onKeyDown(event);
    }
  },

  tab: async () => {
    // Focus progression simulation
  },
};
