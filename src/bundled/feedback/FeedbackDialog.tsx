import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ChangeEvent } from "react";
import type { OutgoingEvent } from "../../features/relay/outbox";
import {
  UploadError,
  type UploadedAttachment,
} from "../../features/relay/attachments";
import type { RelayData, RelaySnapshot } from "../../features/relay/service";
import {
  feedbackEvent,
  PRODUCT_FEEDBACK_KIND,
  type FeedbackCategory,
} from "../../features/relay/product-feedback";
import { feedbackDiagnostics, feedbackImage } from "./prepare-feedback";
import { Button } from "../../shared/design-system/ui/Button";
import { Dialog } from "../../shared/design-system/ui/Dialog";
import { Textarea } from "../../shared/design-system/ui/Textarea";
import { t, useLanguage } from "../../shared/i18n";

const categories = ["bug", "praise", "needs-work"] as const;
const emptyItems: readonly OutgoingEvent[] = [];
const emptyEntries = () => emptyItems;
const noSubscription = () => () => {};
const sessionKeys = new WeakMap<object, number>();
let nextSessionKey = 0;
function sessionKey(session: object): number {
  let key = sessionKeys.get(session);
  if (key === undefined) {
    key = ++nextSessionKey;
    sessionKeys.set(session, key);
  }
  return key;
}

export function FeedbackDialog({
  open,
  onOpenChange,
  relay,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  relay: RelayData;
}) {
  const connection = useSyncExternalStore(relay.subscribe, relay.snapshot);
  const identity = sessionKey(connection.session);
  // Session identity, unlike generation, distinguishes already-connected deployments.
  return (
    <FeedbackForConnection
      key={identity}
      open={open}
      onOpenChange={onOpenChange}
      connection={connection}
      isCurrent={() => relay.snapshot().session === connection.session}
    />
  );
}

