import { t, useLanguage } from "../../shared/i18n";
import { useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  ArrowsOutIcon,
  MinusIcon,
  XIcon,
} from "../../shared/design-system/icons";
import { IconButton } from "../../shared/design-system/ui/IconButton";

declare global {
  interface Window {
    /** Native document-start policy; absent in browser previews. */
    __BUZZ_WINDOW_CONTROLS__?: { minimize: boolean; maximize: boolean };
  }
}

export function hasIntegratedWindowControls() {
  return isTauri() && /^(Linux|Win)/i.test(navigator.platform);
}

/** App-owned chrome shared by the shell and pre-identity screen. */
export function WindowControls() {
  useLanguage();
  const [error, setError] = useState(false);
  if (!hasIntegratedWindowControls()) return null;
  const run = async (action: () => Promise<void>) => {
    setError(false);
    try {
      await action();
    } catch {
      setError(true);
    }
  };
  return (
    <fieldset
      className="flex shrink-0 items-center gap-1"
      aria-label={t("shell.window.label")}
    >
      {error && (
        <span role="alert" className="text-body-sm">
          {t("shell.window.failed")}
        </span>
      )}
      {window.__BUZZ_WINDOW_CONTROLS__?.minimize !== false && (
        <IconButton
          hint="familiar"
          aria-label={t("shell.window.minimize")}
          title={t("shell.window.minimize")}
          size="toolbar"
          icon={<MinusIcon size={16} />}
          onClick={() => void run(() => getCurrentWindow().minimize())}
        />
      )}
      {window.__BUZZ_WINDOW_CONTROLS__?.maximize !== false && (
        <IconButton
          hint="familiar"
          aria-label={t("shell.window.maximize")}
          title={t("shell.window.maximize")}
          size="toolbar"
          icon={<ArrowsOutIcon size={16} />}
          onClick={() => void run(() => getCurrentWindow().toggleMaximize())}
        />
      )}
      <IconButton
        hint="familiar"
        aria-label={t("shell.window.close")}
        title={t("shell.window.close")}
        size="toolbar"
        icon={<XIcon size={16} />}
        onClick={() => void run(() => getCurrentWindow().close())}
      />
    </fieldset>
  );
}
