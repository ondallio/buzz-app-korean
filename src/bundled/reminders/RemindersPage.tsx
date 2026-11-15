import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type Ref,
} from "react";
import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  motion,
  useIsPresent,
  useReducedMotion,
} from "motion/react";
import type { RelayData } from "../../features/relay/service";
import type { RelaySession } from "../../features/relay/session";
import type { Reminder, Reminders } from "../../features/relay/reminders";
import type { Navigation } from "../../features/navigation/controller";
import {
  useChannelList,
  useProfileGeneration,
} from "../../features/relay/react";
import { selectProfiles } from "../../features/relay/profile-selection";
import { useIdentityNames } from "../../features/identity-names/react";
import { messagePreview } from "../../features/notifications/content";
import { formatPublicKey } from "../../shared/identity/public-key";
import { relativeTimestamp } from "../../shared/relative-timestamp";
import {
  AlarmIcon,
  ArrowSquareOutIcon,
  CheckIcon,
  DotsThreeIcon,
  XIcon,
} from "../../shared/design-system/icons/index";
import { Accordion } from "../../shared/design-system/ui/Accordion";
import { Avatar } from "../../shared/design-system/ui/Avatar";
import { Button } from "../../shared/design-system/ui/Button";
import { Checkbox } from "../../shared/design-system/ui/Checkbox";
import { EmptyState } from "../../shared/design-system/ui/EmptyState";
import { FullPageSurface } from "../../shared/design-system/ui/FullPageSurface";
import { InlineHeader } from "../../shared/design-system/ui/Header";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import { NavigationItem } from "../../shared/design-system/ui/NavigationItem";
import { Tooltip } from "../../shared/design-system/ui/Tooltip";
import {
  MenuIcon,
  MenuNote,
  MenuItem,
  MenuPopup,
  MenuRoot,
  MenuSeparator,
  MenuTrailing,
  MenuTrigger,
} from "../../shared/design-system/ui/Menu";
import {
  PanelHeader,
  PanelHeaderLabel,
} from "../../shared/design-system/ui/PanelHeader";
import {
  TIME_PRESETS,
  dueDateLabel,
  dueShortLabel,
  groupLabel,
  presetLabel,
  dueLabel,
  endOfToday,
  groupReminders,
  isDisplayable,
  navigableTarget,
  presetHint,
} from "./model";
import { scopeOf, useReminders } from "./react";
import styles from "./Reminders.module.css";
import { avatarMedia } from "../../shared/avatar-source";
import { channelText } from "../../features/channels/channel-icon";
import { t, useLanguage } from "../../shared/i18n";

type Clock = { subscribe(listener: () => void): () => void; read(): number };

