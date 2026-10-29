// Smoke page for `npm run dev:taskpane` until AG-01 adds src/taskpane/index.tsx.
// It only proves that @smr/core, the mocks, fixtures and t() are importable in a browser.
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { createRoot } from "react-dom/client";
import { createTranslator, fixtures } from "../../src/shared/contracts";

const t = createTranslator("en", { en: { "rings.title": "Rings" } });

function App() {
  return (
    <FluentProvider theme={webLightTheme}>
      <h1>{t("rings.title")}</h1>
      <ul>
        {fixtures.rings.map((r) => (
          <li key={r.id}>{r.name}</li>
        ))}
      </ul>
    </FluentProvider>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
