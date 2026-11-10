import { Context } from "@deepseek-ai/cordis";
import { verifyEvent } from "nostr-tools";
import { afterEach, expect, it, vi } from "vitest";
import type { ClientSnapshot } from "../communities/service";
import { emptySync } from "../communities/known-communities";
import type { ReadFilter, RelayEvent } from "../relay/events";
import { matchesEvent } from "../relay/projection";
import type { RelayData, RelaySnapshot } from "../relay/service";
import { createRelaySession } from "../relay/session";
import { keypair, metadata, roster, signed } from "../relay/testing";
import type { ReadTransport } from "../relay/transport";
import type { AgentIdentity } from "./native";
import { AgentsService, type AgentCommunities } from "./service";
import { fakeNative } from "./service-testing";
import { memoryStorage } from "./test-fakes";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const origin = "https://relay.example.test";
const channel = "11111111-1111-4111-8111-111111111111";
const disposals: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of disposals.splice(0).reverse()) await dispose();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function fixture() {
  const viewer = keypair(),
    relay = keypair(),
    agent = keypair();
  const ownerReads: {
    filters: readonly ReadFilter[];
    signal: AbortSignal | undefined;
    gate: ReturnType<typeof deferred<RelayEvent[]>>;
  }[] = [];
  const publications: RelayEvent[] = [];
  const records: RelayEvent[] = [];
  const fetch = vi.fn(async () => {
    throw new Error("Unexpected network attempt");
  });
  vi.stubGlobal("fetch", fetch);
  const query = vi.fn<ReadTransport["query"]>(async (filters, signal) => {
    const f = filters[0];
    if (
      filters.length === 1 &&
      f?.kinds?.length === 1 &&
      f.kinds[0] === 30177 &&
      f.authors?.length === 1 &&
      f.authors[0] === viewer.pubkey &&
      f.limit === 500
    ) {
      const gate = deferred<RelayEvent[]>();
      ownerReads.push({ filters, signal, gate });
      return gate.promise;
    }
    return records.filter((event) =>
      filters.some((filter) => matchesEvent(event, filter)),
    );
  });
  const owner = createRelaySession(
    {
      viewer: viewer.pubkey,
      relayAuthor: relay.pubkey,
      scope: origin,
      media: () => undefined,
      query,
      writer: {
        kinds: [30177],
        sign: async (template) => signed(viewer, template),
        publish: async (event) => {
          publications.push(event);
        },
      },
      subscribe: () => ({ update() {}, retry() {}, dispose() {} }),
    },
    { outboxStorage: { load: () => [], save() {} } },
  );
  let ctx: Context | undefined;
  let disposed = false;
  const dispose = async () => {
    if (disposed) return;
    disposed = true;
    for (const read of ownerReads) read.gate.resolve([]);
    await ctx?.fiber.dispose();
    owner.dispose();
    await Promise.resolve();
  };
  disposals.push(dispose);
  const warn = vi.spyOn(console, "warn");
  const identities: AgentIdentity[] = [];
  const native = fakeNative(identities);
  // This generic native fake otherwise fixes its owner to service-testing.viewer.
  native.create.mockImplementation(
    async (destination, passedOwner, type, name) => {
      const identity = {
        pubkey: agent.pubkey,
        relay: destination.replace(/^https:/, "wss:"),
        owner: passedOwner,
        type,
        name,
        deleted: false,
      };
      identities.push(identity);
      return identity;
    },
  );
  let snapshot: RelaySnapshot = {
    status: "ready",
    generation: 1,
    session: owner.session,
    scope: `${origin}:${viewer.pubkey}`,
    origin,
    viewer: viewer.pubkey,
  };
  const listeners = new Set<() => void>();
  const relayData: RelayData = {
    snapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    retry() {},
    disconnect() {
      snapshot = {
        status: "disconnected",
        generation: 2,
        session: owner.session,
      };
      for (const listener of listeners) listener();
    },
    clearCache: () => owner.clearCache(),
  };
  const client: ClientSnapshot = {
    status: "ready",
    relayAvailable: true,
    viewer: viewer.pubkey,
    selected: origin,
    memberships: [{ id: origin, name: "Fixture" }],
    profile: { name: "Fixture", picture: "", about: "" },
    sync: emptySync(),
  };
  const communities: AgentCommunities = {
    snapshot: () => client,
    subscribe: () => () => {},
    open: () => relayData,
  };
  ctx = new Context();
  ctx.provide("pluginStatus", {
    isActive: () => true,
    subscribe: () => () => {},
    settled: () => true,
  });
  const storage = memoryStorage();
  const service = new AgentsService(ctx, communities, native, storage);
  ctx
    .extend({ pluginOwner: { id: "fixture", revision: "one" } })
    .agents.register({
      id: "echo",
      title: "Fixture",
      defaults: () => ({ config: { literal: "fixture" } }),
      run: vi.fn(),
    });
  const readAt = (index: number) => {
    const read = ownerReads[index];
    if (!read) throw new Error(`Owner read ${index} has not started`);
    return read;
  };
  return {
    viewer,
    relay,
    agent,
    ownerReads,
    readAt,
    publications,
    records,
    fetch,
    query,
    owner,
    warn,
    native,
    service,
    storage,
    relayData,
    dispose,
  };
}

