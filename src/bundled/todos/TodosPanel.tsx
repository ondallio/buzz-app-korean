import { useProfileGeneration } from "../../features/relay/react";
import Markdown from "react-markdown";
import markdownStyles from "../../features/markdown/Markdown.module.css";
import { parseBuzzLink } from "../../features/navigation/buzz-links";
import { profileKey } from "../../features/profiles/target";
import { safeLinkUrl } from "../../features/relay/message-content";
import remarkGfm from "remark-gfm";
import { MessageLink } from "../../features/conversation/MessageLink";
import { CanvasConflictError } from "../../features/channel-templates/canvas-conflict";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { RelaySession } from "../../features/relay/session";
import { useIdentityNames } from "../../features/identity-names/react";
import { Avatar } from "../../shared/design-system/ui/Avatar";
import { TodoChoice } from "./TodoChoice";
import {
  canvasReadOnly,
  type ChannelCanvas,
} from "../../features/channel-templates/capability";
import type { ChannelPanelContext } from "../../features/panels/service";
import {
  XIcon,
  CaretDownIcon,
  CaretRightIcon,
  InfoIcon,
  ArrowsClockwiseIcon,
  ListChecksIcon,
  UserIcon,
  CircleIcon,
  CircleHalfIcon,
  CheckCircleIcon,
} from "../../shared/design-system/icons/index";
import { AlertDialog } from "../../shared/design-system/ui/AlertDialog";
import { Button } from "../../shared/design-system/ui/Button";
import { Checkbox } from "../../shared/design-system/ui/Checkbox";
import { EmptyState } from "../../shared/design-system/ui/EmptyState";
import { Field } from "../../shared/design-system/ui/Field";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverPopup,
  PopoverTitle,
  PopoverDescription,
} from "../../shared/design-system/ui/Popover";
import { Input } from "../../shared/design-system/ui/Input";
import {
  PanelHeader,
  PanelHeaderLabel,
} from "../../shared/design-system/ui/PanelHeader";
import { publicKeyLabels } from "../../shared/identity/public-key";
import { readView, writeView } from "../../shared/view-state";
import {
  todoLabelText,
  addTodo,
  assignTodo,
  readTodos,
  setStatus,
  type Status,
} from "./model";
import styles from "./Todos.module.css";
import { avatarMedia } from "../../shared/avatar-source";
import { t, useLanguage } from "../../shared/i18n";

