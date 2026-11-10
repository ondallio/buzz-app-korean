import { t, useLanguage } from "../../../shared/i18n";
import { rich } from "../../../shared/i18n/rich";
import { localError } from "../../../shared/i18n/deferred-message";
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { AgentViewProps } from "../../../features/agents/service";
import { AgentExecutionNote } from "../../../features/agents/AgentExecutionNote";
import { PreferenceRow } from "../../../shared/design-system/ui/PreferenceRow";
import { SettingsGroup } from "../../../shared/design-system/ui/SettingsGroup";
import inlineStyles from "../../../shared/InlineReference.module.css";
import type { AgentClient, RemoteAgent } from "../agents/client";
import type { BuilderlabSession } from "../session";
import { ModelSettings } from "./ModelSettings";

/** Hosted settings belong to Builderlab, rather than Agents' local config. */
export function createSettingsTab(
  client: AgentClient,
  session: BuilderlabSession,
  openIdentity?: () => void,
) {
  function Editor({
    pubkey,
    retry,
    harnessControl,
  }: {
    pubkey: string;
    retry(): void;
    harnessControl: (action: ReactNode) => ReactNode;
  }) {
    const login = useSyncExternalStore(session.subscribe, session.snapshot);
    const [loaded, setLoaded] = useState<{
      agent: RemoteAgent;
      subject: string;
      email: string;
    }>();
    const [busy, setBusy] = useState(true);
    const [error, setError] = useState<unknown>("");
    useEffect(() => {
      if (loaded || login.status !== "signed-in") return;
      setBusy(true);
      setError("");
      const current = new AbortController();
      const load = async () => {
        // Retire a discarded mount before starting host I/O.
        await Promise.resolve();
        current.signal.throwIfAborted();
        const credential = session.credential();
        const remote = (await client.list(current.signal)).find(
          (row) => row.pubkey === pubkey,
        );
        current.signal.throwIfAborted();
        if (session.credential() !== credential)
          throw new DOMException("Builderlab session changed.", "AbortError");
        if (!remote) throw localError("builderlabSettings.notFound");
        if (remote.status !== "Active")
          throw localError("builderlabSettings.activeOnly");
        setLoaded({
          agent: remote,
          subject: credential.account.subject,
          email: credential.account.email,
        });
      };
      void load()
        .catch((reason: unknown) => {
          if (!current.signal.aborted) setError(reason);
        })
        .finally(() => {
          if (!current.signal.aborted) setBusy(false);
        });
      return () => current.abort();
    }, [pubkey, login, loaded]);
    return (
      <ModelSettings
        client={client}
        session={session}
        openIdentity={openIdentity}
        settings={
          loaded ?? {
            pending: busy && login.status === "signed-in",
            error,
            retry,
          }
        }
        harnessControl={harnessControl}
      />
    );
  }
  return function Settings({
    agent,
    settingsSection,
    settingsContent,
    settingsHost,
  }: AgentViewProps) {
    useLanguage();
    const [revision, setRevision] = useState(0);
    const login = useSyncExternalStore(session.subscribe, session.snapshot);
    const signedIn = login.status === "signed-in";
    return (
      <div className="grid gap-4">
        {settingsSection !== "runtime" && signedIn && (
          <AgentExecutionNote runtime={agent.type} />
        )}
        {settingsSection !== "runtime" && (
          <Editor
            key={`${agent.pubkey}/${revision}`}
            pubkey={agent.pubkey}
            retry={() => setRevision((value) => value + 1)}
            harnessControl={(action) =>
              settingsHost?.typeControl?.(false, action)
            }
          />
        )}
        {settingsSection !== "identity" && (
          <>
            <SettingsGroup>
              <PreferenceRow
                title={t("builderlabSettings.runtime")}
                subtitle={rich("builderlabSettings.hostedBy", {
                  link: (
                    <a
                      className={inlineStyles.link}
                      href={import.meta.env.VITE_BUZZ_BUILDERLAB_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Builderlab
                    </a>
                  ),
                })}
              />
              {signedIn && (
                <PreferenceRow
                  title={t("builderlabSettings.workspace")}
                  subtitle={t("builderlabSettings.workspaceDescription")}
                />
              )}
              <PreferenceRow
                title={t("builderlabSettings.sessions")}
                subtitle={t("builderlabSettings.oneSession")}
              />
            </SettingsGroup>
            {settingsContent}
          </>
        )}
      </div>
    );
  };
}
