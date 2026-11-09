// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import type { EventTemplate } from "nostr-tools";
import { setLanguage } from "../../shared/i18n";
import {
  errorMessage,
  resolveMessage,
} from "../../shared/i18n/deferred-message";
import { createRelaySession } from "./session";
import type { LiveCallbacks } from "./live";
import { keypair, metadata, roster, signed } from "./testing";

const owners: ReturnType<typeof createRelaySession>[] = [];
afterEach(() => {
  for (const owner of owners.splice(0)) owner.dispose();
  setLanguage("en");
});

async function sessionFixture() {
  const viewer = keypair(),
    relay = keypair(),
    other = keypair(),
    missing = keypair();
  const events = [
    metadata(relay, "c", "General"),
    roster(relay, "c", [viewer.pubkey, other.pubkey], 1700000000),
  ];
  let live: LiveCallbacks | undefined;
  const sign = vi.fn(async (template: EventTemplate) =>
    signed(viewer, template),
  );
  const publish = vi.fn(async () => {});
  const owner = createRelaySession(
    {
      viewer: viewer.pubkey,
      relayAuthor: relay.pubkey,
      media: (url) => url,
      async query(filters) {
        return events.filter((event) =>
          filters.some(
            (filter) =>
              filter.kinds?.includes(event.kind) && filter["#d"]?.includes("c"),
          ),
        );
      },
      writer: { sign, publish },
      subscribe(callbacks: LiveCallbacks) {
        live = callbacks;
        return { update() {}, retry() {}, dispose() {} };
      },
    },
    { outboxStorage: { load: () => [], save() {} } },
  );
  owners.push(owner);
  if (!live) throw new Error("Expected the real session's live subscription");
  live.state({ status: "connected", routes: [] });
  await owner.session.read([{ kinds: [39000, 39002], "#d": ["c"], limit: 10 }]);
  return { ...owner, live, missing, sign, publish };
}

it.each([
  {
    reconnecting: true,
    english: "Refresh channel membership before mentioning anyone",
    korean: "멘션하기 전에 채널 멤버 정보를 새로 고쳐 주세요.",
  },
  {
    reconnecting: false,
    english:
      "A selected recipient is no longer a channel member; remove them or refresh membership",
    korean:
      "선택한 수신자가 더 이상 채널 멤버가 아닙니다. 해당 수신자를 제거하거나 멤버 정보를 새로 고쳐 주세요.",
  },
])(
  "localizes the actual synchronous mention refusal, reconnecting=$reconnecting",
  async ({ reconnecting, english, korean }) => {
    setLanguage("en");
    const h = await sessionFixture();
    if (reconnecting) h.live.state({ status: "retrying", routes: [] });
    let failure: unknown;
    try {
      h.session.messages.send("c", "한글 raw draft {name}", [h.missing.pubkey]);
    } catch (reason) {
      failure = reason;
    }
    if (!(failure instanceof Error))
      throw new Error("Expected the real session to reject the mention");
    expect(failure.name).toBe("Error");
    expect(failure.message).toBe(english);
    expect(String(failure)).toBe(`Error: ${english}`);
    expect(resolveMessage(errorMessage(failure))).toBe(english);
    setLanguage("ko");
    expect(resolveMessage(errorMessage(failure))).toBe(korean);
    expect(resolveMessage(errorMessage(new Error(english)))).toBe(english);
    expect(failure.message).toBe(english);
    setLanguage("en");
    expect(resolveMessage(errorMessage(failure))).toBe(english);
    expect(h.sign).not.toHaveBeenCalled();
    expect(h.publish).not.toHaveBeenCalled();
    expect(h.session.outbox?.snapshot()).toEqual([]);
  },
);