export function RemindersPage({
  relay,
  navigator,
  clock,
}: {
  relay: RelayData;
  navigator: Navigation;
  clock: Clock;
}) {
  useLanguage();
  const { connection, reminders, state } = useReminders(relay);
  const now = useSyncExternalStore(clock.subscribe, clock.read, clock.read);
  const [error, setError] = useState<string>();
  // The store whose Retry read is pending; a replaced store's never counts.
  const [retrying, setRetrying] = useState<Reminders>();
  const page = useRef<HTMLDivElement>(null);
  const retryFocus = useRef(false);
  const retryButton = useCallback((button: HTMLButtonElement | null) => {
    if (!button) return;
    // Capture ownership before removal, not after focus has fallen to body.
    return () => {
      retryFocus.current = document.activeElement === button;
    };
  }, []);
  const scope = scopeOf(connection);
  const groups = groupReminders(state.reminders, now, endOfToday());
  const done = groups.find((group) => group.label === "Done");
  const active = groups.filter((group) => group !== done);
  const run = (action: Promise<unknown>) => {
    setError(undefined);
    action.catch(() => setError(t("v1wf.rem.updateFailed")));
  };
  const open = (reminder: Reminder, conversation = false) => {
    const target = reminder.target;
    if (!target?.channelId || (!conversation && !target.eventId) || !scope)
      return;
    void navigator
      .open({
        version: 1,
        kind: "conversation",
        scope,
        channelId: target.channelId,
        ...(conversation ? {} : { messageId: target.eventId }),
      })
      .then((result) => {
        if (result.status === "failed")
          setError(
            conversation
              ? t("v1wf.rem.conversationOpenFailed")
              : t("v1wf.rem.messageOpenFailed"),
          );
      });
  };
  const status = !reminders
    ? connection.status === "error"
      ? (connection.error ?? t("v1wf.rem.couldNotConnect"))
      : t("v1wf.rem.connect")
    : state.status === "loading" && !state.hydrated
      ? t("v1wf.rem.loading")
      : undefined;
  // Any failed read, first or later, keeps Retry up beside whatever list we
  // have until a read succeeds; live arrivals never clear it.
  const failed =
    reminders && state.error !== undefined && state.status !== "loading";
  // Retry stays mounted, busy and focusable, while its own store's read is
  // pending.
  const busy = reminders !== undefined && retrying === reminders;
  const showRetry = failed || busy;
  const retry = (reminders: Reminders) => {
    setRetrying(reminders);
    void reminders
      .refresh()
      .finally(() =>
        setRetrying((current) => (current === reminders ? undefined : current)),
      );
  };
  // When Retry goes away while it had focus, the page takes it, unless the user
  // moved on or another control claimed focus in the same commit.
  useLayoutEffect(() => {
    if (showRetry || !retryFocus.current) return;
    retryFocus.current = false;
    if (document.activeElement === document.body) page.current?.focus();
  }, [showRetry]);
  return (
    <div className="h-full min-h-0">
      <FullPageSurface aria-label={t("v1wf.rem.title")}>
        <div ref={page} tabIndex={-1} data-buzz-ui="" className={styles.page}>
          <PanelHeader
            title={
              <PanelHeaderLabel
                title={t("v1wf.rem.title")}
                icon={<AlarmIcon size="1rem" />}
              />
            }
          />
          {error && (
            <p role="alert" className={styles.notice}>
              {error}
            </p>
          )}
          {reminders && showRetry && (
            <div role="alert" className={styles.notice}>
              <p>{t("v1wf.rem.someFailed")}</p>
              <Button
                ref={retryButton}
                loading={busy}
                onClick={() => retry(reminders)}
              >
                {t("v1wf.rem.retry")}
              </Button>
            </div>
          )}
          {status || !reminders ? (
            <p role="status" className={styles.notice}>
              {status}
            </p>
          ) : (failed && !state.hydrated && !state.reminders.length) ||
            connection.status !== "ready" ? null : (
            <ReminderSections
              session={connection.session}
              reminders={reminders}
              active={active}
              done={done?.reminders}
              now={now}
              open={scope ? open : undefined}
              run={run}
            />
          )}
        </div>
      </FullPageSurface>
    </div>
  );
}

