import {
  localMessage,
  resolveMessage,
  type DisplayMessage,
} from "../shared/i18n/deferred-message";
import { t, useLanguage, english, type TranslationKey } from "../shared/i18n";
import { SettingsGroup } from "../shared/design-system/ui/SettingsGroup";
import { IconButton } from "../shared/design-system/ui/IconButton";
import { PencilSimpleIcon, XIcon } from "../shared/design-system/icons";
import { PreferenceRow } from "../shared/design-system/ui/PreferenceRow";
import { SwitchPreferenceRow } from "../shared/design-system/ui/SwitchPreferenceRow";
import { Header, InlineHeader } from "../shared/design-system/ui/Header";
import {
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { isTauri } from "@tauri-apps/api/core";
import { Button } from "../shared/design-system/ui/Button";
import {
  sameBinding,
  type KeyBinding,
  type NormalizedShortcut,
} from "../features/shortcuts/bindings";
import { formatBinding, isApplePlatform } from "../features/shortcuts/format";
import {
  composerFormats,
  formatBindings,
  linkBindings,
} from "../features/messages/composer-dom";
import { KeyCombo } from "../features/shortcuts/KeyCombo";
import {
  KeyCaptureControl,
  type CapturedChord,
} from "../features/shortcuts/KeyCaptureControl";
import type { ShortcutBindings } from "../features/shortcuts/preferences";
import type { ShortcutsService } from "../features/shortcuts/service";
import {
  sendKeyPreference,
  useSendWithModEnterPreference,
} from "../features/messages/send-key-preference";
import type { PluginManager } from "../plugins/manager";
import { editKeyPreference } from "../features/messages/edit-key-preference";

type Row = Readonly<{
  key: string;
  title: string;
  owner: string;
  /** Owner-defined presentation order within the Settings category. */
  order: number;
  /** Native close/quit defaults are reserved, not user-rebindable. */
  readOnly: boolean;
  defaults: readonly KeyBinding[];
  override: KeyBinding | undefined;
  effective: readonly KeyBinding[];
}>;
type Group = Readonly<{
  id: string;
  label: string;
  /** Stable owner identity for equal display labels. */
  sortKey: string;
  /** Said once under the heading; its read-only rows then need no note each. */
  description?: string;
  rows: readonly Row[];
}>;
type Notice = Readonly<{
  key: string;
  tone: "error" | "warning";
  message: DisplayMessage;
  conflict?: Readonly<{
    chord: string;
    row: Pick<Row, "key" | "title" | "owner">;
  }>;
}>;

const shortcutLabels = {
  "focus-composer": "settings.shortcut.focus-composer",
  "focus-pane": "settings.shortcut.focus-pane",
  "focus-main-pane": "settings.shortcut.focus-main-pane",
  "focus-side-pane": "settings.shortcut.focus-side-pane",
  "set-status": "settings.shortcut.set-status",
  settings: "settings.shortcut.settings",
  "app-reload": "settings.shortcut.app-reload",
  "close-tab": "settings.shortcut.close-tab",
  "edit-message": "settings.shortcut.edit-message",
  "react-to-message": "settings.shortcut.react-to-message",
  "reply-to-message": "settings.shortcut.reply-to-message",
  "mark-message-unread": "settings.shortcut.mark-message-unread",
  "delete-message": "settings.shortcut.delete-message",
  "react-to-latest": "settings.shortcut.react-to-latest",
  home: "settings.shortcut.home",
  "shortcuts-help": "settings.shortcut.shortcuts-help",
  "navigation-back": "settings.shortcut.navigation-back",
  "navigation-forward": "settings.shortcut.navigation-forward",
  "font-increase": "settings.shortcut.font-increase",
  "font-decrease": "settings.shortcut.font-decrease",
  "font-reset": "settings.shortcut.font-reset",
  "mark-all-read": "settings.shortcut.mark-all-read",
  new: "navigation.openNew",
  "global-search": "search.buzz",
  "conversation-search": "search.conversationSearch",
  "editor:Bold": "messages.format.bold",
  "editor:Italic": "messages.format.italic",
  "editor:Strikethrough": "messages.format.strike",
  "editor:Spoiler": "messages.format.spoiler",
  "editor:Code": "messages.format.code",
  "editor:Code block": "messages.format.codeBlock",
  "editor:Bullet list": "messages.format.bullets",
  "editor:Ordered list": "messages.format.ordered",
  "editor:Quote": "messages.format.quote",
  "editor:Add or edit link": "settings.shortcut.link",
  "editor:Undo": "settings.shortcut.undo",
  "editor:Redo": "settings.shortcut.redo",
  "editor:Send message": "settings.shortcut.send",
  "editor:New line": "settings.shortcut.newline",
} as const satisfies Readonly<Record<string, TranslationKey>>;

function shortcutTitle(row: Pick<Row, "key" | "title">) {
  const key = Object.entries(shortcutLabels).find(
    ([key]) => key === row.key,
  )?.[1];
  return key && english[key] === row.title ? t(key) : row.title;
}
function shortcutOwner(row: Pick<Row, "key" | "owner" | "title">) {
  return row.owner === "Message formatting" &&
    row.key.startsWith("editor:") &&
    shortcutTitle(row) !== row.title
    ? t("settings.messageFormatting")
    : row.owner;
}

/** The message editor's own keys, shown read-only: it handles them before any shortcut. */
const editorRows = (sendWithModEnter: boolean): readonly Row[] =>
  [
    ...composerFormats.map((format) => ({
      title: format.label,
      bindings: formatBindings(format),
    })),
    { title: "Add or edit link", bindings: linkBindings },
    { title: "Undo", bindings: [{ key: "z", mod: true }] },
    {
      title: "Redo",
      bindings: [
        { key: "z", mod: true, shift: true },
        { key: "y", mod: true },
      ],
    },
    {
      title: "Send message",
      bindings: [
        sendWithModEnter ? { key: "Enter", mod: true } : { key: "Enter" },
      ],
    },
    {
      title: "New line",
      bindings: sendWithModEnter
        ? [{ key: "Enter" }, { key: "Enter", shift: true }]
        : [{ key: "Enter", shift: true }],
    },
  ].map(({ title, bindings }, order) => ({
    key: `editor:${title}`,
    title,
    owner: "Message formatting",
    order,
    readOnly: true,
    defaults: bindings,
    override: undefined,
    effective: bindings,
  }));
const EDITOR_FORMAT_CHORDS = editorRows(false).flatMap((row) => row.effective);

/** Chords the message editor handles locally before the window dispatcher: undo/redo and line/document jumps. */
const EDITOR_CHORDS: readonly KeyBinding[] = [
  { key: "z", mod: true },
  { key: "z", mod: true, shift: true },
  { key: "y", mod: true },
  { key: "y", mod: true, shift: true },
  { key: "Home", mod: true },
  { key: "Home", mod: true, shift: true },
  { key: "End", mod: true },
  { key: "End", mod: true, shift: true },
];
/** Copy, paste, cut and select all: a matching shortcut would preventDefault them everywhere. */
const CLIPBOARD_CHORDS: readonly KeyBinding[] = [
  { key: "c", mod: true },
  { key: "v", mod: true },
  { key: "v", mod: true, shift: true },
  { key: "x", mod: true },
  { key: "a", mod: true },
];
/** Switch tab, close tab and quit: the desktop shell owns these, so they stay fixed. */
const DESKTOP_CHORDS: readonly KeyBinding[] = [
  { key: "q", mod: true },
  { key: "w", mod: true },
  { key: "Tab", mod: true },
  { key: "Tab", mod: true, shift: true },
];
// Common shifted pairs. Aliases for one physical key (⌘= and ⌘+) exist so
// the chord works on every layout; the row shows that key once.
const SHIFTED: Readonly<Record<string, string>> = {
  "=": "+",
  "-": "_",
  "\\": "|",
  "/": "?",
  ",": "<",
  ".": ">",
  ";": ":",
  "'": '"',
  "[": "{",
  "]": "}",
  "`": "~",
};
const physicalKey = (key: string) =>
  Object.entries(SHIFTED).find((pair) => pair.includes(key))?.[0];
const sameKeyOnLayout = (a: KeyBinding, b: KeyBinding) =>
  !!a.mod === !!b.mod &&
  !!a.ctrl === !!b.ctrl &&
  !!a.alt === !!b.alt &&
  physicalKey(a.key) !== undefined &&
  physicalKey(a.key) === physicalKey(b.key);
/** The distinct chords to show: each physical key once, in registration order. */
const shownChords = (chords: readonly KeyBinding[]) =>
  chords.filter(
    (chord, index) =>
      !chords
        .slice(0, index)
        .some((earlier) => sameKeyOnLayout(earlier, chord)),
  );
const includes = (chords: readonly KeyBinding[], binding: KeyBinding) =>
  chords.some((chord) => sameBinding(chord, binding));
/** Every owner supplies order; identity and title make ties deterministic. */
const byPresentation = (a: Row, b: Row) =>
  a.order - b.order ||
  a.key.localeCompare(b.key) ||
  a.title.localeCompare(b.title);

/**
 * Every listed shortcut, grouped as Settings shows them: host,
 * then plugins by name, then the editor's read-only keys. `rows` are only the
 * dispatcher's, which are the ones that can conflict or be rebound.
 */
function useShortcutGroups({
  shortcuts,
  bindings,
  plugins,
  desktop = isTauri(),
}: {
  shortcuts: ShortcutsService;
  bindings: ShortcutBindings;
  plugins: Pick<PluginManager, "subscribe" | "snapshot">;
  desktop?: boolean;
}) {
  const host = useSyncExternalStore(
    shortcuts.hostSubscribe,
    shortcuts.hostSnapshot,
  );
  const contributed = useSyncExternalStore(
    shortcuts.subscribe,
    shortcuts.snapshot,
  );
  const { overrides, error } = useSyncExternalStore(
    bindings.subscribe,
    bindings.snapshot,
  );
  const { configuration } = useSyncExternalStore(
    plugins.subscribe,
    plugins.snapshot,
  );
  const sendWithModEnter = useSendWithModEnterPreference();

  const pluginName = (id: string) =>
    (configuration.status === "ready"
      ? configuration.catalog.plugins.find(
          (plugin) => plugin.manifest.id === id,
        )?.manifest.name
      : undefined) ?? id;
  const row = (
    key: string,
    shortcut: NormalizedShortcut,
    owner: string,
    readOnly = false,
  ): Row => {
    const override = overrides[key];
    return {
      key,
      title: shortcut.title,
      owner,
      order: shortcut.order,
      readOnly,
      defaults: shortcut.binding,
      override,
      effective: override ? [override] : shortcut.binding,
    };
  };
  // Group ids are namespaced so a plugin whose manifest id is "buzz" or "host"
  // cannot share a React key with the host group.
  const groups: Group[] = [
    {
      id: "host",
      label: "Buzz",
      sortKey: "",
      rows: host.map((shortcut) =>
        row(
          shortcut.id,
          shortcut,
          "Buzz",
          desktop &&
            shortcut.binding.some((binding) =>
              includes(DESKTOP_CHORDS, binding),
            ),
        ),
      ),
    },
    ...[...new Set(contributed.map((shortcut) => shortcut.pluginId))]
      .map((pluginId) => {
        const label = pluginName(pluginId);
        return {
          id: `plugin:${pluginId}`,
          label,
          sortKey: pluginId,
          rows: contributed
            .filter((shortcut) => shortcut.pluginId === pluginId)
            .map((shortcut) => row(shortcut.key, shortcut, label)),
        };
      })
      .sort(
        (a, b) =>
          a.label.localeCompare(b.label) || a.sortKey.localeCompare(b.sortKey),
      ),
  ]
    .map((group) => ({
      ...group,
      rows: [...group.rows].sort(byPresentation),
    }))
    .filter((group) => group.rows.length);
  const rows = groups.flatMap((group) => group.rows);
  // Listed after the rows that can conflict: the editor keeps these while typing.
  const shownGroups: Group[] = [
    ...groups,
    {
      id: "editor",
      label: "Message formatting",
      sortKey: "editor",
      description:
        "Built into the message editor. These work while you type and can't be changed.",
      rows: editorRows(sendWithModEnter),
    },
  ];
  return { overrides, error, rows, shownGroups };
}

/** A row's distinct chords, "⌘K or ⌘T". */
function ShortcutChords({
  chords,
  apple,
}: {
  chords: readonly KeyBinding[];
  apple: boolean;
}) {
  useLanguage();
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-body-sm text-subtle">
      {shownChords(chords).map((binding, index) => (
        <Fragment key={formatBinding(binding, apple).text}>
          {index > 0 && <span>{t("settings.or")}</span>}
          <KeyCombo binding={binding} apple={apple} />
        </Fragment>
      ))}
    </span>
  );
}

