import { t, useLanguage } from "../../shared/i18n";
import { rich } from "../../shared/i18n/rich";
import {
  localMessage,
  localError,
  errorMessage,
  resolveMessage,
  type LocalMessage,
  type DisplayMessage,
} from "../../shared/i18n/deferred-message";
import { SettingsGroup } from "../../shared/design-system/ui/SettingsGroup";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { RelayData } from "../../features/relay/service";
import type { RelaySession } from "../../features/relay/session";
import { useRelayConnection } from "../../features/relay/react";
import {
  normalizeShortcode,
  suggestShortcode,
} from "../../features/relay/emoji";
import { prepareAttachment } from "../../features/messages/prepare-attachment";
import { Button } from "../../shared/design-system/ui/Button";
import { EmptyState } from "../../shared/design-system/ui/EmptyState";
import { SmileyIcon, TrashIcon } from "../../shared/design-system/icons";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import { SearchField } from "../../shared/design-system/ui/SearchField";
import { Field } from "../../shared/design-system/ui/Field";
import { Header, InlineHeader } from "../../shared/design-system/ui/Header";
import { Input } from "../../shared/design-system/ui/Input";
import { InputGroup } from "../../shared/design-system/ui/InputGroup";
import { Tabs } from "../../shared/design-system/ui/Tabs";
import { ToastNotice } from "../../shared/design-system/ui/Toast";
import { CustomEmoji } from "./CustomEmoji";
import styles from "./Emoji.module.css";

const message = (reason: unknown, fallback: LocalMessage): DisplayMessage =>
  reason instanceof Error && reason.message ? errorMessage(reason) : fallback;

/** Desktop's custom emoji card: each member adds to their own kind-30030 set. */
export function CustomEmojiSettings({
  relay,
  active,
}: {
  relay: RelayData;
  active(): boolean;
}) {
  useLanguage();
  const connection = useRelayConnection(relay);
  return (
    <section aria-labelledby="custom-emoji-settings-title">
      <Header
        id="custom-emoji-settings-title"
        title={t("customEmoji.title")}
        subtitle={rich("customEmoji.subtitle", { code: <code>:name:</code> })}
      />
      {connection.status === "ready" && (
        <Editor
          key={`${connection.scope}:${connection.generation}`}
          session={connection.session}
          active={active}
        />
      )}
    </section>
  );
}