function ReminderSections({
  session,
  reminders,
  active,
  done,
  now,
  open,
  run,
}: {
  session: RelaySession;
  reminders: Reminders;
  active: readonly { label: string; reminders: Reminder[] }[];
  done: readonly Reminder[] | undefined;
  now: number;
  open: ((reminder: Reminder, conversation?: boolean) => void) | undefined;
  run(action: Promise<unknown>): void;
}) {
  useLanguage();
  const reducedMotion = useReducedMotion();
  const [pointerMotion, setPointerMotion] = useState(false);
  const animate = pointerMotion && !reducedMotion;
  const sections = useRef<HTMLDivElement>(null);
  const keyboardCompletion = useRef<HTMLElement | undefined>(undefined);
  const completionKeyHeld = useRef(false);
  const restoreCompletionFocus = useCallback(() => {
    if (completionKeyHeld.current) return;
    const trigger = keyboardCompletion.current;
    if (!trigger || (trigger.isConnected && !trigger.closest("[inert]")))
      return;
    // Keep repeated keyboard completion inside the list, without stealing
    // focus if the user has moved elsewhere while the save was pending.
    if (
      document.activeElement === document.body ||
      document.activeElement === trigger
    ) {
      const next = Array.from(
        sections.current?.querySelectorAll<HTMLElement>('[role="checkbox"]') ??
          [],
      ).find(
        (item) =>
          !item.closest("[inert]") &&
          item.getAttribute("aria-disabled") !== "true",
      );
      (
        next ??
        sections.current?.querySelector<HTMLElement>(
          '[data-reminder-group="done"] button',
        )
      )?.focus();
    }
    keyboardCompletion.current = undefined;
  }, []);
  useLayoutEffect(restoreCompletionFocus);
  useEffect(() => {
    let frame = 0;
    const released = (event: KeyboardEvent) => {
      if (event.key !== " ") return;
      completionKeyHeld.current = false;
      // Let Space's native activation finish before focusing another checkbox.
      frame = requestAnimationFrame(restoreCompletionFocus);
    };
    document.addEventListener("keyup", released);
    return () => {
      document.removeEventListener("keyup", released);
      cancelAnimationFrame(frame);
    };
  }, [restoreCompletionFocus]);
  const all = [...active.flatMap((group) => group.reminders), ...(done ?? [])];
  const authorKey = [
    ...new Set(all.flatMap((item) => item.target?.authorPubkey || [])),
  ]
    .sort()
    .join(":");
  const authorIds = useMemo(
    () => (authorKey ? authorKey.split(":") : []),
    [authorKey],
  );
  const { channels } = useChannelList(session.channels);
  const profiles = useProfiles(session, authorIds);
  const name = useIdentityNames(session.names);
  const row = (reminder: Reminder) => {
    const target = reminder.target;
    const channel = target?.channelId
      ? channels.find((item) => item.id === target.channelId)
      : undefined;
    const author = target?.authorPubkey;
    const profile = author ? profiles.get(author) : undefined;
    const sender = author
      ? name(
          author,
          profile?.name ??
            formatPublicKey(author) ??
            t("v1wf.rem.unknownSender"),
          channel?.members,
        )
      : t("v1wf.rem.reminder");
    const context =
      channel?.channelType === "dm"
        ? t("v1wf.rem.directMessage")
        : channel?.name
          ? channelText(channel)
          : undefined;
    return (
      <ReminderRow
        key={reminder.id}
        reminder={reminder}
        reminders={reminders}
        now={now}
        sender={sender}
        context={context}
        avatar={
          author ? (
            <Avatar
              size="small"
              alt=""
              fallback={sender}
              src={avatarMedia(profile?.picture, session.media)}
              shape={profile?.isAgent ? "squircle" : "circle"}
            />
          ) : (
            <Avatar
              size="small"
              alt=""
              fallback={t("v1wf.rem.reminder")}
              fallbackContent={<AlarmIcon size={18} />}
              shape="squircle"
            />
          )
        }
        open={
          open && navigableTarget(reminder) ? () => open(reminder) : undefined
        }
        openConversation={
          open && target?.channelId ? () => open(reminder, true) : undefined
        }
        run={run}
      />
    );
  };
  return (
    <MotionConfig
      transition={{ duration: animate ? 0.18 : 0, ease: [0.23, 1, 0.32, 1] }}
    >
      <motion.div
        layoutScroll
        ref={sections}
        className={styles.sections}
        onPointerDownCapture={() => {
          keyboardCompletion.current = undefined;
          completionKeyHeld.current = false;
          setPointerMotion(true);
        }}
        onKeyDownCapture={(event) => {
          setPointerMotion(false);
          keyboardCompletion.current =
            event.key === " " &&
            event.target instanceof HTMLElement &&
            event.target.getAttribute("role") === "checkbox"
              ? event.target
              : undefined;
          completionKeyHeld.current = keyboardCompletion.current !== undefined;
        }}
      >
        <LayoutGroup>
          <AnimatePresence initial={false} mode="popLayout">
            {active.length ? (
              active.map((group) => (
                <motion.section
                  layout="position"
                  initial={false}
                  exit={{ opacity: 0 }}
                  key={group.label}
                  aria-label={groupLabel(group.label)}
                  className={styles.group}
                >
                  <InlineHeader
                    title={
                      <span className={styles.groupHeading}>
                        {groupLabel(group.label)}
                        <span className="text-caption text-subtle">
                          {group.reminders.length}
                        </span>
                      </span>
                    }
                  />
                  <ul className={styles.list}>
                    <AnimatePresence initial={false} mode="popLayout" propagate>
                      {group.reminders.map(row)}
                    </AnimatePresence>
                  </ul>
                </motion.section>
              ))
            ) : (
              <motion.div key="empty" layout="position" initial={false}>
                <EmptyState
                  icon={<AlarmIcon size={24} />}
                  title={done ? t("v1wf.rem.allCaughtUp") : t("v1wf.rem.none")}
                  description={t("v1wf.rem.emptyDescription")}
                />
              </motion.div>
            )}
            {done && (
              <motion.section
                key="done"
                layout="position"
                initial={false}
                aria-label={t("v1wf.rem.group.Done")}
                data-reminder-group="done"
                className={styles.group}
              >
                <Accordion
                  variant="section"
                  items={[
                    {
                      value: "done",
                      title: (
                        <span className={styles.groupHeading}>
                          {t("v1wf.rem.group.Done")}{" "}
                          <span className="text-caption text-subtle">
                            {done.length}
                          </span>
                        </span>
                      ),
                      content: (
                        <ul className={styles.list}>
                          <AnimatePresence initial={false} mode="popLayout">
                            {done.map(row)}
                          </AnimatePresence>
                        </ul>
                      ),
                    },
                  ]}
                />
              </motion.section>
            )}
          </AnimatePresence>
        </LayoutGroup>
      </motion.div>
    </MotionConfig>
  );
}

