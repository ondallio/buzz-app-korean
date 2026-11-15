import { t, useLanguage } from "../shared/i18n";
import {
  localMessage,
  resolveMessage,
  type DisplayMessage,
} from "../shared/i18n/deferred-message";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AlertDialog } from "../shared/design-system/ui/AlertDialog";
import { Button } from "../shared/design-system/ui/Button";
import { Dialog } from "../shared/design-system/ui/Dialog";
import { InlineHeader } from "../shared/design-system/ui/Header";
import { PreferenceRow } from "../shared/design-system/ui/PreferenceRow";
import { SettingsGroup } from "../shared/design-system/ui/SettingsGroup";
import type { PluginManager } from "../plugins/manager";
import type { PluginRequest } from "../plugins/requests";
import type { Catalog } from "../plugins/types";
import { ManagedPluginReview } from "./ManagedPlugins";
import { PluginAccessReview } from "./PluginAccessReview";
import styles from "./Settings.module.css";

type Authorize = NonNullable<
  Parameters<typeof ManagedPluginReview>[0]["authorizeGit"]
>;

/** Formats an app-owned request title while preserving the plugin's authored name. */
export function requestTitle(
  request: Pick<PluginRequest, "action" | "pluginName">,
) {
  const keys = {
    install: "pluginRequests.installTitle",
    update: "pluginRequests.updateTitle",
    enable: "pluginRequests.enableTitle",
    remove: "pluginRequests.deleteTitle",
  } as const;
  return t(keys[request.action], { name: request.pluginName });
}

/** Plugin changes agents asked for. Each applies only through the same
 * review a person's own install uses. */
export function AgentPluginRequests({
  plugins,
  catalog,
  busy,
  authorizeGit,
  holdReview,
  fallbackFocus,
}: {
  plugins: PluginManager;
  catalog: Catalog;
  busy: boolean;
  authorizeGit?: Authorize | undefined;
  /** Refuses plugin install requests while a review is open. */
  holdReview?: (() => () => void) | undefined;
  /** Where focus goes once no request remains. */
  fallbackFocus?: (() => HTMLElement | null) | undefined;
}) {
  useLanguage();
  const { requests } = plugins;
  const pending = useSyncExternalStore(requests.subscribe, requests.pending);
  // Held, not looked up, so settling the request never remounts the review.
  const [reviewing, setReviewing] = useState<PluginRequest>();
  const trigger = useRef<HTMLElement | null>(null);
  const section = useRef<HTMLElement>(null);
  // A settled request's buttons are gone, so focus moves to what survives.
  const survivor = () =>
    (requests.pending().length ? section.current : fallbackFocus?.()) ?? null;
  // The request the owner approved removes its Review button; when focus fell
  // with it, move it to what survives.
  // biome-ignore lint/correctness/useExhaustiveDependencies: it runs when the pending requests change.
  useEffect(() => {
    if (!trigger.current || trigger.current.isConnected) return;
    trigger.current = null;
    if (document.activeElement === document.body) survivor()?.focus();
  }, [pending]);
  const review = reviewing && (
    <RequestReview
      plugins={plugins}
      catalog={catalog}
      busy={busy}
      request={reviewing}
      authorizeGit={authorizeGit}
      holdReview={holdReview}
      returnFocus={() =>
        requests.pending().includes(reviewing) ? trigger.current : survivor()
      }
      onClose={() => setReviewing(undefined)}
    />
  );
  return (
    <>
      {pending.length > 0 && (
        <section
          ref={section}
          tabIndex={-1}
          aria-labelledby="agent-plugin-requests-title"
          className={styles.pluginCoreSection}
        >
          <InlineHeader
            id="agent-plugin-requests-title"
            title={t("pluginRequests.requestedByAgents")}
          />
          <SettingsGroup>
            {pending.map((request) => (
              <PreferenceRow
                key={request.id}
                title={requestTitle(request)}
                subtitle={t("pluginRequests.requestReason", {
                  requester: request.requester.name,
                  reason: request.reason,
                })}
                trailing={
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="subtle"
                      aria-label={t("pluginRequests.declineNamed", {
                        name: request.pluginName,
                      })}
                      onClick={() => {
                        requests.settle(request.id, "declined");
                        survivor()?.focus();
                      }}
                    >
                      {t("pluginRequests.decline")}
                    </Button>
                    <Button
                      size="sm"
                      variant="prominent"
                      disabled={busy}
                      aria-label={t("pluginRequests.reviewNamed", {
                        name: request.pluginName,
                      })}
                      onClick={(event) => {
                        trigger.current = event.currentTarget;
                        setReviewing(request);
                      }}
                    >
                      {t("pluginRequests.review")}
                    </Button>
                  </div>
                }
              />
            ))}
          </SettingsGroup>
        </section>
      )}
      {review}
    </>
  );
}

