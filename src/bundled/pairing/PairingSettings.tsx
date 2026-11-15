import { isTauri } from "@tauri-apps/api/core";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  CheckIcon as Check,
  CircleNotchIcon as LoaderCircle,
} from "../../shared/design-system/icons";
import { Button } from "../../shared/design-system/ui/Button";
import { Input } from "../../shared/design-system/ui/Input";
import type { CommunityReader } from "../../features/communities/service";
export type PairingSettingsProps = {
  communities: CommunityReader;
  active(): boolean;
};
import {
  communityDestination,
  relayOrigin,
} from "../../features/communities/destination";
import {
  createPairingClient,
  nativePairing,
  pairingAvailable,
  type PairingNative,
} from "../../features/pairing/client";
import { writeClipboardText } from "../../shared/clipboard";
import { QrCode } from "../../shared/QrCode";
import { t, useLanguage } from "../../shared/i18n";

export function PairingSettings({
  communities,
  active,
  native = nativePairing,
  available = pairingAvailable(),
}: PairingSettingsProps & { native?: PairingNative; available?: boolean }) {
  useLanguage();
  const client = useSyncExternalStore(
    communities.subscribe,
    communities.snapshot,
  );
  const pairing = useMemo(() => createPairingClient(native), [native]);
  const state = useSyncExternalStore(pairing.subscribe, pairing.snapshot);
  const [account, setAccount] = useState<string>();
  const [manualOrigin, setManualOrigin] = useState<string>();
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState<{ uri: string; failed: boolean }>();
  const [relay, setRelay] = useState(() =>
    client.selected ? communityDestination(client.selected).url : "",
  );
  const lifetime = useRef(0);
  useEffect(() => {
    lifetime.current++;
    return () => {
      lifetime.current++;
      void pairing.cancel(true);
    };
  }, [pairing]);
  // Changing accounts/communities invalidates the pairing being displayed.
  useEffect(() => {
    lifetime.current++;
    setReading(false);
    setManualOrigin(undefined);
    setAccount(client.viewer);
    setRelay(client.selected ? communityDestination(client.selected).url : "");
    return () => {
      void pairing.cancel(true);
    };
  }, [client.viewer, client.selected, pairing]);
  const busy = [
    "connecting",
    "qr",
    "code",
    "transferring",
    "cancelling",
  ].includes(state.phase);
  async function prepare() {
    const attempt = lifetime.current;
    setError(undefined);
    setReading(true);
    try {
      const viewer = await native.account();
      if (attempt !== lifetime.current) return;
      if (client.viewer && viewer !== client.viewer)
        throw new Error(t("v1wf.pair.accountMismatch"));
      setAccount(viewer);
    } catch (error) {
      if (attempt === lifetime.current) setError(String(error));
    } finally {
      if (attempt === lifetime.current) setReading(false);
    }
  }
  async function copy(uri: string) {
    try {
      await writeClipboardText(uri);
      setCopied({ uri, failed: false });
    } catch {
      setCopied({ uri, failed: true });
    }
  }
  function start() {
    setError(undefined);
    try {
      if (!account || !active()) return;
      const origin = relayOrigin(relay);
      if (!client.selected) setManualOrigin(origin);
      void pairing.start(account, origin);
    } catch {
      setError(t("v1wf.pair.enterAddress"));
    }
  }
  useEffect(() => {
    if (
      !available ||
      !account ||
      (!client.selected && !manualOrigin) ||
      !active() ||
      (client.viewer && account !== client.viewer) ||
      (client.selected &&
        relay !== communityDestination(client.selected).url) ||
      !["idle", "expired"].includes(state.phase)
    )
      return;
    const origin = client.selected ? relayOrigin(relay) : manualOrigin;
    if (origin) void pairing.start(account, origin);
  }, [
    available,
    account,
    client.viewer,
    client.selected,
    manualOrigin,
    active,
    relay,
    state.phase,
    pairing,
  ]);
  const scanned = ["code", "transferring", "complete", "uncertain"].includes(
    state.phase,
  );
  const confirmed = ["transferring", "complete"].includes(state.phase);
  const done = state.phase === "complete";
  const verificationInstructions = t("v1wf.pair.verifyInstructions");
  const steps = [
    {
      id: "scan",
      title: t("v1wf.pair.scanTitle"),
      detail: t("v1wf.pair.scanDetail"),
      complete: scanned,
    },
    {
      id: "verify",
      title: t("v1wf.pair.verifyTitle"),
      detail: verificationInstructions,
      complete: confirmed,
    },
    {
      id: "finish",
      title: done ? t("v1wf.pair.paired") : t("v1wf.pair.pairApp"),
      detail: done
        ? t("v1wf.pair.sentDetail")
        : t("v1wf.pair.connectAfterVerify"),
      complete: done,
    },
  ];
  return (
    <section aria-labelledby="pair-mobile-title" className="min-w-0">
      <h2 id="pair-mobile-title" className="mt-0 mb-2 text-label">
        {t("v1wf.pair.title")}
      </h2>
      <p className="mt-0 mb-6 text-body-sm text-muted">
        {t("v1wf.pair.intro")}
      </p>
      <div className="w-full [container-type:inline-size]">
        <p aria-live="polite" className="sr-only">
          {state.phase === "qr" && copied?.uri === state.uri
            ? copied.failed
              ? t("v1wf.pair.copyFailedStatus")
              : t("v1wf.pair.copiedStatus")
            : state.phase === "code"
              ? t("v1wf.pair.verificationCode", {
                  code: state.code.split("").join(" "),
                  instructions: verificationInstructions,
                })
              : done
                ? t("v1wf.pair.phonePairedStatus")
                : ""}
        </p>
        <div className="flex flex-col items-stretch gap-6 p-6 [@container(min-width:46rem)]:flex-row [@container(min-width:46rem)]:gap-6 [@container(min-width:46rem)]:p-12">
          <div className="flex w-64 max-w-full shrink-0 flex-col gap-3 self-center [@container(min-width:46rem)]:self-start">
            <div className="flex h-64 w-full flex-col items-center justify-center gap-4 overflow-auto text-center">
              {!available ? (
                <p role="status" className="text-body-sm text-muted">
                  {isTauri()
                    ? t("v1wf.pair.devBroker")
                    : t("v1wf.pair.openDesktop")}
                </p>
              ) : (
                <>
                  {!busy &&
                    !done &&
                    state.phase !== "uncertain" &&
                    (!account ? (
                      <Button disabled={reading} onClick={() => void prepare()}>
                        {reading
                          ? t("v1wf.pair.openingAccount")
                          : t("v1wf.pair.useExisting")}
                      </Button>
                    ) : (
                      <>
                        {!client.selected && (
                          <div className="flex w-full flex-col gap-2 text-left">
                            <label
                              htmlFor="pair-community"
                              className="text-label-sm"
                            >
                              {t("v1wf.pair.communityAddress")}
                            </label>
                            <Input
                              id="pair-community"
                              value={relay}
                              placeholder="https://your-community.example"
                              onChange={(e) => setRelay(e.target.value)}
                              onBlur={() => {
                                if (relay.trim()) start();
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && relay.trim()) start();
                              }}
                              autoComplete="off"
                              spellCheck={false}
                            />
                          </div>
                        )}
                        {["error", "cancelled"].includes(state.phase) && (
                          <Button variant="prominent" onClick={start}>
                            {t("v1wf.pair.tryAgain")}
                          </Button>
                        )}
                      </>
                    ))}
                  {state.phase === "connecting" && (
                    <div
                      role="status"
                      className="flex flex-col items-center gap-3 text-body-sm text-muted"
                    >
                      <LoaderCircle
                        aria-hidden="true"
                        size={24}
                        className="motion-safe:animate-spin"
                      />
                      {t("v1wf.pair.creatingCode")}
                    </div>
                  )}
                  {state.phase === "qr" && (
                    <QrCode svg={state.svg} alt={t("v1wf.pair.qrAlt")} />
                  )}
                  {state.phase === "code" && (
                    <div className="flex min-h-64 w-full flex-col justify-between gap-6">
                      <h3 className="m-0 text-label">
                        {t("v1wf.pair.verifyTitle")}
                      </h3>
                      <fieldset className="m-0 w-full whitespace-nowrap rounded-xl border border-shell-edge bg-surface px-4 py-4">
                        <legend className="sr-only">
                          {t("v1wf.pair.pairingCode")}
                        </legend>
                        <span className="sr-only">
                          {state.code.split("").join(" ")}
                        </span>
                        <span
                          aria-hidden="true"
                          className="font-mono text-title font-semibold tracking-widest"
                        >
                          {state.code.slice(0, 3)} {state.code.slice(3)}
                        </span>
                      </fieldset>
                      <div className="flex flex-col gap-2">
                        <Button
                          variant="prominent"
                          onClick={() => void pairing.confirm()}
                        >
                          {t("v1wf.pair.codesMatch")}
                        </Button>
                        <Button onClick={() => void pairing.deny()}>
                          {t("v1wf.pair.cancel")}
                        </Button>
                      </div>
                    </div>
                  )}
                  {state.phase === "cancelling" && (
                    <p role="status" className="text-body-sm text-muted">
                      {t("v1wf.pair.cancelling")}
                    </p>
                  )}
                  {state.phase === "cancelled" && (
                    <p role="status" className="text-body-sm text-muted">
                      {t("v1wf.pair.cancelled")}
                    </p>
                  )}
                  {state.phase === "transferring" && (
                    <div
                      role="status"
                      className="flex flex-col items-center gap-3 text-body-sm text-muted"
                    >
                      <LoaderCircle
                        aria-hidden="true"
                        size={24}
                        className="motion-safe:animate-spin"
                      />
                      {t("v1wf.pair.finishing")}
                    </div>
                  )}
                  {state.phase === "uncertain" && (
                    <div
                      role="status"
                      className="flex flex-col items-center gap-3"
                    >
                      <h3 className="m-0 text-label">
                        {t("v1wf.pair.checkPhone")}
                      </h3>
                      <p className="m-0 text-body-sm text-muted">
                        {t("v1wf.pair.uncertain")}
                      </p>
                      <Button onClick={start}>{t("v1wf.pair.startNew")}</Button>
                    </div>
                  )}
                  {done && (
                    <div
                      role="status"
                      className="flex flex-col items-center gap-3"
                    >
                      <Check
                        aria-hidden="true"
                        size={40}
                        className="text-success"
                      />
                      <h3 className="m-0 text-label">
                        {t("v1wf.pair.phonePaired")}
                      </h3>
                      <Button onClick={start}>
                        {t("v1wf.pair.pairAnother")}
                      </Button>
                    </div>
                  )}
                  {(error || state.phase === "error") && (
                    <div className="flex flex-col items-center gap-3">
                      <p role="alert" className="m-0 text-body-sm text-danger">
                        {error ??
                          (state.phase === "error" ? state.message : "")}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
            {available && (
              // Reserve the slot in every phase so the steps never shift.
              <div className="flex min-h-10 flex-col">
                {state.phase === "qr" && (
                  <Button onClick={() => void copy(state.uri)}>
                    {copied?.uri !== state.uri
                      ? t("v1wf.pair.copyCode")
                      : copied.failed
                        ? t("v1wf.pair.copyFailed")
                        : t("v1wf.pair.copied")}
                  </Button>
                )}
              </div>
            )}
          </div>
          <ol
            aria-label={t("v1wf.pair.steps")}
            className="m-0 grid w-full min-w-0 flex-1 auto-rows-fr list-none self-center gap-3 p-0"
          >
            {steps.map((step, index) => (
              <li
                key={step.id}
                className="flex min-h-24 min-w-0 items-start gap-4"
              >
                <span
                  aria-hidden="true"
                  className={`flex size-12 shrink-0 items-center justify-center rounded-full text-label ${step.complete ? "bg-affordance-success text-success" : "bg-affordance-subtle text-primary"}`}
                >
                  {step.complete ? <Check size={24} /> : index + 1}
                </span>
                <div className="min-w-0">
                  <p className="m-0 text-label">
                    {step.title}
                    <span className="sr-only">
                      {step.complete ? t("v1wf.pair.stepComplete") : ""}
                    </span>
                  </p>
                  <p className="mt-1 mb-0 text-body-sm text-muted">
                    {step.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
