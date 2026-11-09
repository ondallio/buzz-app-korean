// FOUNDATION: React startup. Keep initialization explicit and minimal.
// Establish host CSS layer order before product modules import component layers.
import "./shared/styles/globals.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createServices } from "./app/services";
import { loadAgentStorage } from "./features/agents/state";
import { App } from "./app/App";
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/inter/wght-italic.css";
import "@fontsource/jetbrains-mono/400.css";
import { useKeyboardFocusVisibility } from "./shared/design-system/useKeyboardFocusVisibility";
import { useRejectUnclaimedDrops } from "./features/messages/use-file-drop";
import { TooltipProvider } from "./shared/design-system/ui/Tooltip";
import { clearReactDevMeasures } from "./features/developer/react-dev-timing";
import { useLanguageDocument } from "./shared/i18n/document";
import { initializeHostLanguage } from "./shared/i18n/host-language";
import { LanguageProviders } from "./app/LanguageProviders";

// React dev builds otherwise fill the User Timing buffer without limit.
if (import.meta.env.DEV) clearReactDevMeasures();

const container = document.getElementById("root");

if (!container) {
  throw new Error('Missing <div id="root"> in index.html');
}

// Agent storage is read before any service, since its reads are synchronous.
// It settles, with localStorage at worst, so the window always starts.
void Promise.all([loadAgentStorage(), initializeHostLanguage()]).finally(() => {
  const services = createServices();
  const root = createRoot(container);
  function HostApp() {
    useLanguageDocument();
    useKeyboardFocusVisibility();
    useRejectUnclaimedDrops();
    return (
      <LanguageProviders>
        <TooltipProvider>
          <App services={services} />
        </TooltipProvider>
      </LanguageProviders>
    );
  }
  root.render(
    <StrictMode>
      <HostApp />
    </StrictMode>,
  );

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      root.unmount();
      void services.dispose().catch(console.error);
    });
  }
});