/** The review an agent's request needs: an install or update shows the
 * pinned commit's access as an import does; enable and remove confirm
 * directly. Applying the change settles the request. */
export function RequestReview({
  plugins,
  catalog,
  busy,
  request,
  authorizeGit,
  holdReview,
  returnFocus,
  onClose,
}: {
  plugins: PluginManager;
  catalog: Catalog;
  busy: boolean;
  request: PluginRequest;
  authorizeGit?: Authorize | undefined;
  /** Refuses plugin install requests while a review is open. */
  holdReview?: (() => () => void) | undefined;
  returnFocus: () => HTMLElement | null;
  onClose: () => void;
}) {
  return !request.source ? (
    <ChangeReview
      plugins={plugins}
      catalog={catalog}
      request={request}
      holdReview={holdReview}
      returnFocus={returnFocus}
      onClose={onClose}
    />
  ) : (
    <ManagedPluginReview
      plugins={plugins}
      catalog={catalog}
      busy={busy}
      source={request.requester.name}
      entry={{
        id: request.pluginId,
        ...request.source,
        state: request.action === "install" ? "missing" : "outdated",
      }}
      authorizeGit={authorizeGit}
      holdReview={holdReview}
      requestedBy={{
        name: request.requester.name,
        reason: request.reason,
      }}
      recheck={() => plugins.requests.conflict(request.pluginId)}
      returnFocus={returnFocus}
      onInstalled={() => plugins.requests.settle(request.id, "approved")}
      onClose={onClose}
    />
  );
}

/** Enable and remove change no code, so they confirm here rather than
 * through an import review. */
function ChangeReview({
  plugins,
  catalog,
  request,
  holdReview,
  returnFocus,
  onClose,
}: {
  plugins: PluginManager;
  catalog: Catalog;
  request: PluginRequest;
  holdReview?: (() => () => void) | undefined;
  returnFocus: () => HTMLElement | null;
  onClose: () => void;
}) {
  useLanguage();
  useEffect(() => holdReview?.(), [holdReview]);
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<DisplayMessage | null>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const plugin = catalog.plugins.find(
    (item) => item.manifest.id === request.pluginId,
  );
  const name = plugin?.manifest.name ?? request.pluginName;
  const { action } = request;
  async function confirm() {
    if (working || (action !== "enable" && action !== "remove")) return;
    setWorking(true);
    setFailure(null);
    try {
      if (await plugins.change(action, request.pluginId)) {
        plugins.requests.settle(request.id, "approved");
        onClose();
      } else
        setFailure(
          plugins.snapshot().error ??
            localMessage("pluginRequests.changeUnconfirmed"),
        );
    } finally {
      setWorking(false);
    }
  }
  const body = (
    <>
      <p className="mb-4 mt-0 break-words text-body-sm">{request.reason}</p>
      {!plugin && (
        <p className="m-0 text-body-sm">
          {t("pluginRequests.noLongerInstalled")}
        </p>
      )}
      {failure && (
        <p role="alert" className="error text-body-sm">
          {resolveMessage(failure)}
        </p>
      )}
    </>
  );
  if (action === "remove")
    return (
      <AlertDialog
        title={t("pluginRequests.deleteConfirmTitle", { name })}
        description={t("pluginRequests.deleteRequestDescription", {
          requester: request.requester.name,
        })}
        pending={working}
        initialFocus={cancel}
        finalFocus={returnFocus}
        onClose={onClose}
        actions={
          <>
            <Button ref={cancel} disabled={working} onClick={onClose}>
              {t("pluginRequests.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={working || !plugin}
              onClick={() => void confirm()}
            >
              {t("pluginRequests.deletePlugin")}
            </Button>
          </>
        }
      >
        {body}
      </AlertDialog>
    );
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={t("pluginRequests.enableConfirmTitle", { name })}
      description={t("pluginRequests.enableRequestDescription", {
        requester: request.requester.name,
      })}
      preventClose={working}
      dismissOnOutsideClick
      initialFocus={cancel}
      finalFocus={returnFocus}
      actions={
        <>
          <Button ref={cancel} disabled={working} onClick={onClose}>
            {t("pluginRequests.cancel")}
          </Button>
          <Button
            variant="prominent"
            disabled={working || !plugin}
            loading={working}
            onClick={() => void confirm()}
          >
            {t("pluginRequests.enablePlugin")}
          </Button>
        </>
      }
    >
      {body}
      {plugin && <PluginAccessReview manifest={plugin.manifest} />}
    </Dialog>
  );
}