type Fixture = ReturnType<typeof fixture>;
async function createWhileReading(h: Fixture) {
  await vi.waitFor(() => expect(h.service.snapshot().status).toBe("ready"));
  await vi.waitFor(() => expect(h.ownerReads).toHaveLength(1));
  const created = await h.service.create({
    type: "fixture/echo",
    name: "Local fixture",
  });
  expect(h.native.create).toHaveBeenCalledExactlyOnceWith(
    origin,
    h.viewer.pubkey,
    "fixture/echo",
    "Local fixture",
  );
  expect(created.pubkey).toBe(h.agent.pubkey);
  expect(h.service.find(h.agent.pubkey)).toMatchObject({
    name: "Local fixture",
    owner: h.viewer.pubkey,
  });
  expect(h.publications).toEqual([]);
}

async function discover(
  h: Fixture,
  members = [h.viewer.pubkey],
  at = 1_700_000_000,
) {
  h.records.splice(
    0,
    h.records.length,
    metadata(h.relay, channel, "Signed metadata", at),
    roster(h.relay, channel, members, at),
  );
  const events = await h.owner.session.read(
    [{ kinds: [39000, 39002], "#d": [channel], limit: 2 }],
    { fresh: true, priority: "foreground" },
  );
  expect(events).toHaveLength(members.includes(h.viewer.pubkey) ? 2 : 0);
}

async function expectListed(h: Fixture) {
  await vi.waitFor(() =>
    expect(h.publications.filter((event) => event.kind === 30177)).toHaveLength(
      1,
    ),
  );
  const publication = h.publications.find((event) => event.kind === 30177);
  if (!publication) throw new Error("Listing publication missing");
  expect(verifyEvent(publication)).toBe(true);
  expect(publication.pubkey).toBe(h.viewer.pubkey);
  expect(publication.content).toBe(
    JSON.stringify({
      parallelism: 1,
      respond_to: "owner-only",
      name: "Local fixture",
    }),
  );
  expect(publication.tags.filter(([tag]) => tag !== "client-id")).toEqual([
    ["d", h.agent.pubkey],
    ["runtime", "fixture/echo"],
  ]);
  expect(h.native.create).toHaveBeenCalledTimes(1);
  expect(h.fetch).not.toHaveBeenCalled();
}

it("fresh-reads the owner listing once after real signed authority makes the first read stale, without re-creating the local agent", async () => {
  const h = fixture();
  try {
    await createWhileReading(h);
    await discover(h);
    expect(
      h.owner.session.channels.list().channels.map((row) => row.id),
    ).toContain(channel);
    h.readAt(0).gate.resolve([]);
    await vi.waitFor(() => expect(h.ownerReads).toHaveLength(2));
    expect(h.publications).toEqual([]);
    expect(h.readAt(1).filters).toEqual(h.readAt(0).filters);
    expect(h.readAt(1).signal?.aborted).toBe(false);
    // A normal refresh while the retry is held coalesces into that same read.
    await h.service.refresh();
    expect(h.ownerReads).toHaveLength(2);
    h.readAt(1).gate.resolve([]);
    await expectListed(h);
    expect(h.ownerReads).toHaveLength(2);
    expect(
      h.warn.mock.calls.filter(
        ([text]) => text === "The agent list could not be read",
      ),
    ).toEqual([]);
  } finally {
    await h.dispose();
  }
});

it("coalesces refreshes and keeps an ordinary successful initial listing at one owner read", async () => {
  const h = fixture();
  try {
    await createWhileReading(h);
    await h.service.refresh();
    await h.service.refresh();
    expect(h.ownerReads).toHaveLength(1);
    h.readAt(0).gate.resolve([]);
    await expectListed(h);
    await vi.waitFor(() =>
      expect(h.owner.session.outbox?.snapshot()).toEqual([]),
    );
    await h.service.refresh();
    expect(h.ownerReads).toHaveLength(1);
    expect(h.publications).toHaveLength(1);
    expect(
      h.warn.mock.calls.filter(
        ([text]) => text === "The agent list could not be read",
      ),
    ).toEqual([]);
  } finally {
    await h.dispose();
  }
});