function Editor({
  session,
  active,
}: {
  session: RelaySession;
  active(): boolean;
}) {
  useLanguage();
  const catalog = useSyncExternalStore(
    session.emoji.subscribe,
    session.emoji.snapshot,
  );
  const { add, upload, remove } = session.emoji;
  const canAuthor = Boolean(add && upload);
  const [tab, setTab] = useState<"add" | "mine" | "community">(
    canAuthor ? "add" : "mine",
  );
  const [query, setQuery] = useState("");
  const [removing, setRemoving] = useState<string>();
  const [removeError, setRemoveError] = useState<DisplayMessage>("");
  const [removed, setRemoved] = useState<string>();
  const browseRef = useRef<HTMLFieldSetElement>(null);
  const removeFocus = useRef<HTMLButtonElement | null>(null);
  const [name, setName] = useState("");
  const [image, setImage] = useState<{ url: string; filename: string }>();
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<DisplayMessage>("");
  const [added, setAdded] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  const uploadButton = useRef<HTMLButtonElement>(null);
  const saveButton = useRef<HTMLButtonElement>(null);
  const pendingFocus = useRef(false);
  const actionsRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    return () => {
      if (node.contains(document.activeElement)) pendingFocus.current = true;
    };
  }, []);
  const uploadRef = useCallback((node: HTMLButtonElement | null) => {
    uploadButton.current = node;
    if (!node) return;
    return () => {
      if (node === document.activeElement) pendingFocus.current = true;
    };
  }, []);
  useLayoutEffect(() => {
    // Upload, Clear, Save, and the empty-state action replace focused controls.
    // Focus Upload after it mounts/enables; ordinary tab switches keep tab focus.
    if (pendingFocus.current) uploadButton.current?.focus();
    pendingFocus.current = false;
    const trigger = removeFocus.current;
    if (trigger && !removing) {
      if (
        document.activeElement === document.body ||
        document.activeElement === trigger
      )
        (trigger.isConnected ? trigger : browseRef.current)?.focus();
      removeFocus.current = null;
    }
  });
  const nameRef = useRef(name);
  nameRef.current = name;
  const uploadController = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    void session.emoji.ensure();
    return () => {
      mounted.current = false;
      uploadController.current?.abort();
    };
  }, [session]);
  const live = () => mounted.current && active();
  const normalized = normalizeShortcode(name);
  const nameInvalid = name.trim().length > 0 && !normalized;
  const replacing =
    !!normalized && catalog.mine.some((e) => e.shortcode === normalized);
  const canSubmit =
    !!add && !!image && !!normalized && !uploading && !saving && !removing;

  async function choose(file: File) {
    if (!upload || uploading || saving || removing || !live()) return;
    const controller = new AbortController();
    uploadController.current = controller;
    setUploading(true);
    setError("");
    try {
      if (!file.type.startsWith("image/"))
        throw localError("customEmoji.invalidImage");
      const prepared = await prepareAttachment(file, controller.signal);
      const result = await upload(prepared, controller.signal);
      if (!live()) return;
      if (!result.type.startsWith("image/"))
        throw localError("customEmoji.invalidImage");
      setImage({ url: result.url, filename: file.name });
      const suggested = suggestShortcode(file.name);
      if (suggested && !nameRef.current.trim()) setName(suggested);
    } catch (reason) {
      if (!controller.signal.aborted && live())
        setError(message(reason, localMessage("customEmoji.uploadFailed")));
    } finally {
      if (uploadController.current === controller)
        uploadController.current = null;
      if (live()) setUploading(false);
    }
  }

  async function save() {
    if (!add || !image || !normalized || !canSubmit) return;
    setSaving(true);
    setError("");
    setAdded(undefined);
    try {
      const stored = await add(normalized, image.url);
      if (!live()) return;
      setName("");
      setImage(undefined);
      setAdded(stored);
    } catch (reason) {
      if (live())
        setError(message(reason, localMessage("customEmoji.addFailed")));
    } finally {
      if (live()) setSaving(false);
    }
  }

  async function removeEmoji(shortcode: string, trigger: HTMLButtonElement) {
    if (!remove || removing || saving || !live()) return;
    if (document.activeElement === trigger) removeFocus.current = trigger;
    setRemoving(shortcode);
    setRemoveError("");
    setRemoved(undefined);
    try {
      await remove(shortcode);
      if (live()) setRemoved(shortcode);
    } catch (reason) {
      if (live())
        setRemoveError(
          message(reason, localMessage("customEmoji.removeFailed")),
        );
    } finally {
      if (live()) setRemoving(undefined);
    }
  }

  const preview = image && session.media(image.url);
  const uploadAction = (
    <Button
      ref={uploadRef}
      loading={uploading}
      disabled={saving || !!removing}
      onClick={() => input.current?.click()}
    >
      {uploading
        ? t("customEmoji.uploading")
        : image
          ? t("customEmoji.chooseDifferent")
          : t("customEmoji.uploadImage")}
    </Button>
  );
  const addPanel = canAuthor ? (
    <form
      aria-label={t("customEmoji.add")}
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) {
          saveButton.current?.focus();
          void save();
        }
      }}
    >
      <input
        ref={input}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-label={t("customEmoji.uploadImage")}
        accept="image/gif,image/png,image/jpeg,image/webp"
        disabled={uploading || saving}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void choose(file);
        }}
      />
      {image ? (
        <SettingsGroup layout="form">
          <div className="grid gap-2">
            <InlineHeader title={t("customEmoji.selectedImage")} />
            <div className="flex flex-wrap items-center gap-3">
              {preview && (
                <span className={styles.emojiPreview}>
                  <img
                    alt={t("customEmoji.preview")}
                    src={preview}
                    draggable={false}
                  />
                </span>
              )}
              <div className="grid min-w-0 gap-2">
                <p className="truncate text-body-sm">{image.filename}</p>
                {uploadAction}
              </div>
            </div>
          </div>
          <Field
            label={t("customEmoji.name")}
            description={t("customEmoji.nameHelp")}
            error={nameInvalid ? t("customEmoji.invalidName") : undefined}
          >
            <InputGroup leading=":" trailing=":">
              <Input
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="party-parrot"
                value={name}
                disabled={saving}
                onChange={(event) => setName(event.target.value)}
              />
            </InputGroup>
          </Field>
          {image && !nameInvalid && replacing && (
            <p className="text-body-sm text-muted">
              {t("customEmoji.replacing", { shortcode: normalized ?? "" })}
            </p>
          )}
          {error && (
            <p role="alert" className="error">
              {resolveMessage(error)}
            </p>
          )}
          {image && (
            <div
              ref={actionsRef}
              className="mt-2 flex flex-wrap items-center justify-end gap-3"
            >
              <Button
                disabled={uploading || saving}
                onClick={() => {
                  setName("");
                  setImage(undefined);
                  setError("");
                }}
              >
                {t("customEmoji.clear")}
              </Button>
              <Button
                ref={saveButton}
                type="submit"
                variant="primary"
                loading={saving}
                disabled={uploading || !!removing || !normalized}
              >
                {saving ? t("customEmoji.saving") : t("customEmoji.save")}
              </Button>
            </div>
          )}
        </SettingsGroup>
      ) : (
        <EmptyState
          icon={<SmileyIcon />}
          title={t("customEmoji.uploadTitle")}
          description={t("customEmoji.uploadHelp")}
          action={uploadAction}
        />
      )}
      {!image && error && (
        <p role="alert" className="error">
          {resolveMessage(error)}
        </p>
      )}
    </form>
  ) : null;
  const ownShortcodes = new Set(catalog.mine.map((emoji) => emoji.shortcode));
  const community = catalog.entries.filter(
    (emoji) => !ownShortcodes.has(emoji.shortcode),
  );
  const needle = query
    .trim()
    .toLowerCase()
    .replace(/^:+|:+$/g, "");
  function browsePanel(view: "mine" | "community") {
    const showingCommunity = view === "community";
    const entries = showingCommunity
      ? community.filter((emoji) => emoji.shortcode.includes(needle))
      : catalog.mine;
    return (
      <fieldset
        ref={showingCommunity ? undefined : browseRef}
        tabIndex={-1}
        aria-label={
          showingCommunity ? t("customEmoji.community") : t("customEmoji.mine")
        }
        className="grid min-w-0 gap-2"
      >
        {showingCommunity && (
          <div className={styles.emojiBrowseControls}>
            <SearchField
              label={t("customEmoji.searchLabel")}
              clearLabel={t("customEmoji.clearSearch")}
              placeholder={t("customEmoji.search")}
              value={query}
              onValueChange={setQuery}
            />
          </div>
        )}
        {!showingCommunity && removeError && (
          <p role="alert" className="error">
            {resolveMessage(removeError)}
          </p>
        )}
        {catalog.error && (
          <>
            <p role="alert">{catalog.error}</p>
            <Button onClick={() => void session.emoji.refresh()}>
              {t("customEmoji.retry")}
            </Button>
          </>
        )}
        {catalog.status === "error" ? null : catalog.status !== "ready" ? (
          <p className="text-body-sm text-muted">{t("customEmoji.loading")}</p>
        ) : !entries.length ? (
          showingCommunity ? (
            <EmptyState
              icon={<SmileyIcon />}
              title={t("customEmoji.noResults")}
              description={null}
            />
          ) : (
            <EmptyState
              icon={<SmileyIcon />}
              title={t("customEmoji.empty")}
              description={t("customEmoji.emptyHelp")}
              action={
                canAuthor && (
                  <Button
                    onClick={() => {
                      pendingFocus.current = true;
                      setTab("add");
                    }}
                  >
                    {t("customEmoji.add")}
                  </Button>
                )
              }
            />
          )
        ) : (
          <SettingsGroup>
            <ul className="grid gap-2 py-3">
              {entries.map((emoji) => (
                <li key={emoji.shortcode} className="flex items-center gap-3">
                  <CustomEmoji emoji={emoji} media={session.media} />
                  <span className="min-w-0 flex-1 truncate text-body-sm">
                    :{emoji.shortcode}:
                  </span>
                  {!showingCommunity && remove && (
                    <IconButton
                      aria-label={t("customEmoji.removeNamed", {
                        shortcode: emoji.shortcode,
                      })}
                      icon={<TrashIcon aria-hidden="true" />}
                      loading={removing === emoji.shortcode}
                      disabled={!!removing || saving}
                      onClick={(event) =>
                        void removeEmoji(emoji.shortcode, event.currentTarget)
                      }
                    />
                  )}
                </li>
              ))}
            </ul>
          </SettingsGroup>
        )}
      </fieldset>
    );
  }
  return (
    <>
      <Tabs
        label={t("customEmoji.title")}
        variant="panel"
        value={tab}
        onValueChange={setTab}
        items={[
          ...(canAuthor
            ? [{ value: "add" as const, label: t("customEmoji.add") }]
            : []),
          {
            value: "mine",
            label: catalog.mine.length
              ? t("customEmoji.mineCount", { count: catalog.mine.length })
              : t("customEmoji.mine"),
          },
          {
            value: "community",
            label: t("customEmoji.communityCount", { count: community.length }),
          },
        ]}
        renderPanel={(value) =>
          value === "add" ? addPanel : browsePanel(value)
        }
      />
      {added && (
        <ToastNotice
          title={t("customEmoji.added", { shortcode: added })}
          tone="success"
          timeout={5000}
          onDismiss={() => setAdded(undefined)}
        />
      )}
      {removed && (
        <ToastNotice
          title={t("customEmoji.removed", { shortcode: removed })}
          tone="success"
          timeout={5000}
          onDismiss={() => setRemoved(undefined)}
        />
      )}
    </>
  );
}
