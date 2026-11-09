import {
  localMessage,
  localError,
  errorMessage,
  resolveMessage,
  type DisplayMessage,
} from "../shared/i18n/deferred-message";
import { TranslatedMessage } from "../shared/i18n/Message";
import { t, useLanguage } from "../shared/i18n";
import { useRef, useState } from "react";
import { CommunityDialog } from "../features/communities/CommunityDialog";
import { CommunityRepositoriesSettings } from "./CommunityRepositoriesSettings";
import type { Communities, Membership } from "../features/communities/service";
import { communityDestination } from "../features/communities/destination";
import {
  COMMUNITY_NAME_MAX_LENGTH,
  communityDefaultName,
} from "../features/communities/names";
import { Header } from "../shared/design-system/ui/Header";
import { SettingsGroup } from "../shared/design-system/ui/SettingsGroup";
import { Field } from "../shared/design-system/ui/Field";
import { Input } from "../shared/design-system/ui/Input";
import { Button } from "../shared/design-system/ui/Button";
import { useToastNotification } from "../shared/design-system/ui/Toast";
import { writeClipboardText } from "../shared/clipboard";

/** Captured viewer/community; never saves into a newly selected destination. */
export function CommunityLocalSettings({
  communities,
  community,
  viewer,
}: {
  communities: Communities;
  community: Membership;
  viewer: string | undefined;
}) {
  useLanguage();
  const notify = useToastNotification();
  const address = communityDestination(community.id).url;
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState<DisplayMessage>("");
  const copyUrl = async () => {
    if (copying) return;
    setCopying(true);
    setCopyError("");
    try {
      await writeClipboardText(address);
      notify(
        <TranslatedMessage value={localMessage("settings.urlCopied")} />,
        "success",
      );
    } catch {
      setCopyError(localMessage("settings.urlCopyFailed"));
    } finally {
      setCopying(false);
    }
  };
  const [editingConnection, setEditingConnection] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<DisplayMessage>("");
  const [saved, setSaved] = useState(false);
  const value = draft ?? community.localName ?? "";
  const changed = value.trim() !== (community.localName ?? "");
  const save = (value: string) => {
    setSaved(false);
    try {
      if (!viewer) throw localError("settings.accountUnavailable");
      communities.setLocalName(community.id, viewer, value);
      setDraft(null);
      setError("");
      setSaved(true);
      if (nameInput.current?.form?.contains(document.activeElement))
        nameInput.current.focus();
    } catch (error) {
      setError(
        error instanceof Error
          ? errorMessage(error)
          : localMessage("settings.localNameSaveFailed"),
      );
    }
  };
  return (
    <section aria-labelledby="community-local-settings-title">
      <Header
        id="community-local-settings-title"
        title={t("settings.localSettings")}
        subtitle={t("settings.localDescription")}
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (changed) save(value);
        }}
      >
        <SettingsGroup layout="form">
          <Field
            label={t("settings.displayName")}
            description={t("settings.displayNameDescription")}
            error={resolveMessage(error)}
          >
            <Input
              ref={nameInput}
              value={value}
              placeholder={communityDefaultName(community)}
              maxLength={COMMUNITY_NAME_MAX_LENGTH}
              onValueChange={(value) => {
                setDraft(value);
                setError("");
                setSaved(false);
              }}
            />
          </Field>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              disabled={!community.localName && !draft}
              onClick={() => save("")}
            >
              {t("settings.resetName")}
            </Button>
            <Button
              type="button"
              disabled={draft === null}
              onClick={() => {
                setDraft(null);
                setError("");
                setSaved(false);
                nameInput.current?.focus();
              }}
            >
              {t("settings.cancel")}
            </Button>
            <Button type="submit" variant="primary" disabled={!changed}>
              {t("settings.save")}
            </Button>
          </div>
          {saved && (
            <p role="status" className="m-0 text-body-sm text-muted">
              {t("settings.localNameSaved")}
            </p>
          )}
        </SettingsGroup>
      </form>
      <CommunityRepositoriesSettings
        communities={communities}
        community={community.id}
        viewer={viewer}
      />
      <div className="mt-section-gap">
        <SettingsGroup layout="form">
          <Field
            label={t("settings.communityAddress")}
            description={t("settings.communityAddressDescription")}
          >
            <Input value={address} readOnly />
          </Field>
          {copyError && (
            <p role="alert" className="m-0 text-body-sm text-danger">
              {resolveMessage(copyError)}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              size="xs"
              loading={copying}
              onClick={() => void copyUrl()}
            >
              {t("settings.copyUrl")}
            </Button>
            <Button
              type="button"
              size="xs"
              disabled={!viewer || !communities.snapshot().relayAvailable}
              onClick={() => setEditingConnection(true)}
            >
              {t("settings.editConnection")}
            </Button>
          </div>
        </SettingsGroup>
      </div>
      {editingConnection && (
        <CommunityDialog
          communities={communities}
          mode="join"
          connectionFrom={address}
          close={() => setEditingConnection(false)}
        />
      )}
    </section>
  );
}
