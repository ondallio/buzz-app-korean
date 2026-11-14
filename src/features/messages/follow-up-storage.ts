import { t } from "../../shared/i18n";
import {
  clearView,
  readView,
  viewRevision,
  writeView,
} from "../../shared/view-state";
import type { UploadedAttachment } from "../relay/attachments";
import type { MentionPicks } from "../relay/messages";
import type { ComposerToken } from "./composer-token";
import { messageTokenTags } from "./message-tokens";

export type FollowUpMessage = {
  channelId: string;
  text: string;
  recipients: readonly string[];
  attachments: readonly UploadedAttachment[];
  references: readonly string[];
  picks: MentionPicks;
  /** The message's chips; publication signs them. */
  tokens?: readonly ComposerToken[];
};
export type SavedFollowUp = FollowUpMessage & {
  id: string;
  createdAt: number;
  sending?: true;
};
export type FollowUpHandoff = {
  id: string;
  message?: string;
  recipients: readonly string[];
  complete?: true;
  owner?: string;
};
const prefix = "follow-up:";
export const followUpRecovery = (id: string) => ({
  key: prefix + id,
  value: id,
});

/** Separate view records avoid overwriting another conversation/window's queue. */
export function followUpStorage(scope: string) {
  const key = (id: string) => prefix + id;
  let owner: Promise<string> | undefined;
  return {
    owner() {
      if (!navigator.locks) throw new Error("Window ownership is unavailable.");
      owner ??= new Promise<string>((resolve, reject) => {
        const name = `buzz-follow-up-window:${crypto.randomUUID()}`;
        void navigator.locks
          .request(name, () => {
            resolve(name);
            // The browser releases this liveness lock when the document closes.
            return new Promise<void>(() => {});
          })
          .catch(reject);
      });
      return owner;
    },
    async isLive(handoff: FollowUpHandoff) {
      // Older markers have no owner evidence; explicit dismissal still retires them.
      if (!handoff.owner || !navigator.locks?.query) return true;
      return (
        (await navigator.locks.query()).held?.some(
          (lock) => lock.name === handoff.owner,
        ) ?? true
      );
    },
    retire(channelId: string) {
      clearView(scope, `follow-up-handoff:${channelId}`);
    },
    load(): SavedFollowUp[] {
      const records: SavedFollowUp[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const storageKey = localStorage.key(i);
        if (!storageKey?.startsWith("buzz-view.v1:")) continue;
        let pair: unknown;
        try {
          pair = JSON.parse(storageKey.slice("buzz-view.v1:".length));
        } catch {
          continue;
        }
        if (
          !Array.isArray(pair) ||
          pair[0] !== scope ||
          typeof pair[1] !== "string" ||
          !pair[1].startsWith(prefix)
        )
          continue;
        const value = readView<unknown>(scope, pair[1], null);
        if (!valid(value) || pair[1] !== key(value.id))
          throw new Error(t("v1msg.queue.unreadable"));
        records.push(value);
      }
      return records.sort(
        (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id),
      );
    },
    has(id: string) {
      const revision = viewRevision(scope, key(id));
      if (revision === undefined)
        throw new Error(t("v1msg.queue.storageRetry"));
      return revision !== null;
    },
    sending(id: string, sending: boolean) {
      const saved = readView<unknown>(scope, key(id), null);
      if (!valid(saved)) throw new Error(t("v1msg.queue.savedUnavailable"));
      if (
        !writeView(scope, key(id), { ...saved, sending: sending || undefined })
      )
        throw new Error(t("v1msg.queue.saveDeliveryFailed"));
    },
    isSending(id: string) {
      return (
        readView<SavedFollowUp | null>(scope, key(id), null)?.sending === true
      );
    },
    save(value: SavedFollowUp) {
      if (!writeView(scope, key(value.id), value))
        throw new Error(t("v1msg.queue.saveFailed"));
    },
    remove(id: string) {
      clearView(scope, key(id));
    },
    handoff(channelId: string): FollowUpHandoff | null {
      const name = `follow-up-handoff:${channelId}`;
      const revision = viewRevision(scope, name);
      if (revision === null) return null;
      const value = readView<unknown>(scope, name, null);
      if (
        revision === undefined ||
        !value ||
        typeof value !== "object" ||
        typeof (value as FollowUpHandoff).id !== "string" ||
        !strings((value as FollowUpHandoff).recipients) ||
        ((value as FollowUpHandoff).message !== undefined &&
          typeof (value as FollowUpHandoff).message !== "string") ||
        ((value as FollowUpHandoff).owner !== undefined &&
          typeof (value as FollowUpHandoff).owner !== "string") ||
        ((value as FollowUpHandoff).complete !== undefined &&
          (value as FollowUpHandoff).complete !== true)
      )
        throw new Error(t("v1msg.queue.orderUnavailable"));
      return value as FollowUpHandoff;
    },
    claim(channelId: string, handoff: FollowUpHandoff) {
      if (!writeView(scope, `follow-up-handoff:${channelId}`, handoff))
        throw new Error(t("v1msg.queue.orderSaveFailed"));
    },
    async lockChat<T>(channelId: string, run: () => Promise<T>) {
      if (!navigator.locks) throw new Error(t("v1msg.queue.browserUnsafe"));
      return navigator.locks.request(
        `buzz-follow-up-chat:${scope}:${channelId}`,
        run,
      );
    },
    async tryLock(id: string, run: () => void | Promise<void>) {
      if (!navigator.locks) return;
      await navigator.locks.request(
        `buzz-follow-up:${scope}:${id}`,
        { ifAvailable: true },
        (lock) => {
          if (lock) return run();
        },
      );
    },
    async lock<T>(id: string, run: () => Promise<T>) {
      if (!navigator.locks) throw new Error(t("v1msg.queue.browserOutdated"));
      return navigator.locks.request(`buzz-follow-up:${scope}:${id}`, run);
    },
  };
}

function strings(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}
function valid(value: unknown): value is SavedFollowUp {
  if (!value || typeof value !== "object") return false;
  const v = value as SavedFollowUp;
  // Malformed chips stay in storage; this build cannot send them.
  try {
    if (v.tokens !== undefined) {
      if (!Array.isArray(v.tokens)) return false;
      messageTokenTags(v.tokens);
    }
  } catch {
    return false;
  }
  return (
    typeof v.id === "string" &&
    typeof v.channelId === "string" &&
    typeof v.text === "string" &&
    (v.sending === undefined || v.sending === true) &&
    Number.isFinite(v.createdAt) &&
    strings(v.recipients) &&
    strings(v.references) &&
    Array.isArray(v.attachments) &&
    v.attachments.every(
      (a) =>
        a &&
        typeof a.name === "string" &&
        typeof a.url === "string" &&
        typeof a.type === "string" &&
        typeof a.sha256 === "string" &&
        Number.isFinite(a.size) &&
        (a.voice === undefined ||
          (a.voice &&
            Number.isFinite(a.voice.duration) &&
            Array.isArray(a.voice.waveform) &&
            a.voice.waveform.every(Number.isFinite))),
    ) &&
    !!v.picks &&
    typeof v.picks === "object" &&
    !Array.isArray(v.picks) &&
    Object.values(v.picks).every(
      (pick) =>
        pick &&
        (pick.model === undefined || typeof pick.model === "string") &&
        (pick.effort === undefined || typeof pick.effort === "string"),
    )
  );
}