function FeedbackForConnection({
  open,
  onOpenChange,
  connection,
  isCurrent,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  connection: RelaySnapshot;
  isCurrent(): boolean;
}) {
  useLanguage();
  const active = useRef(false);
  const attempt = useRef(0);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      attempt.current++;
      uploadController.current?.abort();
    };
  }, []);
  const outbox = connection.session.outbox;
  const entries = useSyncExternalStore(
    outbox?.subscribe ?? noSubscription,
    outbox?.snapshot ?? emptyEntries,
  );
  const pending = entries.find(
    (item) => item.event.kind === PRODUCT_FEEDBACK_KIND,
  );
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [image, setImage] = useState<UploadedAttachment>();
  const [uploadedDiagnostics, setUploadedDiagnostics] =
    useState<UploadedAttachment>();
  const [includeDiagnostics, setIncludeDiagnostics] = useState(false);
  // close and unmount invalidate the same async attempt, including dismissal.
  const uploadController = useRef<AbortController | null>(null);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    let active = true;
    setHydrated(false);
    void outbox?.ready().then(
      () => {
        if (active) setHydrated(true);
      },
      (reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : t("v1wf.feedback.loadSavedFailed"),
          );
      },
    );
    return () => {
      active = false;
    };
  }, [outbox]);
  const available =
    hydrated &&
    connection.status === "ready" &&
    !!outbox?.supports(PRODUCT_FEEDBACK_KIND);
  async function attachImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !connection.session.feedbackUpload || !available || busy)
      return;
    const currentAttempt = ++attempt.current;
    const controller = new AbortController();
    uploadController.current = controller;
    setBusy(true);
    setError("");
    try {
      const checked = await feedbackImage(file, controller.signal);
      controller.signal.throwIfAborted();
      const result = await connection.session.feedbackUpload.upload(
        checked,
        controller.signal,
      );
      controller.signal.throwIfAborted();
      if (!active.current || currentAttempt !== attempt.current) return;
      if (result.type !== checked.type) throw new UploadError("invalid");
      setImage(result);
    } catch (reason) {
      if (
        !controller.signal.aborted &&
        active.current &&
        currentAttempt === attempt.current
      )
        setError(
          reason instanceof Error
            ? reason.message
            : t("v1wf.feedback.imageUploadFailed"),
        );
    } finally {
      if (uploadController.current === controller)
        uploadController.current = null;
      if (active.current && currentAttempt === attempt.current) setBusy(false);
    }
  }
  async function submit() {
    if (!outbox || !available || pending || busy) return;
    setBusy(true);
    setError("");
    const currentAttempt = ++attempt.current;
    try {
      const attachments = image ? [image] : [];
      const upload = connection.session.feedbackUpload;
      let diagnostics: File | undefined;
      if (includeDiagnostics) {
        if (uploadedDiagnostics) {
          attachments.push(uploadedDiagnostics);
        } else {
          if (!upload) throw new UploadError("unavailable");
          const controller = new AbortController();
          uploadController.current = controller;
          diagnostics = await feedbackDiagnostics();
          controller.signal.throwIfAborted();
          if (!active.current || currentAttempt !== attempt.current) return;
          // validateUploadResult confines the URL to this origin, a 64-hex
          // hash and at most eight extension characters. Reserve that maximum
          // (and the longer allowed MIME) before storing diagnostics bytes.
          attachments.push({
            name: diagnostics.name,
            type: "application/octet-stream",
            size: diagnostics.size,
            sha256: "0".repeat(64),
            url: `${new URL(upload.origin).origin}/media/${"0".repeat(64)}.abcdefgh`,
          });
        }
      }
      feedbackEvent(message, category, attachments, upload?.origin);
      if (diagnostics && upload) {
        const controller = uploadController.current;
        if (!controller) return;
        controller.signal.throwIfAborted();
        if (!active.current || currentAttempt !== attempt.current) return;
        const result = await upload.upload(diagnostics, controller.signal);
        controller.signal.throwIfAborted();
        if (!active.current || currentAttempt !== attempt.current) return;
        if (
          result.type !== "application/octet-stream" &&
          result.type !== "text/plain"
        )
          throw new UploadError("invalid");
        setUploadedDiagnostics(result);
        attachments[attachments.length - 1] = result;
        uploadController.current = null;
      }
      if (!active.current || currentAttempt !== attempt.current) return;
      outbox.send(
        feedbackEvent(
          message,
          category,
          attachments,
          connection.session.feedbackUpload?.origin,
        ),
      );
    } catch (reason) {
      if (
        active.current &&
        currentAttempt === attempt.current &&
        !uploadController.current?.signal.aborted
      )
        setError(
          reason instanceof Error
            ? reason.message
            : t("v1wf.feedback.sendFailed"),
        );
    } finally {
      if (active.current && currentAttempt === attempt.current) {
        uploadController.current = null;
        setBusy(false);
      }
    }
  }
  async function clearPending() {
    if (!outbox || !pending || busy) return;
    setBusy(true);
    const epoch = attempt.current;
    try {
      await outbox.dismiss(pending.event.id);
      if (!active.current || !isCurrent() || epoch !== attempt.current) return;
      setMessage("");
      setCategory(null);
      setImage(undefined);
      setUploadedDiagnostics(undefined);
      setIncludeDiagnostics(false);
      setError("");
      close();
    } catch (reason) {
      if (!active.current || !isCurrent() || epoch !== attempt.current) return;
      setError(
        reason instanceof Error
          ? reason.message
          : t("v1wf.feedback.clearFailed"),
      );
    } finally {
      if (active.current && isCurrent() && epoch === attempt.current)
        setBusy(false);
    }
  }
  function discard() {
    if (
      !pending ||
      (pending.delivery !== "failed" && pending.delivery !== "unknown") ||
      !window.confirm(t("v1wf.feedback.discardConfirm"))
    )
      return;
    void clearPending();
  }
  function retry() {
    if (!outbox || !pending || !available || busy) return;
    try {
      outbox.retry(pending.event.id);
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : t("v1wf.feedback.retryFailed"),
      );
    }
  }
  function close() {
    attempt.current++;
    uploadController.current?.abort();
    uploadController.current = null;
    setBusy(false);
    onOpenChange(false);
  }
  const delivered =
    pending?.delivery === "accepted" || pending?.delivery === "seen";
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
        else onOpenChange(next);
      }}
      dismissOnOutsideClick={false}
      title={t("v1wf.feedback.title")}
      description={t("v1wf.feedback.description")}
      actions={
        <>
          <Button onClick={close}>{t("v1wf.feedback.close")}</Button>
          {delivered ? (
            <Button
              variant="prominent"
              disabled={busy}
              onClick={() => void clearPending()}
            >
              {t("v1wf.feedback.done")}
            </Button>
          ) : pending?.delivery === "failed" ||
            pending?.delivery === "unknown" ? (
            <>
              <Button disabled={busy} onClick={discard}>
                {t("v1wf.feedback.discardLocally")}
              </Button>
              <Button
                variant="prominent"
                disabled={!available || busy}
                onClick={retry}
              >
                {t("v1wf.feedback.retrySame")}
              </Button>
            </>
          ) : !pending ? (
            <Button
              variant="prominent"
              disabled={!available || !message.trim() || busy}
              onClick={() => void submit()}
            >
              {t("v1wf.feedback.title")}
            </Button>
          ) : null}
        </>
      }
    >
      {pending ? (
        <>
          <p className="mb-4 whitespace-pre-wrap">{pending.event.content}</p>
          <p role="status">
            {delivered
              ? t("v1wf.feedback.received")
              : pending.delivery === "unknown"
                ? t("v1wf.feedback.unconfirmed")
                : pending.delivery === "failed"
                  ? t("v1wf.feedback.notDelivered", {
                      reason: pending.error ?? t("v1wf.feedback.retryToSend"),
                    })
                  : t("v1wf.feedback.sending")}
          </p>
        </>
      ) : (
        <>
          <fieldset className="flex flex-wrap gap-2 mb-4">
            <legend className="sr-only">
              {t("v1wf.feedback.categoryLegend")}
            </legend>
            {categories.map((id) => (
              <Button
                key={id}
                variant={category === id ? "prominent" : "subtle"}
                aria-pressed={category === id}
                disabled={busy}
                onClick={() => setCategory(category === id ? null : id)}
              >
                {t(`v1wf.feedback.category.${id}`)}
              </Button>
            ))}
          </fieldset>
          <label htmlFor="feedback-message" className="text-label-sm">
            {t("v1wf.feedback.yours")}
          </label>
          <Textarea
            id="feedback-message"
            value={message}
            disabled={busy}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={t("v1wf.feedback.placeholder")}
          />
          {connection.session.feedbackUpload && (
            <>
              <label
                htmlFor="feedback-image"
                className="text-label-sm block mt-4"
              >
                {t("v1wf.feedback.attachImage")}
              </label>
              <input
                id="feedback-image"
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                disabled={!available || busy}
                onChange={(event) => void attachImage(event)}
              />
              {image && (
                <p>
                  {t("v1wf.feedback.imageUploaded", { name: image.name })}{" "}
                  <Button disabled={busy} onClick={() => setImage(undefined)}>
                    {t("v1wf.feedback.removeImage")}
                  </Button>
                </p>
              )}
              <label className="block mt-4">
                <input
                  type="checkbox"
                  checked={includeDiagnostics}
                  disabled={!available || busy}
                  onChange={(event) =>
                    setIncludeDiagnostics(event.target.checked)
                  }
                />{" "}
                {t("v1wf.feedback.attachDiagnostics")}
              </label>
              <p>{t("v1wf.feedback.diagnosticsHelp")}</p>
            </>
          )}
        </>
      )}
      {!available && <p role="status">{t("v1wf.feedback.connect")}</p>}
      {error && <p role="alert">{error}</p>}
    </Dialog>
  );
}