function useProfiles(session: RelaySession, ids: readonly string[]) {
  const selection = useMemo(
    () => selectProfiles(session.profiles, ids),
    [session, ids],
  );
  const profiles = useSyncExternalStore(
    selection.subscribe,
    selection.snapshot,
    selection.snapshot,
  );
  const profileGeneration = useProfileGeneration(session.profiles);
  useEffect(() => {
    void profileGeneration;
    if (ids.length)
      void session.profiles.ensure(ids, "background").catch(() => {});
  }, [session, ids, profileGeneration]);
  return profiles;
}

function ReminderRow({
  ref,
  reminder,
  reminders,
  now,
  sender,
  context,
  avatar,
  open,
  openConversation,
  run,
}: {
  ref?: Ref<HTMLLIElement>;
  reminder: Reminder;
  reminders: Reminders;
  now: number;
  sender: string;
  context: string | undefined;
  avatar: ReactElement;
  open: (() => void) | undefined;
  openConversation: (() => void) | undefined;
  run(action: Promise<unknown>): void;
}) {
  useLanguage();
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [completing, setCompleting] = useState(false);
  const present = useIsPresent();
  useLayoutEffect(() => {
    // A newer relay event can win a successful write. Reset surviving rows,
    // but keep the completion check visible throughout an accepted exit.
    if (!busy && present) setCompleting(false);
  }, [busy, present]);
  const update = (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    run(action().finally(() => setBusy(false)));
  };
  const pending = reminder.status === "pending";
  const overdue =
    pending && reminder.notBefore !== undefined && reminder.notBefore <= now;
  const preview = reminder.target?.preview
    ? messagePreview(reminder.target.preview, { storedPreview: true })
    : reminder.note;
  const note = reminder.target?.preview ? reminder.note : undefined;
  const fullDue =
    pending &&
    reminder.notBefore !== undefined &&
    isDisplayable(reminder.notBefore)
      ? dueLabel(reminder.notBefore, now)
      : reminder.status === "done"
        ? t("v1wf.rem.doneAgo", {
            time: relativeTimestamp(reminder.createdAt, now),
          })
        : undefined;
  const due =
    pending &&
    reminder.notBefore !== undefined &&
    isDisplayable(reminder.notBefore) ? (
      <time
        className={`text-caption ${styles.due}`}
        data-overdue={overdue || undefined}
        dateTime={new Date(reminder.notBefore * 1000).toISOString()}
      >
        {dueShortLabel(reminder.notBefore, now)}
      </time>
    ) : reminder.status === "done" ? (
      <span className="text-caption text-subtle">
        {t("v1wf.rem.group.Done")}
      </span>
    ) : null;
  const snoozeItems = TIME_PRESETS.map((preset) => (
    <MenuItem
      key={preset.label}
      disabled={busy}
      onClick={() => update(() => reminders.snooze(reminder.id, preset.at()))}
    >
      {presetLabel(preset.label)}
      <MenuTrailing>{presetHint(preset.at(), now)}</MenuTrailing>
    </MenuItem>
  ));
  const label = (
    <span className={styles.content}>
      <span
        id={`${id}-preview`}
        className={`text-body ${pending ? "text-standard" : "text-subtle"} ${styles.preview}`}
        data-message={open && reminder.target?.preview ? "" : undefined}
      >
        {preview || sender}
      </span>
      {note && (
        <span
          id={`${id}-note`}
          className={`text-caption text-subtle ${styles.note}`}
        >
          {note}
        </span>
      )}
    </span>
  );
  return (
    <motion.li
      ref={ref}
      layout="position"
      initial={false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={styles.row}
      data-status={reminder.status}
      inert={!present || undefined}
      aria-hidden={!present || undefined}
    >
      {fullDue && (
        <span id={`${id}-due`} data-reminder-due="" className="sr-only">
          {fullDue}
        </span>
      )}
      <div className={styles.rowSurface} aria-busy={busy}>
        <span className={styles.completion}>
          {pending ? (
            <Checkbox
              label={
                <span className="sr-only">
                  {t("v1wf.rem.markDone", { sender })}
                </span>
              }
              checked={completing}
              disabled={busy}
              onCheckedChange={() => {
                setCompleting(true);
                update(() => reminders.complete(reminder.id));
              }}
            />
          ) : (
            <CheckIcon
              size={20}
              aria-label={t("v1wf.rem.completed")}
              className="text-subtle"
            />
          )}
        </span>
        {open ? (
          <NavigationItem
            aria-label={t("v1wf.rem.openMessageFrom", { sender })}
            aria-describedby={[
              preview && `${id}-preview`,
              note && `${id}-note`,
              due && `${id}-due`,
            ]
              .filter(Boolean)
              .join(" ")}
            label={label}
            onClick={open}
          />
        ) : (
          <div className={styles.static}>{label}</div>
        )}
        <span className={styles.rowActions}>
          <MenuRoot>
            <MenuTrigger
              render={
                <Button
                  size="sm"
                  variant={overdue ? "attention" : "ghost"}
                  disabled={busy}
                  aria-label={
                    pending
                      ? t("v1wf.rem.snoozeNamed", { sender })
                      : t("v1wf.rem.remindAgainNamed", { sender })
                  }
                  title={
                    pending ? t("v1wf.rem.snooze") : t("v1wf.rem.remindAgain")
                  }
                >
                  {due ?? <AlarmIcon size={16} aria-hidden="true" />}
                </Button>
              }
            />
            <MenuPopup align="end">
              {pending &&
                reminder.notBefore !== undefined &&
                isDisplayable(reminder.notBefore) && (
                  <MenuNote>{dueDateLabel(reminder.notBefore, now)}</MenuNote>
                )}
              {snoozeItems}
            </MenuPopup>
          </MenuRoot>
          {openConversation ? (
            <IconButton
              variant="avatar"
              aria-label={t("v1wf.rem.openConversationNamed", {
                name: context ?? sender,
              })}
              title={
                context
                  ? t("v1wf.rem.openConversationContext", { context })
                  : t("v1wf.rem.openConversation")
              }
              icon={avatar}
              onClick={openConversation}
            />
          ) : (
            <Tooltip content={[sender, context].filter(Boolean).join(" · ")}>
              <span className={styles.avatar} role="img" aria-label={sender}>
                {avatar}
              </span>
            </Tooltip>
          )}
          {(open || pending) && (
            <MenuRoot>
              <MenuTrigger
                render={
                  <IconButton
                    hint="familiar"
                    disabled={busy}
                    aria-label={t("v1wf.rem.moreActionsNamed", { sender })}
                    title={t("v1wf.rem.moreActions")}
                    icon={<DotsThreeIcon size={16} />}
                  />
                }
              />
              <MenuPopup align="end">
                <MenuNote>
                  {[sender, context].filter(Boolean).join(" · ")}
                </MenuNote>
                {open && (
                  <MenuItem onClick={open}>
                    <MenuIcon>
                      <ArrowSquareOutIcon size={16} />
                    </MenuIcon>
                    {t("v1wf.rem.openMessage")}
                  </MenuItem>
                )}
                {open && pending && <MenuSeparator />}
                {pending && (
                  <MenuItem
                    tone="danger"
                    disabled={busy}
                    onClick={() => update(() => reminders.cancel(reminder.id))}
                  >
                    <MenuIcon>
                      <XIcon size={16} />
                    </MenuIcon>
                    {t("v1wf.rem.cancelReminder")}
                  </MenuItem>
                )}
              </MenuPopup>
            </MenuRoot>
          )}
        </span>
      </div>
    </motion.li>
  );
}