it("does not retry a non-Abort failure or admit an empty list, and retains the local agent for a later explicit refresh", async () => {
  const h = fixture();
  const error = new Error("Synthetic non-transient listing failure");
  try {
    await createWhileReading(h);
    h.readAt(0).gate.reject(error);
    await vi.waitFor(() =>
      expect(h.warn).toHaveBeenCalledWith(
        "The agent list could not be read",
        error,
      ),
    );
    expect(h.ownerReads).toHaveLength(1);
    expect(h.publications).toEqual([]);
    expect(h.service.find(h.agent.pubkey)).toMatchObject({
      name: "Local fixture",
      owner: h.viewer.pubkey,
    });
    await h.service.refresh();
    await vi.waitFor(() => expect(h.ownerReads).toHaveLength(2));
    expect(h.publications).toEqual([]);
    h.readAt(1).gate.resolve([]);
    await expectListed(h);
  } finally {
    await h.dispose();
  }
});

it("stops after two actual epoch cancellations, then a later explicit refresh recovers without losing the created identity", async () => {
  const h = fixture();
  try {
    await createWhileReading(h);
    await discover(h);
    h.readAt(0).gate.resolve([]);
    await vi.waitFor(() => expect(h.ownerReads).toHaveLength(2));
    await h.service.refresh();
    expect(h.ownerReads).toHaveLength(2);
    // A newer signed roster removes channel access while the retry is held.
    await discover(h, [], 1_700_000_001);
    expect(
      h.owner.session.channels.list().channels.map((row) => row.id),
    ).not.toContain(channel);
    h.readAt(1).gate.resolve([]);
    await vi.waitFor(() =>
      expect(h.warn).toHaveBeenCalledWith(
        "The agent list could not be read",
        expect.objectContaining({
          name: "AbortError",
          message: "Stale relay read",
        }),
      ),
    );
    expect(h.ownerReads).toHaveLength(2);
    expect(h.publications).toEqual([]);
    expect(h.service.find(h.agent.pubkey)).toMatchObject({
      name: "Local fixture",
      owner: h.viewer.pubkey,
    });
    await h.service.refresh();
    await vi.waitFor(() => expect(h.ownerReads).toHaveLength(3));
    h.readAt(2).gate.resolve([]);
    await expectListed(h);
    expect(h.ownerReads).toHaveLength(3);
  } finally {
    await h.dispose();
  }
});

it("does not retry or publish from a binding aborted by disconnection", async () => {
  const h = fixture();
  try {
    await createWhileReading(h);
    h.relayData.disconnect();
    expect(h.readAt(0).signal?.aborted).toBe(true);
    h.readAt(0).gate.resolve([]);
    await h.service.refresh();
    // Retire both real owners before the negative late-work assertion.
    await h.dispose();
    expect(h.ownerReads).toHaveLength(1);
    expect(h.publications).toEqual([]);
    expect(h.native.create).toHaveBeenCalledTimes(1);
    expect(await h.native.list()).toEqual([
      expect.objectContaining({
        pubkey: h.agent.pubkey,
        owner: h.viewer.pubkey,
        name: "Local fixture",
      }),
    ]);
    expect(h.fetch).not.toHaveBeenCalled();
    expect(
      h.warn.mock.calls.filter(
        ([text]) => text === "The agent list could not be read",
      ),
    ).toEqual([]);
  } finally {
    await h.dispose();
  }
});

it("waits for the fresh retry's prior record and preserves its unknown settings and tags in the signed update", async () => {
  const h = fixture();
  try {
    await createWhileReading(h);
    await discover(h);
    h.readAt(0).gate.resolve([]);
    await vi.waitFor(() => expect(h.ownerReads).toHaveLength(2));
    expect(h.publications).toEqual([]);
    const prior = signed(h.viewer, {
      kind: 30177,
      tags: [
        ["d", h.agent.pubkey],
        ["runtime", "fixture/echo"],
        ["future", "raw {value}"],
      ],
      content: JSON.stringify({
        name: "Previous server name",
        parallelism: 7,
        respond_to: "mentions-only",
        future: { literal: "raw {value} 한글" },
      }),
    });
    h.readAt(1).gate.resolve([prior]);
    await vi.waitFor(() => expect(h.publications).toHaveLength(1));
    const publication = h.publications[0];
    if (!publication) throw new Error("Signed update missing");
    expect(verifyEvent(publication)).toBe(true);
    expect(publication.pubkey).toBe(h.viewer.pubkey);
    expect(publication.kind).toBe(30177);
    expect(JSON.parse(publication.content)).toEqual({
      name: "Local fixture",
      parallelism: 7,
      respond_to: "mentions-only",
      future: { literal: "raw {value} 한글" },
    });
    expect(publication.tags.filter(([tag]) => tag !== "client-id")).toEqual([
      ["d", h.agent.pubkey],
      ["runtime", "fixture/echo"],
      ["future", "raw {value}"],
    ]);
    expect(h.ownerReads).toHaveLength(2);
    expect(h.native.create).toHaveBeenCalledTimes(1);
    expect(h.fetch).not.toHaveBeenCalled();
  } finally {
    await h.dispose();
  }
});