/**
 * Lists every host binding and every active plugin contribution from the live
 * dispatcher registry, so the page cannot drift from what actually fires.
 * Overrides are keyed by the registry's own identity: host id or `pluginId/id`.
 */
export function ShortcutSettings({
  shortcuts,
  bindings,
  plugins,
  apple = isApplePlatform(navigator.platform),
  desktop = isTauri(),
}: {
  shortcuts: ShortcutsService;
  bindings: ShortcutBindings;
  /** Display names for plugin groups come from the catalog. */
  plugins: Pick<PluginManager, "subscribe" | "snapshot">;
  apple?: boolean;
  /** Packaged desktop build, where close/quit chords belong to the shell. */
  desktop?: boolean;
}) {
  useLanguage();
  const { overrides, error, rows, shownGroups } = useShortcutGroups({
    shortcuts,
    bindings,
    plugins,
    desktop,
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const sendChord = apple ? "⌘ Enter" : "Ctrl+Enter";
  // A chord can become shared after capture (a plugin enabled later, a new
  // default in a release). The dispatcher then picks one silently, so each
  // affected row names the others.
  const sharedWith = (target: Row) =>
    rows.filter(
      (other) =>
        other.key !== target.key &&
        other.effective.some((binding) =>
          target.effective.some((current) => sameBinding(current, binding)),
        ),
    );
  const modified = Object.keys(overrides).length > 0;

  const start = (key: string) => {
    setEditing(key);
    setNotice(null);
  };
  const cancel = (key: string) => {
    setEditing((current) => (current === key ? null : current));
    setNotice((current) =>
      current?.key === key && current.tone === "error" ? null : current,
    );
  };
  // Conflicts are decided here, not in the dispatcher: host chords always win
  // there, and plugin ties resolve by sorted key, neither of which is a choice.
  const capture = (
    target: Row,
    { binding, otherPrimary, code }: CapturedChord,
  ) => {
    const chord = formatBinding(binding, apple).text;
    const refuse = (message: DisplayMessage) =>
      setNotice({ key: target.key, tone: "error", message });
    if (binding.key === "Dead" || binding.key === "Unidentified")
      return refuse(localMessage("settings.invalidShortcut"));
    if (otherPrimary) return refuse(localMessage("settings.wrongPrimary"));
    if (!binding.mod && !binding.alt)
      return refuse(
        localMessage(
          apple
            ? "settings.includeMacModifier"
            : "settings.includeOtherModifier",
        ),
      );
    // Apple's ⌥⇧⌘V browser paste types a layout-specific key, so match the physical V.
    const applePlainPaste =
      apple &&
      code === "KeyV" &&
      binding.mod &&
      binding.shift &&
      binding.alt &&
      !binding.ctrl;
    if (includes(CLIPBOARD_CHORDS, binding) || applePlainPaste)
      return refuse(localMessage("settings.clipboardReserved", { chord }));
    if (desktop && includes(DESKTOP_CHORDS, binding))
      return refuse(localMessage("settings.desktopReserved", { chord }));
    const conflict = rows.find(
      (row) =>
        row.key !== target.key &&
        row.effective.some((current) => sameBinding(current, binding)),
    );
    if (conflict)
      return setNotice({
        key: target.key,
        tone: "error",
        message: "",
        conflict: {
          chord,
          row: {
            key: conflict.key,
            title: conflict.title,
            owner: conflict.owner,
          },
        },
      });
    const isDefault =
      target.defaults.length === 1 &&
      target.defaults.every((current) => sameBinding(current, binding));
    bindings.set(target.key, isDefault ? null : binding);
    setEditing(null);
    // EditableInput handles Enter locally regardless of the held modifiers.
    setNotice(
      binding.key === "Enter" ||
        includes(EDITOR_CHORDS, binding) ||
        includes(EDITOR_FORMAT_CHORDS, binding)
        ? {
            key: target.key,
            tone: "warning",
            message: localMessage("settings.editorWins", { chord }),
          }
        : null,
    );
  };

  return (
    <section aria-labelledby="shortcut-settings-title">
      <Header id="shortcut-settings-title" title={t("settings.shortcuts")} />
      <div className="grid gap-5">
        <MessageKeyPreference
          title={t("settings.sendingMessages")}
          label={t("settings.sendWith", { chord: sendChord })}
          description={t("settings.sendDescription", { chord: sendChord })}
          preference={sendKeyPreference}
        />
        <MessageKeyPreference
          title={t("settings.editingMessages")}
          label={t("settings.editUpArrow")}
          description={t("settings.editUpArrowDescription")}
          preference={editKeyPreference}
        />
        {rows.length ? (
          <div className="grid gap-section-gap">
            {shownGroups.map((group) => (
              <section key={group.id}>
                <InlineHeader
                  title={
                    group.id === "editor"
                      ? t("settings.messageFormatting")
                      : group.label
                  }
                  subtitle={
                    group.id === "editor"
                      ? t("settings.editorKeysDescription")
                      : group.description
                  }
                />
                <SettingsGroup>
                  {group.rows.map((row) => (
                    <ShortcutRow
                      key={row.key}
                      row={row}
                      explained={!!group.description}
                      apple={apple}
                      sharedWith={sharedWith(row)}
                      listening={editing === row.key}
                      notice={notice?.key === row.key ? notice : null}
                      onStart={() => start(row.key)}
                      onCancel={() => cancel(row.key)}
                      onCapture={(chord) => capture(row, chord)}
                      onReset={() => {
                        cancel(row.key);
                        setNotice(null);
                        bindings.set(row.key, null);
                      }}
                    />
                  ))}
                </SettingsGroup>
              </section>
            ))}
          </div>
        ) : (
          <p className="m-0 px-control-inset text-body-sm text-subtle">
            {t("settings.noShortcuts")}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            disabled={!modified}
            onClick={() => {
              setEditing(null);
              setNotice(null);
              bindings.reset();
            }}
          >
            {t("settings.resetAllShortcuts")}
          </Button>
        </div>
        {error && (
          <div role="alert" className="grid gap-3 text-body-sm text-standard">
            <p className="m-0">{error}</p>
            <div>
              <Button type="button" onClick={bindings.retry}>
                {t("settings.retryShortcuts")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function MessageKeyPreference({
  title,
  label,
  description,
  preference,
}: {
  title: string;
  label: string;
  description: string;
  preference: typeof sendKeyPreference;
}) {
  useLanguage();
  const checked = preference.usePreference();
  const [error, setError] = useState<string | null>(null);
  const change = (enabled: boolean) => setError(preference.set(enabled));
  return (
    <section>
      <InlineHeader title={title} />
      <SettingsGroup>
        <SwitchPreferenceRow
          label={label}
          description={description}
          checked={checked}
          onCheckedChange={change}
        />
      </SettingsGroup>
      {error && (
        <div role="alert" className="grid gap-3 text-body-sm text-standard">
          <p className="m-0">{error}</p>
          <div>
            <Button type="button" onClick={() => change(checked)}>
              {t("settings.retrySaving")}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function ShortcutRow({
  row,
  explained,
  apple,
  sharedWith,
  listening,
  notice,
  onStart,
  onCancel,
  onCapture,
  onReset,
}: {
  row: Row;
  /** Its section already says why read-only rows can't change. */
  explained: boolean;
  apple: boolean;
  /** Other listed shortcuts whose effective chord this row also answers to. */
  sharedWith: readonly Row[];
  listening: boolean;
  notice: Notice | null;
  onStart: () => void;
  onCancel: () => void;
  onCapture: (chord: CapturedChord) => void;
  onReset: () => void;
}) {
  useLanguage();
  const title = shortcutTitle(row);
  const titleId = useId();
  const noticeId = useId();
  const change = useRef<HTMLButtonElement>(null);
  const wasListening = useRef(listening);
  const resetting = useRef(false);
  // Return focus to the row's action when the capture control or the Reset
  // button goes away without the person having moved focus somewhere else.
  useEffect(() => {
    const stopped = wasListening.current && !listening;
    wasListening.current = listening;
    if (
      (stopped || (resetting.current && !row.override)) &&
      document.activeElement === document.body
    )
      change.current?.focus();
    resetting.current = false;
  }, [listening, row.override]);
  return (
    <article aria-labelledby={titleId}>
      <PreferenceRow
        title={
          <h4 id={titleId} className="m-0 text-label-sm">
            {title}
          </h4>
        }
        subtitle={
          row.readOnly ? (
            explained ? undefined : (
              t("settings.reservedBuzz")
            )
          ) : row.override || sharedWith.length > 0 ? (
            <>
              {row.override && (
                <span className="block">{t("settings.modified")}</span>
              )}
              {sharedWith.length > 0 && (
                <span className="block text-subtle">
                  {t("settings.alsoUsed", {
                    shortcuts: sharedWith
                      .map(
                        (other) =>
                          `${shortcutTitle(other)} (${shortcutOwner(other)})`,
                      )
                      .join(", "),
                  })}
                </span>
              )}
            </>
          ) : undefined
        }
        trailing={
          <>
            {listening ? (
              <KeyCaptureControl
                apple={apple}
                label={t("settings.newShortcut", { title })}
                describedBy={notice ? noticeId : undefined}
                onCapture={onCapture}
                onCancel={onCancel}
              />
            ) : (
              <ShortcutChords chords={row.effective} apple={apple} />
            )}
            {!row.readOnly && (
              <IconButton
                variant="ghost"
                icon={
                  listening ? (
                    <XIcon size={16} aria-hidden="true" />
                  ) : (
                    <PencilSimpleIcon size={16} aria-hidden="true" />
                  )
                }
                title={t(
                  listening ? "settings.cancel" : "settings.changeShortcut",
                )}
                ref={change}
                type="button"
                size="sm"
                aria-label={
                  listening
                    ? t("settings.cancelChanging", { title })
                    : t("settings.changeShortcutFor", { title })
                }
                // Keep focus on the listening control so a click here cancels once.
                onMouseDown={(event) => event.preventDefault()}
                onClick={listening ? onCancel : onStart}
              />
            )}
            {row.override && !listening && (
              <Button
                type="button"
                size="sm"
                aria-label={t("settings.resetShortcutFor", { title })}
                onClick={() => {
                  resetting.current = true;
                  onReset();
                }}
              >
                {t("settings.reset")}
              </Button>
            )}
          </>
        }
      />
      {notice && (
        <p
          id={noticeId}
          role="alert"
          className="m-0 text-body-sm text-standard"
        >
          {notice.conflict
            ? t("settings.shortcutConflict", {
                chord: notice.conflict.chord,
                title: shortcutTitle(notice.conflict.row),
                owner: shortcutOwner(notice.conflict.row),
              })
            : resolveMessage(notice.message)}
        </p>
      )}
    </article>
  );
}
