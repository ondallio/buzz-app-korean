import { t, useLanguage } from "../../shared/i18n";
import { localMessage } from "../../shared/i18n/deferred-message";
import { TranslatedMessage } from "../../shared/i18n/Message";
import { useEffect, useEffectEvent, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { IconButton } from "../../shared/design-system/ui/IconButton";
import { useToastNotification } from "../../shared/design-system/ui/Toast";
import {
  ArrowsClockwiseIcon,
  CheckIcon,
  DownloadIcon,
} from "../../shared/design-system/icons";
import { useNativeDownload } from "./use-native-download";
import { isNativeMediaSource } from "./attachment-source";

const FAILURE_DURATION = 6000;
const kindKeys = {
  image: ["mediaViewing.download.image", "mediaViewing.download.retryImage"],
  video: ["mediaViewing.download.video", "mediaViewing.download.retryVideo"],
  audio: ["mediaViewing.download.audio", "mediaViewing.download.retryAudio"],
  "voice note": [
    "mediaViewing.download.voicenote",
    "mediaViewing.download.retryVoicenote",
  ],
} as const;

export function MediaDownloadAction({
  source,
  name = "",
  kind,
  compact = false,
  savedDuration = 4000,
  onFeedbackVisible,
}: {
  source: string;
  name?: string | undefined;
  kind: string;
  compact?: boolean;
  savedDuration?: number;
  onFeedbackVisible?: ((visible: boolean) => void) | undefined;
}) {
  if (!isNativeMediaSource(source)) return null;
  return (
    <NativeMediaDownload
      key={JSON.stringify([source, name, kind])}
      source={source}
      name={name}
      kind={kind}
      compact={compact}
      savedDuration={savedDuration}
      onFeedbackVisible={onFeedbackVisible}
    />
  );
}

function NativeMediaDownload({
  source,
  name,
  kind,
  compact,
  savedDuration,
  onFeedbackVisible,
}: {
  source: string;
  name: string;
  kind: string;
  compact: boolean;
  savedDuration: number;
  onFeedbackVisible?: ((visible: boolean) => void) | undefined;
}) {
  useLanguage();
  const { state, download } = useNativeDownload(source, name, savedDuration);
  const keys =
    kind === "image" ||
    kind === "video" ||
    kind === "audio" ||
    kind === "voice note"
      ? kindKeys[kind]
      : undefined;
  const label = keys
    ? t(keys[state === "failed" ? 1 : 0])
    : t(
        state === "failed"
          ? "mediaViewing.download.retryUnknown"
          : "mediaViewing.download.unknown",
        { kind },
      );
  // The failure notice expires like the copy error; the retry icon remains.
  const [failureExpired, setFailureExpired] = useState(false);
  const failureShown = state === "failed" && !failureExpired;
  useEffect(() => {
    if (!failureShown) return;
    const timer = setTimeout(() => setFailureExpired(true), FAILURE_DURATION);
    return () => clearTimeout(timer);
  }, [failureShown]);
  const feedbackVisible =
    state === "pending" || state === "saved" || failureShown;
  useEffect(() => {
    onFeedbackVisible?.(feedbackVisible);
    return () => onFeedbackVisible?.(false);
  }, [feedbackVisible, onFeedbackVisible]);
  return (
    <>
      <IconButton
        hint="familiar"
        size="sm"
        type="button"
        aria-label={label}
        title={label}
        loading={state === "pending"}
        onClick={() => {
          setFailureExpired(false);
          void download();
        }}
        icon={
          state === "failed" ? (
            <ArrowsClockwiseIcon size={17} aria-hidden="true" />
          ) : state === "saved" ? (
            <CheckIcon size={17} aria-hidden="true" />
          ) : (
            <DownloadIcon size={17} aria-hidden="true" />
          )
        }
      />
      {/* Stays mounted so screen readers announce the first change. */}
      <span
        data-download-feedback={feedbackVisible ? "" : undefined}
        role={failureShown ? "alert" : "status"}
        className={feedbackVisible ? undefined : "sr-only"}
      >
        {state === "pending"
          ? t("mediaViewing.download.pending")
          : state === "saved"
            ? compact
              ? t("mediaViewing.download.done")
              : t("mediaViewing.download.saved")
            : failureShown
              ? compact
                ? t("mediaViewing.download.failed")
                : t("mediaViewing.download.retryHint")
              : ""}
      </span>
    </>
  );
}

/** Results of the native media menu's Download, which has no control to show them. */
export function MediaMenuDownloadNotice() {
  const notify = useToastNotification();
  // The host sends the saved file's name, or null if the download failed.
  const show = useEffectEvent((name: string | null) => {
    if (name === null)
      notify(
        <TranslatedMessage
          value={localMessage("mediaViewing.download.retryHint")}
        />,
        "error",
      );
    else
      notify(
        <TranslatedMessage
          value={localMessage("mediaViewing.download.saved")}
        />,
        "success",
      );
  });
  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    let unlisten = () => {};
    listen<string | null>("media-menu-download", ({ payload }) =>
      show(payload),
    ).then(
      (stop) => {
        if (active) unlisten = stop;
        else stop();
      },
      () => {},
    );
    return () => {
      active = false;
      unlisten();
    };
  }, []);
  return null;
}
