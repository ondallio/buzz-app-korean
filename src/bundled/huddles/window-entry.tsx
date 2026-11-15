import { AgentAvatarArtworkProvider } from "../../features/agents/AgentAvatarArtworkProvider";
import "../../shared/styles/globals.css";
import "@fontsource-variable/inter/wght.css";
import { ToastProvider } from "../../shared/design-system/ui/Toast";
import { TooltipProvider } from "../../shared/design-system/ui/Tooltip";
import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { Channel, invoke } from "@tauri-apps/api/core";
import type { HuddleAction, HuddleView } from "../../features/huddle/window";
import { HuddleWindowView } from "./HuddleWindowView";
import { useKeyboardFocusVisibility } from "../../shared/design-system/useKeyboardFocusVisibility";
import { clearReactDevMeasures } from "../../features/developer/react-dev-timing";
import { t, translate, useLanguage } from "../../shared/i18n";
import { initializeHostLanguage } from "../../shared/i18n/host-language";
import { useLanguageDocument } from "../../shared/i18n/document";
import { DialogLabelsProvider } from "../../shared/design-system/ui/DialogLabels";

// React dev builds otherwise fill the User Timing buffer without limit.
if (import.meta.env.DEV) clearReactDevMeasures();

function Companion() {
  const language = useLanguage();
  useLanguageDocument();
  useEffect(() => {
    document.title = translate(language, "huddleCompanion.title");
  }, [language]);
  useKeyboardFocusVisibility();
  const [view, setView] = useState<HuddleView>();
  const [problem, setError] = useState<"unavailable" | "actionFailed">();
  const error = problem ? t(`huddleCompanion.${problem}`) : undefined;
  useEffect(() => {
    let mounted = true;
    const updates = new Channel<HuddleView & { discussionOpen: boolean }>();
    updates.onmessage = (next) => {
      if (!mounted) return;
      document.documentElement.classList.toggle("dark", next.dark);
      setView((previous) => ({
        ...next,
        discussion: next.discussionOpen
          ? (next.discussion ??
            (previous?.id === next.id ? previous.discussion : undefined))
          : undefined,
      }));
    };
    void invoke("huddle_window_watch", { updates }).catch(() => {
      if (mounted) setError("unavailable");
    });
    return () => {
      mounted = false;
    };
  }, []);
  const act = (action: HuddleAction, text?: string) => {
    if (!view) return;
    setError(undefined);
    void invoke("huddle_window_action", { id: view.id, action, text }).catch(
      () => setError("actionFailed"),
    );
  };
  return view ? (
    <ToastProvider
      labels={{ region: t("toast.region"), dismiss: t("toast.dismiss") }}
    >
      <DialogLabelsProvider closeLabel={t("dialog.close")}>
        <HuddleWindowView
          view={view}
          act={act}
          error={error}
          errorIdentity={problem}
        />
      </DialogLabelsProvider>
    </ToastProvider>
  ) : error ? (
    <p role="alert" className="p-6 text-body text-secondary">
      {error}
    </p>
  ) : null;
}
const container = document.getElementById("root");
if (container) {
  container.style.height = "100dvh";
  void initializeHostLanguage().then(() => {
    createRoot(container).render(
      <AgentAvatarArtworkProvider>
        <TooltipProvider>
          <Companion />
        </TooltipProvider>
      </AgentAvatarArtworkProvider>,
    );
  });
}
