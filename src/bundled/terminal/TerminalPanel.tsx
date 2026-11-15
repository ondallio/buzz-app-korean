import { t, useLanguage } from "../../shared/i18n";
import {
  CaretDownIcon,
  StopIcon,
  ArrowsClockwiseIcon,
  TerminalWindowIcon,
} from "../../shared/design-system/icons/index";
import { Button } from "../../shared/design-system/ui/Button";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import {
  PanelHeader,
  PanelHeaderLabel,
} from "../../shared/design-system/ui/PanelHeader";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type {
  PanelProps,
  ChannelPanelContext,
} from "../../features/panels/service";
import type { TerminalSessions } from "./sessions";
import styles from "./Terminal.module.css";

export function TerminalPanel({
  channelContext,
  close,
  sessions,
}: PanelProps & { sessions: TerminalSessions }) {
  if (!channelContext) throw new Error("Terminal requires a channel context");
  return <Content context={channelContext} close={close} sessions={sessions} />;
}
function Content({
  context,
  close,
  sessions,
}: {
  context: ChannelPanelContext;
  close(): void;
  sessions: TerminalSessions;
}) {
  useLanguage();
  const version = useSyncExternalStore(
    sessions.subscribe,
    sessions.snapshot,
    sessions.snapshot,
  );
  const entry = sessions.get(context);
  const host = useRef<HTMLDivElement>(null);
  const hide = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const attempted = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    try {
      sessions.ensure(context, true);
    } catch (error) {
      setError(String(error));
    }
  }, [context, sessions]);
  useEffect(() => {
    if (entry?.screen && host.current) return entry.screen.mount(host.current);
  }, [entry?.screen]);
  const end = async (restart: boolean) => {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await sessions.end(context);
      if (restart && mounted.current) sessions.ensure(context);
    } catch (error) {
      if (mounted.current) setError(String(error));
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <div
      data-buzz-ui=""
      className={styles.panel}
      data-terminal-version={version}
    >
      <PanelHeader
        title={
          <PanelHeaderLabel
            title="BuzzTerm"
            icon={<TerminalWindowIcon size="1rem" />}
          >
            <div className={styles.identity}>
              <span
                className="text-body-sm text-secondary"
                title={entry?.context.channelId ?? context.channelId}
              >
                #{entry?.context.channelName ?? context.channelName}
              </span>
              {entry?.context.threadId && (
                <span
                  className="text-mono-sm text-secondary font-mono"
                  title={entry.context.threadId}
                >
                  {t("v1shell.terminal.thread", {
                    id: entry.context.threadId.slice(0, 8),
                  })}
                </span>
              )}
              <span className="text-body-sm text-secondary">
                {t(
                  entry
                    ? (
                        {
                          starting: "v1shell.terminal.status.starting",
                          running: "v1shell.terminal.status.running",
                          exited: "v1shell.terminal.status.exited",
                          error: "v1shell.terminal.status.error",
                          ended: "v1shell.terminal.status.ended",
                        } as const
                      )[entry.status]
                    : sessions.available
                      ? "v1shell.terminal.status.ended"
                      : "v1shell.terminal.status.desktopOnly",
                )}
              </span>
            </div>
          </PanelHeaderLabel>
        }
        actions={
          <>
            {sessions.available &&
              (entry ? (
                <IconButton
                  size="toolbar"
                  disabled={busy}
                  onClick={() => void end(true)}
                  aria-label={t("v1shell.terminal.restart")}
                  title={t("v1shell.terminal.restartTitle")}
                  icon={<ArrowsClockwiseIcon size={16} aria-hidden="true" />}
                />
              ) : (
                <Button
                  size="compact"
                  disabled={busy}
                  onClick={() => void end(true)}
                >
                  {t("v1shell.terminal.start")}
                </Button>
              ))}
            {entry && (
              <IconButton
                size="toolbar"
                disabled={busy}
                onClick={(event) => {
                  // Move focus before End removes/disables its own control.
                  // No post-await focus change can steal a later destination.
                  if (document.activeElement === event.currentTarget)
                    hide.current?.focus();
                  void end(false);
                }}
                aria-label={t("v1shell.terminal.end")}
                title={t("v1shell.terminal.end")}
                icon={<StopIcon size={16} aria-hidden="true" />}
              />
            )}
            <IconButton
              hint="familiar"
              size="toolbar"
              ref={hide}
              onClick={close}
              aria-label={t("v1shell.terminal.hide")}
              title={t("v1shell.terminal.hideTitle")}
              icon={<CaretDownIcon size={16} aria-hidden="true" />}
            />
          </>
        }
      />
      {!sessions.available ? (
        <p className={`${styles.notice} text-body`}>
          {t("v1shell.terminal.desktopOnly")}
        </p>
      ) : (
        <>
          {(error || entry?.error) && (
            <p
              className={`${styles.notice} text-body text-danger`}
              role="alert"
            >
              {error ?? entry?.error}
            </p>
          )}
          {entry?.status === "starting" && (
            <p className={`${styles.notice} text-body`} role="status">
              {t("v1shell.terminal.starting")}
            </p>
          )}
          {!entry && (
            <p className={`${styles.notice} text-body`}>
              {t("v1shell.terminal.ended")}
            </p>
          )}
          {/* Escape belongs to the shell while its input has focus. */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: contains the terminal's native keyboard input. */}
          <div
            className={styles.screen}
            ref={host}
            onKeyDown={(event) => {
              if (event.key === "Escape") event.stopPropagation();
            }}
          />
        </>
      )}
    </div>
  );
}