export type TodoPeople = {
  channels: Pick<
    RelaySession["channels"],
    "list" | "subscribeList" | "ensureList" | "refreshList"
  >;
  profiles: RelaySession["profiles"];
  names: RelaySession["names"];
  media: RelaySession["media"];
};
type Draft = {
  content: string;
  original: string;
  base: string | null;
  input: string;
};
const noMembers: readonly string[] = [];
const empty: Draft = { content: "", original: "", base: null, input: "" };
const statuses: Status[] = ["todo", "doing", "done"];
const statusLabel = (status: Status) => t(`v1wf.todo.status.${status}`);
function StatusIcon({ status }: { status: Status }) {
  const Icon =
    status === "done"
      ? CheckCircleIcon
      : status === "doing"
        ? CircleHalfIcon
        : CircleIcon;
  return (
    <Icon
      size="1rem"
      aria-hidden="true"
      className={
        status === "doing"
          ? styles.inProgress
          : status === "done"
            ? styles.done
            : "text-secondary"
      }
    />
  );
}
function readDraft(scope: string, key: string): Draft | undefined {
  const value = readView<Partial<Draft> | null>(scope, key, null);
  return value &&
    typeof value.content === "string" &&
    typeof value.original === "string" &&
    typeof value.input === "string" &&
    (value.base === null || typeof value.base === "string")
    ? (value as Draft)
    : undefined;
}
export function TodosPanel({
  canvas,
  people,
  context,
  close,
  active,
  onOpenLink = () => false,
}: {
  canvas: ChannelCanvas;
  people: TodoPeople;
  context: ChannelPanelContext;
  close(): void;
  active(): boolean;
  onOpenLink?(url: string): boolean;
}) {
  useLanguage();
  const list = useSyncExternalStore(
    people.channels.subscribeList,
    people.channels.list,
  );
  const resolveIdentity = useIdentityNames(people.names);
  const profiles = useSyncExternalStore(
    people.profiles.subscribe,
    people.profiles.snapshot,
  );
  const channel = list.channels.find(
    (channel) => channel.id === context.channelId,
  );
  const members = channel?.members;
  // Members are read-only until startup confirms them; never discard drafts.
  const readOnly = canvasReadOnly(channel);
  // save() re-checks this after its wait; capability's canWrite ignores archived.
  const latestReadOnly = useRef(readOnly);
  latestReadOnly.current = readOnly;
  const resolveName = (pubkey: string, fallback: string) =>
    resolveIdentity(pubkey, fallback, members ?? noMembers);
  const key = `todos-draft-v1:${context.channelId}`;
  const [saved] = useState(() => readDraft(context.scope, key));
  const savedDirty = !!saved && saved.content !== saved.original;
  const [draft, setDraft] = useState<Draft>(saved ?? empty);
  const latestDraft = useRef(draft);
  const [collapsed, setCollapsed] = useState<Set<number>>(() => new Set());
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<"load" | "save">();
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [confirmRefresh, setConfirmRefresh] = useState(false);
  const refreshRef = useRef<HTMLButtonElement>(null);
  const operation = useRef(0);
  const saving = useRef(false);
  const savedAt = useRef(0);
  const cancelWait = useRef<(() => void) | undefined>(undefined);
  const prefix = useId();
  const focusAfterToggle = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    if (focusAfterToggle.current && !busy) {
      const target = document.getElementById(focusAfterToggle.current);
      if (document.activeElement === document.body)
        (target?.querySelector<HTMLElement>("button") ?? target)?.focus();
      focusAfterToggle.current = undefined;
    }
  });
  const dirty = draft.content !== draft.original;
  const update = useCallback(
    (next: Draft) => {
      const before = latestDraft.current.content;
      if (before !== next.content) {
        let start = 0,
          end = before.length,
          nextEnd = next.content.length;
        while (
          start < end &&
          start < nextEnd &&
          before[start] === next.content[start]
        )
          start++;
        while (
          end > start &&
          nextEnd > start &&
          before[end - 1] === next.content[nextEnd - 1]
        ) {
          end--;
          nextEnd--;
        }
        setCollapsed(
          (current) =>
            new Set(
              [...current].flatMap((offset) =>
                offset <= start
                  ? [offset]
                  : offset >= end
                    ? [offset + nextEnd - end]
                    : [],
              ),
            ),
        );
      }
      latestDraft.current = next;
      setDraft(next);
      writeView(
        context.scope,
        key,
        next.content !== next.original || next.input ? next : null,
      );
    },
    [context.scope, key],
  );
  const load = useCallback(
    async (replace = false) => {
      if (!active()) return;
      const generation = ++operation.current;
      setBusy("load");
      setError("");
      try {
        const head = await canvas.read(context.channelId);
        if (!active() || generation !== operation.current) return;
        savedAt.current = head?.created_at ?? 0;
        setLoaded(true);
        const alreadySaved = !!saved && saved.content === head?.content;
        const changed =
          !replace &&
          savedDirty &&
          !alreadySaved &&
          saved.base !== (head?.id ?? null);
        setConflict(changed);
        if (changed) setError(t("v1wf.todo.conflict"));
        if (replace) setCollapsed(new Set());
        if (replace || !savedDirty || alreadySaved)
          update({
            ...empty,
            input: !replace ? (saved?.input ?? "") : "",
            content: head?.content ?? "",
            original: head?.content ?? "",
            base: head?.id ?? null,
          });
      } catch (reason) {
        if (active() && generation === operation.current)
          setError(String(reason));
      } finally {
        if (active() && generation === operation.current) setBusy(undefined);
      }
    },
    [active, canvas, context.channelId, saved, savedDirty, update],
  );
  // The parent keys this editor by session and channel. No background reads or writes.
  useEffect(() => {
    void load();
    return () => {
      operation.current++;
      cancelWait.current?.();
    };
  }, [load]);
  const save = async (next = draft) => {
    if (
      !active() ||
      saving.current ||
      busy ||
      !loaded ||
      next.content === next.original ||
      conflict ||
      !canvas.available ||
      latestReadOnly.current
    )
      return;
    saving.current = true;
    const generation = ++operation.current;
    setBusy("save");
    setError("");
    try {
      // Canvas revisions use whole seconds. Wait once, without retrying a write.
      const delay = (savedAt.current + 1) * 1000 - Date.now();
      if (delay > 0) {
        await new Promise<void>((resolve) => {
          const timer = window.setTimeout(resolve, Math.min(delay, 1000));
          cancelWait.current = () => {
            window.clearTimeout(timer);
            resolve();
          };
        });
        cancelWait.current = undefined;
      }
      if (
        !active() ||
        generation !== operation.current ||
        latestReadOnly.current
      )
        return;
      const head = await canvas.save(
        context.channelId,
        next.content,
        next.base ?? undefined,
        { preserveApproval: true },
      );
      if (!active() || generation !== operation.current) return;
      savedAt.current = head.created_at;
      update({
        ...latestDraft.current,
        original: head.content,
        content: head.content,
        base: head.id,
      });
    } catch (reason) {
      if (active() && generation === operation.current) {
        const hasConflict = reason instanceof CanvasConflictError;
        setConflict(hasConflict);
        setError(
          hasConflict
            ? t("v1wf.todo.conflict")
            : t("v1wf.todo.saveFailed", {
                reason:
                  reason instanceof Error ? reason.message : String(reason),
              }),
        );
      }
    } finally {
      saving.current = false;
      if (active() && generation === operation.current) setBusy(undefined);
    }
  };
  const { parsed, parseError } = useMemo(() => {
    try {
      return { parsed: readTodos(draft.content), parseError: "" };
    } catch (reason) {
      return {
        parsed: undefined,
        parseError: reason instanceof Error ? reason.message : String(reason),
      };
    }
  }, [draft.content]);
  const inputDisabled =
    !loaded ||
    busy === "load" ||
    !canvas.available ||
    readOnly ||
    !!parseError ||
    conflict;
  const disabled = inputDisabled || busy === "save";
  const retryable = dirty && !busy && !conflict && !parseError;
  // Only a restored draft is unsaved without an error. Derived here because
  // read-only can end without a reload.
  const restored = retryable && !error;
  const message =
    error ||
    parseError ||
    (restored && !readOnly ? t("v1wf.todo.recovered") : "");
  const items = parsed?.items ?? [];
  const peopleKey = [
    ...new Set([
      ...(members ?? []),
      ...items.flatMap((item) => (item.assignee ? [item.assignee.pubkey] : [])),
    ]),
  ]
    .sort()
    .join(":");
  const [namesError, setNamesError] = useState(false);
  const [namesRetry, setNamesRetry] = useState(0);
  const profileGeneration = useProfileGeneration(people.profiles);
  useEffect(() => {
    void namesRetry; // Explicit user retry reruns this owned read.
    void profileGeneration;
    let current = true;
    people.channels.ensureList();
    void people.profiles
      .ensure(peopleKey ? peopleKey.split(":") : [], "background")
      .then(
        () => {
          if (current && active()) setNamesError(false);
        },
        () => {
          if (current && active()) setNamesError(true);
        },
      );
    return () => {
      current = false;
    };
  }, [people, peopleKey, active, namesRetry, profileGeneration]);
  const keyLabels = publicKeyLabels(peopleKey.split(":"));
  const userLabel = (pubkey: string, fallback = "") => {
    const key = keyLabels.get(pubkey) ?? pubkey;
    const name = resolveName(pubkey, fallback);
    return name ? `${name} · ${key}` : key;
  };
  const personIcon = (pubkey: string, fallback = "") => {
    const profile = profiles.get(pubkey);
    const name =
      resolveName(pubkey, fallback) ||
      keyLabels.get(pubkey) ||
      t("v1wf.todo.unknownMember");
    return (
      <Avatar
        size="small"
        alt=""
        fallback={name}
        shape={profile?.isAgent ? "squircle" : "circle"}
        src={avatarMedia(profile?.picture, people.media)}
      />
    );
  };
  const choices = (members ?? [])
    .map((pubkey) => ({
      value: pubkey,
      label: userLabel(pubkey),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const change = (edit: () => string) => {
    if (!active() || disabled || saving.current) return;
    try {
      const next = { ...draft, content: edit() };
      update(next);
      void save(next);
    } catch (reason) {
      setError(String(reason));
    }
  };
  const saveStatus =
    busy === "save"
      ? t("v1wf.todo.saving")
      : dirty
        ? t("v1wf.todo.unsaved")
        : loaded
          ? t("v1wf.todo.saved")
          : t("v1wf.todo.channelCanvas");
  // Source order and ancestor depth keep descendants beside their root across statuses.
  const childrenByOffset = new Map<number | undefined, typeof items>();
  const ancestors: typeof items = [];
  for (const item of items) {
    ancestors.length = item.parents.length;
    const parent = ancestors.at(-1)?.offset;
    const children = childrenByOffset.get(parent) ?? [];
    children.push(item);
    childrenByOffset.set(parent, children);
    ancestors.push(item);
  }
  const renderItems = (group: typeof items): ReactNode =>
    group.map((item) => {
      const children = childrenByOffset.get(item.offset) ?? [];
      const taskLabel = todoLabelText(item.label);
      const assigneeName = item.assignee
        ? resolveName(item.assignee.pubkey, item.assignee.name) ||
          keyLabels.get(item.assignee.pubkey)
        : item.namedAssignee?.name;

      return (
        <li key={item.offset}>
          <div className={styles.row}>
            <div className={styles.disclosure}>
              {children.length > 0 && (
                <IconButton
                  size="sm"
                  aria-label={
                    collapsed.has(item.offset)
                      ? t("v1wf.todo.expand", { task: taskLabel })
                      : t("v1wf.todo.collapse", { task: taskLabel })
                  }
                  aria-expanded={!collapsed.has(item.offset)}
                  aria-controls={`${prefix}-${item.offset}-children`}
                  icon={
                    collapsed.has(item.offset) ? (
                      <CaretRightIcon size="1rem" />
                    ) : (
                      <CaretDownIcon size="1rem" />
                    )
                  }
                  onClick={() =>
                    setCollapsed((current) => {
                      const next = new Set(current);
                      if (next.has(item.offset)) next.delete(item.offset);
                      else next.add(item.offset);
                      return next;
                    })
                  }
                />
              )}
            </div>
            <Checkbox
              id={`${prefix}-${item.offset}`}
              checked={item.status === "done"}
              indeterminate={item.status === "doing"}
              disabled={disabled}
              onCheckedChange={(value) => {
                focusAfterToggle.current = `${prefix}-${item.offset}`;
                change(() =>
                  setStatus(
                    draft.content,
                    item.offset,
                    value ? "done" : "todo",
                  ),
                );
              }}
              aria-label={taskLabel}
              label=""
            />
            <div
              className={`${styles.label} ${markdownStyles.inline} text-body-sm ${item.status === "done" ? "text-secondary" : ""}`}
              data-completed={item.status === "done" || undefined}
            >
              <Markdown
                remarkPlugins={[remarkGfm]}
                urlTransform={(value) =>
                  parseBuzzLink(value) || profileKey(value)
                    ? value
                    : safeLinkUrl(value)
                }
                allowedElements={[
                  "p",
                  "a",
                  "strong",
                  "em",
                  "del",
                  "code",
                  "br",
                  "img",
                ]}
                unwrapDisallowed
                components={{
                  p: ({ children }) => <span>{children}</span>,
                  a: ({ href, children }) =>
                    href ? (
                      <MessageLink
                        url={href}
                        registry={undefined}
                        onOpenLink={(url) => active() && onOpenLink(url)}
                      >
                        {children}
                      </MessageLink>
                    ) : (
                      <span>{children}</span>
                    ),
                  img: ({ alt }) => <span>{alt}</span>,
                }}
              >
                {item.label}
              </Markdown>
            </div>
            <div className={styles.rowDetails}>
              <div
                id={`${prefix}-${item.offset}-status`}
                className={styles.status}
              >
                <TodoChoice
                  id={`${prefix}-${item.offset}-status-control`}
                  label={t("v1wf.todo.statusFor", { task: taskLabel })}
                  menuTitle={t("v1wf.todo.changeStatus")}
                  title={t("v1wf.todo.statusTitle")}
                  icon={<StatusIcon status={item.status} />}
                  value={item.status}
                  disabled={disabled}
                  options={statuses.map((value) => ({
                    value,
                    label: statusLabel(value),
                    icon: <StatusIcon status={value} />,
                  }))}
                  onValueChange={(value) => {
                    const status = statuses.find((status) => status === value);
                    if (!status || status === item.status) return;
                    focusAfterToggle.current = `${prefix}-${item.offset}-status`;
                    change(() => setStatus(draft.content, item.offset, status));
                  }}
                />
              </div>
              <fieldset
                id={`${prefix}-${item.offset}-assignee`}
                className={styles.assignee}
                aria-label={t("v1wf.todo.assigneeFor", { task: taskLabel })}
              >
                <TodoChoice
                  id={`${prefix}-${item.offset}-assignee-control`}
                  label={
                    assigneeName
                      ? t("v1wf.todo.assigneeForNamed", {
                          task: taskLabel,
                          name: assigneeName,
                        })
                      : t("v1wf.todo.assigneeFor", { task: taskLabel })
                  }
                  menuTitle={t("v1wf.todo.assignTo")}
                  text={
                    (item.assignee || item.namedAssignee) && (
                      <span className={styles.assigneeName}>
                        {item.assignee
                          ? resolveName(
                              item.assignee.pubkey,
                              item.assignee.name,
                            ) || keyLabels.get(item.assignee.pubkey)
                          : item.namedAssignee?.name}
                      </span>
                    )
                  }
                  title={
                    item.assignee
                      ? userLabel(item.assignee.pubkey, item.assignee.name)
                      : item.namedAssignee
                        ? t("v1wf.todo.fromCanvasChoose", {
                            name: item.namedAssignee.name,
                          })
                        : t("v1wf.todo.assignTask")
                  }
                  icon={
                    item.assignee ? (
                      personIcon(item.assignee.pubkey, item.assignee.name)
                    ) : (
                      <UserIcon size="1rem" aria-hidden="true" />
                    )
                  }
                  variant={item.assignee ? "avatar" : "ghost"}
                  value={
                    item.assignee?.pubkey ??
                    (item.namedAssignee ? "canvas-name" : "")
                  }
                  disabled={disabled || !members}
                  options={[
                    ...(item.namedAssignee
                      ? [
                          {
                            value: "canvas-name",
                            label: t("v1wf.todo.fromCanvasNotLinked", {
                              name: item.namedAssignee.name,
                            }),
                            icon: <UserIcon size="1rem" aria-hidden="true" />,
                            disabled: true,
                          },
                        ]
                      : []),
                    {
                      value: "",
                      label: t("v1wf.todo.unassigned"),
                      icon: <UserIcon size="1rem" aria-hidden="true" />,
                    },
                    ...choices.map((choice) => ({
                      ...choice,
                      label: userLabel(
                        choice.value,
                        item.assignee?.pubkey === choice.value
                          ? item.assignee.name
                          : "",
                      ),
                      icon: personIcon(choice.value),
                    })),
                    ...(item.assignee &&
                    !members?.includes(item.assignee.pubkey)
                      ? [
                          {
                            value: item.assignee.pubkey,
                            label: `${userLabel(item.assignee.pubkey, item.assignee.name)} (${members ? "not in channel" : "membership unavailable"})`,
                            icon: personIcon(
                              item.assignee.pubkey,
                              item.assignee.name,
                            ),
                            disabled: true,
                          },
                        ]
                      : []),
                  ]}
                  onValueChange={(pubkey) => {
                    const currentMembers = people.channels
                      .list()
                      .channels.find(
                        (channel) => channel.id === context.channelId,
                      )?.members;
                    if (
                      !currentMembers ||
                      (pubkey && !currentMembers.includes(pubkey))
                    )
                      return;
                    focusAfterToggle.current = `${prefix}-${item.offset}-assignee`;
                    change(() =>
                      assignTodo(
                        draft.content,
                        item.offset,
                        pubkey
                          ? {
                              pubkey,
                              name: resolveName(
                                pubkey,
                                keyLabels.get(pubkey) ?? pubkey,
                              ),
                            }
                          : undefined,
                      ),
                    );
                  }}
                />
              </fieldset>
            </div>
          </div>
          {children.length > 0 && (
            <ul
              id={`${prefix}-${item.offset}-children`}
              className={styles.children}
              hidden={collapsed.has(item.offset)}
            >
              {renderItems(children)}
            </ul>
          )}
        </li>
      );
    });
  return (
    <div data-buzz-ui="" className={styles.panel} aria-busy={!!busy}>
      <PanelHeader
        title={
          <PanelHeaderLabel
            title={t("v1wf.todo.title")}
            icon={<ListChecksIcon size="1rem" />}
          >
            <span
              className={`${styles.channel} text-caption text-secondary`}
              title={context.channelName}
            >
              {context.channelName}
            </span>
          </PanelHeaderLabel>
        }
        actions={
          <>
            <span role="status" className="sr-only">
              {saveStatus}
            </span>
            <PopoverRoot>
              <PopoverTrigger
                render={
                  <IconButton
                    size="sm"
                    icon={<InfoIcon size="1rem" aria-hidden="true" />}
                    aria-label={t("v1wf.todo.about")}
                    aria-description={saveStatus}
                    title={t("v1wf.todo.about")}
                  />
                }
              />
              <PopoverPopup align="end">
                <PopoverTitle>{saveStatus}</PopoverTitle>
                <PopoverDescription>
                  {readOnly
                    ? t("v1wf.todo.aboutReadOnly")
                    : t("v1wf.todo.aboutEditable")}
                </PopoverDescription>
              </PopoverPopup>
            </PopoverRoot>
            <IconButton
              hint="familiar"
              ref={refreshRef}
              size="sm"
              icon={<ArrowsClockwiseIcon size="1rem" aria-hidden="true" />}
              aria-label={t("v1wf.todo.refresh")}
              title={t("v1wf.todo.refreshTodos")}
              loading={busy === "load"}
              disabled={!!busy}
              onClick={() => {
                if (loaded && (dirty || draft.input)) {
                  setConfirmRefresh(true);
                  return;
                }
                void load(loaded);
              }}
            />
            <IconButton
              hint="familiar"
              size="sm"
              variant="ghost"
              icon={<XIcon size="1rem" aria-hidden="true" />}
              aria-label={t("v1wf.todo.hide")}
              title={t("v1wf.todo.hide")}
              onClick={close}
            />
          </>
        }
      />
      <div className={styles.scroll}>
        <div className={styles.content}>
          <form
            className={styles.add}
            onSubmit={(event) => {
              event.preventDefault();
              if (
                !active() ||
                disabled ||
                saving.current ||
                !draft.input.trim()
              )
                return;
              try {
                const next = {
                  ...draft,
                  content: addTodo(draft.content, draft.input),
                  input: "",
                };
                focusAfterToggle.current = `${prefix}-new`;
                update(next);
                void save(next);
              } catch (reason) {
                setError(String(reason));
              }
            }}
          >
            <Field label={t("v1wf.todo.new")} labelVisibility="hidden">
              <Input
                id={`${prefix}-new`}
                placeholder={t("v1wf.todo.addPlaceholder")}
                value={draft.input}
                disabled={inputDisabled}
                onChange={(event) =>
                  update({ ...latestDraft.current, input: event.target.value })
                }
              />
            </Field>
            <Button
              type="submit"
              size="md"
              variant="prominent"
              disabled={disabled || !draft.input.trim()}
            >
              {t("v1wf.todo.add")}
            </Button>
          </form>
          {(error || parseError || (dirty && !busy)) && (
            <div className={styles.feedback}>
              {message && (
                <p role="alert" className="text-body-sm text-secondary">
                  {message}
                </p>
              )}
              {restored && readOnly && (
                <p role="status" className="text-body-sm text-secondary">
                  {t("v1wf.todo.localDraft")}
                </p>
              )}
              {conflict && !busy && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmRefresh(true)}
                >
                  {t("v1wf.todo.refreshTodos")}
                </Button>
              )}
              {retryable && !readOnly && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={disabled}
                  onClick={() => void save()}
                >
                  {t("v1wf.todo.retry")}
                </Button>
              )}
            </div>
          )}
          {(namesError || list.error || !members) && (
            <div className="text-caption text-secondary">
              {!members || list.error
                ? t("v1wf.todo.membersUnavailable")
                : t("v1wf.todo.namesUnavailable")}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (!active()) return;
                  people.channels.refreshList?.();
                  setNamesRetry((value) => value + 1);
                }}
              >
                {t("v1wf.todo.retryUsers")}
              </Button>
            </div>
          )}
          {!canvas.available && (
            <p className="text-body-sm text-secondary">
              {t("v1wf.todo.noCanvas")}
            </p>
          )}
          {readOnly && (
            <p role="status" className="text-body-sm text-secondary">
              {t("v1wf.todo.readOnly")}
            </p>
          )}
          {!loaded ? (
            <p role="status" className="text-body-sm text-secondary">
              {busy ? t("v1wf.todo.loading") : t("v1wf.todo.loadFailed")}
            </p>
          ) : (
            !parseError && (
              <>
                {items.length === 0 && (
                  <EmptyState
                    icon={<ListChecksIcon />}
                    title={t("v1wf.todo.none")}
                    description={
                      readOnly ? undefined : t("v1wf.todo.emptyDescription")
                    }
                  />
                )}
                {statuses.map((status) => {
                  const title = statusLabel(status);
                  const group = (childrenByOffset.get(undefined) ?? []).filter(
                    (item) => item.status === status,
                  );
                  return (
                    group.length > 0 && (
                      <section
                        key={status}
                        className={styles.group}
                        aria-label={title}
                      >
                        <h3 className={`${styles.groupHeading} text-label-sm`}>
                          {title}
                          <span className={styles.groupCount}>
                            {group.length}
                          </span>
                        </h3>
                        <ul className={styles.list}>{renderItems(group)}</ul>
                      </section>
                    )
                  );
                })}
              </>
            )
          )}
        </div>
      </div>
      {confirmRefresh && (
        <AlertDialog
          title={t("v1wf.todo.discardTitle")}
          description={t("v1wf.todo.discardDescription")}
          finalFocus={refreshRef}
          onClose={() => setConfirmRefresh(false)}
          actions={
            <>
              <Button onClick={() => setConfirmRefresh(false)}>
                {t("v1wf.todo.keepEditing")}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setConfirmRefresh(false);
                  void load(true);
                }}
              >
                {t("v1wf.todo.discardRefresh")}
              </Button>
            </>
          }
        />
      )}
    </div>
  );
}
