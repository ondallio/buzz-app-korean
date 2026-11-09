// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { formatFullTimestamp } from "../../shared/datetime";
import { ToastProvider } from "../../shared/design-system/ui/Toast";
import { createAgentMemories, type MemoryListing } from "./memory";
import { MemoryPanel, type MemoryLinks } from "./MemoryPanel";
import { createRelaySession } from "../relay/session";
import { matchesEvent } from "../relay/projection";
import { keypair, signed } from "../relay/testing";
import { LinkLabel, linkKind } from "../../bundled/links/InlineLink";
import type { Agent } from "./service";
import type { AgentScopeReader } from "./AgentCommunityScope";
import type { CommunityReader } from "../communities/service";
import { PanelWorkspace } from "../panels/PanelWorkspace";
import { setLanguage } from "../../shared/i18n";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  setLanguage("en");
});

it("keeps open raw memory content and focus across languages without rereading", async () => {
  setLanguage("en");
  const read = vi.fn(async () => ({
    entries: [
      entry("core", "No memories yet"),
      entry(
        "mem/memory",
        "Raw **Markdown** {body} 한글 [link](https://example.org/notes)",
      ),
    ],
    partial: false,
  }));
  const h = setup(read);
  const user = userEvent.setup();
  try {
    const core = await screen.findByRole("region", { name: "Core memories" });
    const details = screen.getByRole("region", { name: "Memories" });
    const coreTrigger = within(core).getByRole("button", { name: "core" });
    await user.click(coreTrigger);
    const body = within(core).getByText("No memories yet");
    const trigger = within(details).getByRole("button", { name: "mem/memory" });
    await user.click(trigger);
    const markdown = within(details).getByRole("link", { name: "link" });
    trigger.focus();
    expect(read).toHaveBeenCalledOnce();
    act(() => setLanguage("ko"));
    expect(screen.getByRole("region", { name: "핵심 기억" })).toBe(core);
    expect(screen.getByRole("region", { name: "기억" })).toBe(details);
    expect(within(core).getByRole("button", { name: "core" })).toBe(
      coreTrigger,
    );
    expect(coreTrigger).toHaveAttribute("aria-expanded", "true");
    expect(within(core).getByText("No memories yet")).toBe(body);
    expect(within(details).getByRole("button", { name: "mem/memory" })).toBe(
      trigger,
    );
    expect(trigger).toHaveFocus();
    expect(markdown).toHaveAttribute("href", "https://example.org/notes");
    expect(within(details).getByText("Markdown")).toHaveProperty(
      "tagName",
      "STRONG",
    );
    expect(read).toHaveBeenCalledOnce();
    act(() => setLanguage("en"));
    expect(screen.getByRole("region", { name: "Core memories" })).toBe(core);
    expect(trigger).toHaveFocus();
    expect(read).toHaveBeenCalledOnce();
  } finally {
    h.unmount();
    h.owner.dispose();
  }
});

it("keeps retry state and partial entries live across language changes", async () => {
  const user = userEvent.setup();
  let finish: (value: MemoryListing) => void = () => {};
  const pending = new Promise<MemoryListing>((resolve) => {
    finish = resolve;
  });
  const read = vi
    .fn<() => Promise<MemoryListing>>()
    .mockResolvedValueOnce({
      entries: [entry("core", "Some memories couldn't be shown.")],
      partial: true,
    })
    .mockReturnValueOnce(pending);
  const h = setup(read);
  try {
    await screen.findByRole("region", { name: "Core memories" });
    await openCore();
    const body = within(
      screen.getByRole("region", { name: "Core memories" }),
    ).getByText("Some memories couldn't be shown.");
    const retry = screen.getByRole("button", {
      name: "Retry loading memories",
    });
    retry.focus();
    act(() => setLanguage("ko"));
    expect(screen.getByRole("button", { name: "기억 다시 불러오기" })).toBe(
      retry,
    );
    expect(retry).toHaveFocus();
    expect(screen.getByText("일부 기억을 표시하지 못했습니다.")).toBeVisible();
    expect(body).toHaveTextContent("Some memories couldn't be shown.");
    await user.click(retry);
    expect(screen.getByRole("status")).toHaveTextContent(
      "기억을 더 불러오는 중…",
    );
    act(() => setLanguage("en"));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading more memories…",
    );
    expect(body).toBeInTheDocument();
    expect(read).toHaveBeenCalledTimes(2);
    await act(async () => finish({ entries: [], partial: false }));
    act(() => setLanguage("ko"));
    expect(screen.getAllByText("아직 기억이 없습니다")).toHaveLength(2);
    expect(read).toHaveBeenCalledTimes(2);
  } finally {
    h.unmount();
    h.owner.dispose();
  }
});

it.each([
  ["loading", "Loading memories", "기억 불러오는 중"],
  [
    "blocked",
    "Memory can be read once Buzz is connected.",
    "Buzz에 연결되면 기억을 읽을 수 있습니다.",
  ],
  [
    "denied",
    "This community doesn't let you read this agent's memory.",
    "이 커뮤니티에서는 이 에이전트의 기억을 읽을 수 없습니다.",
  ],
  ["error", "Memory couldn't be read.", "기억을 읽지 못했습니다."],
  [
    "unavailable",
    "Memory isn't available here.",
    "여기서는 기억을 사용할 수 없습니다.",
  ],
] as const)(
  "renders the finite %s read state without restarting its view",
  async (state, english, korean) => {
    const read = vi.fn(async (): Promise<MemoryListing> => {
      if (state === "loading") return new Promise(() => {});
      const error = new Error("Some memories couldn't be shown.");
      if (state === "denied") error.name = "MemoryDenied";
      throw error;
    });
    const owner = createAgentMemories(
      state === "unavailable" ? undefined : read,
      "c".repeat(64),
      () => state !== "blocked",
    );
    const view = render(
      <MemoryPanel
        agents={scopeAgents}
        agent={agent}
        memories={owner.capability}
      />,
    );
    try {
      const message =
        state === "loading"
          ? await screen.findByRole("status", { name: english })
          : await screen.findByText(english);
      const calls = state === "blocked" || state === "unavailable" ? 0 : 1;
      expect(read).toHaveBeenCalledTimes(calls);
      act(() => setLanguage("ko"));
      expect(
        state === "loading"
          ? screen.getByRole("status", { name: korean })
          : screen.getByText(korean),
      ).toBe(message);
      expect(screen.queryByText("Some memories couldn't be shown.")).toBeNull();
      act(() => setLanguage("en"));
      expect(
        state === "loading"
          ? screen.getByRole("status", { name: english })
          : screen.getByText(english),
      ).toBe(message);
      expect(read).toHaveBeenCalledTimes(calls);
    } finally {
      view.unmount();
      owner.dispose();
    }
  },
);

it.each([false, true])(
  "keeps copied-body feedback live after its panel closes (failure=%s)",
  async (fails) => {
    const user = userEvent.setup();
    let settle: () => void = () => {};
    const pending = new Promise<void>((resolve, reject) => {
      settle = () =>
        fails ? reject(new Error("Memory body copied.")) : resolve();
    });
    const write = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockReturnValue(pending);
    const raw = "Memory body copied. **raw** {count} 한글";
    const owner = createAgentMemories(
      async () => ({ entries: [entry("core", raw)], partial: false }),
      "c".repeat(64),
      () => true,
    );
    const view = render(
      <ToastProvider>
        <MemoryPanel
          agents={scopeAgents}
          agent={agent}
          memories={owner.capability}
        />
      </ToastProvider>,
    );
    try {
      fireEvent.contextMenu(
        await screen.findByRole("button", { name: "core" }),
      );
      const item = await screen.findByRole("menuitem", {
        name: "Copy full body",
      });
      act(() => setLanguage("ko"));
      expect(
        await screen.findByRole("menuitem", { name: "전체 내용 복사" }),
      ).toBe(item);
      await user.click(item);
      expect(write).toHaveBeenCalledExactlyOnceWith(raw);
      view.rerender(<ToastProvider>{null}</ToastProvider>);
      await act(async () => settle());
      const notice = await screen.findByText(
        fails
          ? "기억 내용을 복사하지 못했습니다."
          : "기억 내용을 복사했습니다.",
      );
      act(() => setLanguage("en"));
      expect(
        screen.getByText(
          fails ? "Couldn’t copy the memory body." : "Memory body copied.",
        ),
      ).toBe(notice);
      expect(write).toHaveBeenCalledExactlyOnceWith(raw);
    } finally {
      view.unmount();
      owner.dispose();
    }
  },
);

it.each([
  [-60, "just now", "방금"],
  [59, "just now", "방금"],
  [60, "1 minute ago", "1분 전"],
  [120, "2 minutes ago", "2분 전"],
  [3600, "1 hour ago", "1시간 전"],
  [7200, "2 hours ago", "2시간 전"],
  [86400, "1 day ago", "1일 전"],
  [172800, "2 days ago", "2일 전"],
  [604800, "1 week ago", "1주 전"],
  [1209600, "2 weeks ago", "2주 전"],
  [2592000, "1 month ago", "1개월 전"],
  [5097600, "1 month ago", "1개월 전"],
  [5184000, undefined, undefined],
] as const)(
  "preserves the memory recency ladder at age %s seconds in the OS zone",
  async (age, english, korean) => {
    const now = Date.UTC(2026, 2, 8, 6, 30) / 1000;
    vi.spyOn(Date, "now").mockReturnValue(now * 1000);
    const timestamp = now - age;
    const read = vi.fn(async () => ({
      entries: [entry("core", "Raw", timestamp)],
      partial: false,
    }));
    const h = setup(read);
    try {
      const region = await screen.findByRole("region", {
        name: "Core memories",
      });
      const label = within(region).getByTitle(formatFullTimestamp(timestamp));
      const englishDate = new Date(timestamp * 1000).toLocaleDateString(
        "en-US",
        { month: "short", day: "numeric" },
      );
      expect(label).toHaveTextContent(english ?? englishDate);
      act(() => setLanguage("ko"));
      expect(within(region).getByTitle(formatFullTimestamp(timestamp))).toBe(
        label,
      );
      expect(label).toHaveTextContent(
        korean ??
          new Date(timestamp * 1000).toLocaleDateString("ko-KR", {
            month: "short",
            day: "numeric",
          }),
      );
      act(() => setLanguage("en"));
      expect(label).toHaveTextContent(english ?? englishDate);
      expect(read).toHaveBeenCalledOnce();
    } finally {
      h.unmount();
      h.owner.dispose();
    }
  },
);

const pubkey = "a".repeat(64);
const agent = {
  pubkey,
  name: "Ada",
  relay: "wss://current.example",
  place: "here",
} as Agent;
const entry = (slug: string, body: string, createdAt = 1_700_000_000) => ({
  slug,
  body,
  eventId: "b".repeat(64),
  createdAt,
});

const scopeAgents: AgentScopeReader = {
  subscribe: () => () => {},
  memberships: () => [
    { key: pubkey, origin: "https://current.example", connected: true },
    { key: "other", origin: "https://other.example", connected: false },
  ],
};

/** Opens core, whose body renders only while it is open. */
async function openCore() {
  fireEvent.click(await screen.findByRole("button", { name: "core" }));
}

function setup(
  read: (
    agent: string,
    signal: AbortSignal,
    slug?: string,
    onPage?: (page: MemoryListing) => void,
  ) => Promise<MemoryListing>,
  communities?: CommunityReader,
  links?: MemoryLinks,
) {
  const owner = createAgentMemories(vi.fn(read), "c".repeat(64), () => true);
  return {
    owner,
    memories: owner.capability,
    ...render(
      <MemoryPanel
        agents={scopeAgents}
        agent={agent}
        memories={owner.capability}
        communities={communities}
        links={links}
      />,
      {
        wrapper: ToastProvider,
      },
    ),
  };
}

it("shows core first, then other memories in Markdown accordions", async () => {
  const user = userEvent.setup();
  setup(async () => ({
    entries: [
      entry("mem/notes", "Cold detail."),
      entry("core", "I am **Ada**.\n\nKeep it short."),
    ],
    partial: false,
  }));
  const core = await screen.findByRole("region", { name: "Core memories" });
  expect(
    within(core).getByText(
      "Included in this agent’s context for every session.",
    ),
  ).toBeInTheDocument();
  expect(
    within(screen.getByRole("region", { name: "Memories" })).getByText(
      "Details the agent can look up as needed.",
    ),
  ).toBeInTheDocument();
  expect(
    within(core).queryByRole("button", { name: "Refresh" }),
  ).not.toBeInTheDocument();
  const coreTrigger = within(core).getByRole("button", { name: "core" });
  expect(coreTrigger).toHaveAttribute("aria-expanded", "false");
  // A closed memory's body, core's too, is not rendered until it opens.
  expect(within(core).queryByText("Keep it short.")).toBeNull();
  await user.click(within(coreTrigger).getByText("core"));
  expect(coreTrigger).toHaveAttribute("aria-expanded", "true");
  await user.keyboard("{Enter}");
  expect(coreTrigger).toHaveAttribute("aria-expanded", "false");
  await user.keyboard(" ");
  expect(coreTrigger).toHaveAttribute("aria-expanded", "true");
  expect(within(core).getByText("Ada").tagName).toBe("STRONG");
  const references = screen.getByRole("region", {
    name: "Memories",
  });
  expect(
    within(references).getByRole("button", { name: "mem/notes" }),
  ).toBeInTheDocument();
  expect(
    within(references).getByTitle(formatFullTimestamp(1_700_000_000)),
  ).toBeInTheDocument();
  // A closed memory's body is not rendered until it opens.
  expect(within(references).queryByText("Cold detail.")).toBeNull();
  await user.click(
    within(references).getByRole("button", { name: "mem/notes" }),
  );
  expect(within(references).getByText("Cold detail.")).toBeVisible();
  expect(within(references).queryByText("core")).not.toBeInTheDocument();
});

it("renders rich memory blocks and preserves authored line breaks", async () => {
  const { container } = setup(async () => ({
    entries: [
      entry(
        "core",
        "# Priorities\n\nFirst line.\nSecond line.\n\n" +
          "- **Keep** context\n- *Read* sources\n\n" +
          "> Remember why.\n\n`inline`\n\n```ts\nconst safe = true;\n```\n\n" +
          "| Topic | Status |\n| --- | --- |\n| Memory | Ready |\n\n" +
          "[Guide](https://example.com/guide)",
      ),
    ],
    partial: false,
  }));
  await openCore();
  expect(
    screen.getByRole("heading", { name: "Priorities", level: 1 }),
  ).toBeVisible();
  const paragraph = screen.getByText(/First line/);
  expect(paragraph.querySelector("br")).toBeInTheDocument();
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  expect(screen.getByText("Keep").tagName).toBe("STRONG");
  expect(screen.getByText("Read").tagName).toBe("EM");
  expect(container.querySelector("blockquote")).toHaveTextContent(
    "Remember why.",
  );
  expect(container.querySelector("pre > code")).toHaveTextContent(
    "const safe = true;",
  );
  expect(screen.getByRole("table")).toHaveTextContent("MemoryReady");
  expect(screen.getByRole("link", { name: "Guide" })).toHaveAttribute(
    "href",
    "https://example.com/guide",
  );
});

it("keeps memory images and raw HTML inert and unsafe links inactive", async () => {
  const { container } = setup(async () => ({
    entries: [
      entry(
        "core",
        "![Private diagram](https://example.com/private.png)\n\n" +
          '<img src="https://example.com/track.png">\n\n' +
          "[Unsafe](javascript:alert%281%29)",
      ),
    ],
    partial: false,
  }));
  await openCore();
  expect(screen.getByText("Private diagram")).toBeVisible();
  expect(screen.getByText("Unsafe")).toBeVisible();
  expect(container.querySelector("img, script, iframe")).toBeNull();
  expect(screen.queryByRole("link")).toBeNull();
});

const channelId = "11111111-1111-4111-8111-111111111111";
const buzzUrl = `buzz://message?channel=${channelId}&id=${"e".repeat(64)}`;

it("preserves memory link focus and notice across fresh parent link props", async () => {
  const session = createRelaySession({
    viewer: pubkey,
    relayAuthor: "d".repeat(64),
    media: () => undefined,
    query: async () => [],
  });
  const open = vi.fn(() => false);
  const nextOpen = vi.fn(() => true);
  const view = setup(
    async () => ({
      entries: [entry("core", `[Read evidence](${buzzUrl})`)],
      partial: false,
    }),
    undefined,
    { session: session.session, registry: undefined, open },
  );
  const parent = (open: MemoryLinks["open"]) => (
    <MemoryPanel
      agents={scopeAgents}
      agent={agent}
      memories={view.memories}
      links={{ session: session.session, registry: undefined, open }}
    />
  );
  try {
    await openCore();
    const link = screen.getByRole("link", { name: "Read evidence" });
    fireEvent.click(link);
    expect(open).toHaveBeenCalledExactlyOnceWith(buzzUrl);
    expect(link).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent(
      "This Buzz link couldn’t be opened here.",
    );

    view.rerender(parent(open));
    expect(screen.getByRole("link", { name: "Read evidence" })).toBe(link);
    expect(link).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent(
      "This Buzz link couldn’t be opened here.",
    );

    // A stable component must still read the latest navigation callback.
    view.rerender(parent(nextOpen));
    expect(screen.getByRole("link", { name: "Read evidence" })).toBe(link);
    expect(link).toHaveFocus();
    expect(screen.getByRole("status")).toBeVisible();
    fireEvent.click(link);
    expect(nextOpen).toHaveBeenCalledExactlyOnceWith(buzzUrl);
    expect(open).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("status")).toBeNull();
  } finally {
    view.unmount();
    session.dispose();
  }
});

it("dismisses a hovered memory preview before closing its containing detail", async () => {
  const session = createRelaySession(null);
  const memories = createAgentMemories(
    async () => ({
      entries: [entry("core", `[Source](${buzzUrl})`)],
      partial: false,
    }),
    "c".repeat(64),
    () => true,
  );
  const close = vi.fn();
  const view = render(
    <PanelWorkspace
      value="agent"
      select={() => {}}
      items={[
        {
          id: "agent",
          label: "Agent",
          close,
          content: (
            <MemoryPanel
              agents={scopeAgents}
              agent={agent}
              memories={memories.capability}
              links={{
                session: session.session,
                registry: undefined,
                open: () => false,
              }}
            />
          ),
        },
      ]}
    />,
  );
  const user = userEvent.setup();
  try {
    await openCore();
    const link = screen.getByRole("link", { name: "Source" });
    const trigger = screen.getByRole("button", { name: "core" });
    act(() => trigger.focus());
    await user.hover(link);
    await waitFor(() => expect(link).toHaveAttribute("data-popup-open"));
    expect(trigger).toHaveFocus();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(link).not.toHaveAttribute("data-popup-open"));
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "core" })).toBeVisible();
    await user.keyboard("{Escape}");
    expect(close).toHaveBeenCalledTimes(1);
  } finally {
    view.unmount();
    session.dispose();
  }
});

it("links bare and labelled Buzz URLs in prose without changing code or nesting links", async () => {
  const { container } = setup(async () => ({
    entries: [
      entry(
        "core",
        `Evidence: ${buzzUrl}. Next.\n\n` +
          `[Read **evidence**](${buzzUrl})\n\n<${buzzUrl}>\n\n` +
          `\`${buzzUrl}\`\n\n\`\`\`text\n${buzzUrl}\n\`\`\`\n\n` +
          `[External](https://example.com/?ref=${buzzUrl})\n\n` +
          "buzz://unknown\n\n[Invalid](buzz://message?channel=design&id=bad)",
      ),
    ],
    partial: false,
  }));
  await openCore();
  const anchors = screen.getAllByRole("link");
  expect(
    anchors.filter((link) => link.getAttribute("href") === buzzUrl),
  ).toHaveLength(3);
  expect(
    screen.getByRole("link", { name: "Read evidence" }).querySelector("strong"),
  ).toHaveTextContent("evidence");
  expect(screen.getByText(/^Evidence:/)).toHaveTextContent(
    `Evidence: ${buzzUrl}. Next.`,
  );
  expect(
    [...container.querySelectorAll("code")].map((node) =>
      node.textContent?.trim(),
    ),
  ).toEqual([buzzUrl, buzzUrl]);
  expect(container.querySelector("a a, code a")).toBeNull();
  expect(screen.getByRole("link", { name: "External" })).toHaveAttribute(
    "href",
    `https://example.com/?ref=${buzzUrl}`,
  );
  expect(screen.getByText("buzz://unknown")).toBeVisible();
  expect(screen.getByText("Invalid").closest("a")).toBeNull();
  fireEvent.click(within(screen.getByText(/^Evidence:/)).getByRole("link"));
  expect(screen.getByRole("status")).toHaveTextContent(
    "This Buzz link couldn’t be opened here.",
  );
});

it("resolves shared message labels and icons only when expanded and opens the original destination", async () => {
  const viewer = keypair(),
    relay = keypair(),
    author = keypair();
  const linked = signed(author, {
    kind: 9,
    content: "Evidence from the linked message",
    tags: [["h", channelId]],
  });
  const url = `buzz://message?channel=${channelId}&id=${linked.id}`;
  const events = [
    signed(relay, {
      kind: 39000,
      content: "",
      tags: [
        ["d", channelId],
        ["name", "research"],
        ["t", "stream"],
      ],
    }),
    signed(relay, {
      kind: 39001,
      content: "",
      tags: [
        ["d", channelId],
        ["p", viewer.pubkey, "owner"],
      ],
    }),
    signed(relay, {
      kind: 39002,
      content: "",
      tags: [
        ["d", channelId],
        ["p", viewer.pubkey],
        ["p", author.pubkey],
      ],
    }),
    signed(author, {
      kind: 0,
      content: JSON.stringify({ name: "Carl" }),
      tags: [],
    }),
    linked,
  ];
  const owner = createRelaySession({
    viewer: viewer.pubkey,
    relayAuthor: relay.pubkey,
    media: () => undefined,
    query: async (filters) =>
      events.filter((event) =>
        filters.some((filter) => matchesEvent(event, filter)),
      ),
  });
  const registry = {
    subscribe: () => () => {},
    snapshot: () => renderers,
  };
  const renderers = [
    {
      id: "links",
      key: "test/links",
      pluginId: "test",
      revision: "one",
      title: "Links",
      matches: (url: string) => linkKind(url) !== null,
      component: ({ url }: { url: string }) => <LinkLabel href={url} />,
    },
  ];
  const open = vi.fn(() => true);
  const thread = vi.fn(owner.session.thread);
  let view: ReturnType<typeof setup> | undefined;
  try {
    owner.session.channels.ensureList();
    await vi.waitFor(() =>
      expect(owner.session.channels.list().status).toBe("ready"),
    );
    view = setup(
      async () => ({
        entries: [entry("core", `${url}\n\n${url}`)],
        partial: false,
      }),
      undefined,
      { session: { ...owner.session, thread }, registry, open },
    );
    await screen.findByRole("button", { name: "core" });
    expect(thread).not.toHaveBeenCalled();
    await openCore();
    const anchors = await screen.findAllByRole("link", {
      name: "Carl in #research",
    });
    expect(anchors).toHaveLength(2);
    const first = anchors[0];
    if (!first) throw new Error("Missing resolved memory link");
    expect(
      anchors[0]?.querySelector('[data-link-kind="message"] svg'),
    ).not.toBeNull();
    expect(thread).toHaveBeenCalledTimes(1);
    fireEvent.click(first);
    expect(open).toHaveBeenCalledExactlyOnceWith(url);
    // A later open still uses the shared session cache.
    await openCore();
    await openCore();
    await screen.findAllByRole("link", { name: "Carl in #research" });
    expect(thread).toHaveBeenCalledTimes(1);
    expect(
      screen.getAllByRole("link", { name: "Carl in #research" })[0],
    ).toHaveAttribute("data-preview-card-trigger");
  } finally {
    view?.unmount();
    owner.dispose();
  }
});

it("explains memory scope for the current community and follows its presentation", async () => {
  const user = userEvent.setup();
  let known = {
    memberships: [
      { id: "https://other.example", name: "Other" },
      {
        id: "https://current.example",
        name: "Feedback",
        icon: "https://images.example/community.png",
      },
    ],
  };
  const listeners = new Set<() => void>();
  const communities = {
    snapshot: () => known,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  } as unknown as CommunityReader;
  const view = setup(
    async () => ({ entries: [], partial: false }),
    communities,
  );
  const core = await screen.findByRole("region", { name: "Core memories" });
  const trigger = within(core).getByRole("button", {
    name: "Memory scope: Feedback",
  });
  expect(
    within(screen.getByRole("region", { name: "Memories" })).getByRole(
      "button",
      { name: "Memory scope: Feedback" },
    ),
  ).toBeInTheDocument();
  expect(trigger.querySelector("img")).toHaveAttribute(
    "src",
    "https://images.example/community.png",
  );
  await user.tab();
  expect(trigger).toHaveFocus();
  await user.keyboard("{Enter}");
  const popup = await screen.findByRole("dialog", { name: "Memory scope" });
  expect(popup).toHaveTextContent(
    "Memories are specific to this community and aren’t shared with other communities.",
  );
  expect(within(popup).getByText("Feedback")).toBeInTheDocument();
  expect(popup.querySelector("img")).toHaveAttribute(
    "src",
    "https://images.example/community.png",
  );
  await user.keyboard("{Escape}");
  expect(trigger).toHaveFocus();
  act(() => {
    known = {
      memberships: [
        {
          id: "https://current.example",
          name: "Renamed",
          icon: "javascript:alert(1)",
        },
      ],
    };
    for (const listener of listeners) listener();
  });
  expect(
    within(core)
      .getByRole("button", { name: "Memory scope: Renamed" })
      .querySelector("img"),
  ).toBeNull();
  view.unmount();
  expect(listeners.size).toBe(0);
});

it("announces that memories are loading", async () => {
  setup(() => new Promise<MemoryListing>(() => {}));
  expect(
    await screen.findByRole("status", { name: "Loading memories" }),
  ).toBeInTheDocument();
  expect(screen.queryByText("Loading memory…")).not.toBeInTheDocument();
});

it("shows memories as each page arrives and says more are loading", async () => {
  let finish: (listing: MemoryListing) => void = () => {};
  let page: ((page: MemoryListing) => void) | undefined;
  setup((_agent, _signal, _slug, onPage) => {
    page = onPage;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  await vi.waitFor(() => expect(page).toBeDefined());
  act(() => page?.({ entries: [entry("mem/first", "One.")], partial: false }));
  expect(
    await screen.findByRole("button", { name: /first/ }),
  ).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent(
    "Loading more memories…",
  );
  act(() => page?.({ entries: [entry("mem/second", "Two.")], partial: false }));
  expect(
    await screen.findByRole("button", { name: /second/ }),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /first/ })).toBeInTheDocument();
  await act(async () =>
    finish({
      entries: [entry("mem/first", "One."), entry("mem/second", "Two.")],
      partial: false,
    }),
  );
  await vi.waitFor(() =>
    expect(
      screen.queryByText("Loading more memories…"),
    ).not.toBeInTheDocument(),
  );
  expect(
    screen.queryByText("Some memories couldn't be shown."),
  ).not.toBeInTheDocument();
});

it("stops a streamed read and drops its memories when the panel closes mid-stream", async () => {
  let signal: AbortSignal | undefined;
  let page: ((page: MemoryListing) => void) | undefined;
  const { owner, unmount } = setup((_agent, aborted, _slug, onPage) => {
    signal = aborted;
    page = onPage;
    return new Promise(() => {});
  });
  await vi.waitFor(() => expect(page).toBeDefined());
  act(() => page?.({ entries: [entry("mem/first", "One.")], partial: false }));
  await screen.findByRole("button", { name: /first/ });
  unmount();
  expect(signal?.aborted).toBe(true);
  // A page landing after the close is not kept anywhere.
  const view = owner.capability.open(pubkey);
  page?.({ entries: [entry("mem/late", "Late.")], partial: false });
  expect(view.snapshot().listing).toBeUndefined();
  view.dispose();
});

it("shows memories newest first without a sorting control", async () => {
  setup(async () => ({
    entries: [
      entry("core", "Core.", 400),
      entry("mem/alpha", "First.", 100),
      entry("mem/zulu", "Last.", 300),
      entry("mem/middle", "Middle.", 200),
    ],
    partial: false,
  }));
  const references = await screen.findByRole("region", {
    name: "Memories",
  });
  const core = screen.getByRole("region", { name: "Core memories" });
  expect(
    screen.queryByRole("button", { name: "Organize memories" }),
  ).not.toBeInTheDocument();
  const titles = () =>
    [
      ...references.querySelectorAll<HTMLButtonElement>(
        "[data-memory-list] button[aria-expanded]",
      ),
    ].map((button) => button.getAttribute("aria-label"));
  expect(titles()).toEqual([
    expect.stringContaining("mem/zulu"),
    expect.stringContaining("mem/middle"),
    expect.stringContaining("mem/alpha"),
  ]);
  expect(
    within(references).getByTitle(formatFullTimestamp(300)),
  ).toBeInTheDocument();
  expect(within(core).getByTitle(formatFullTimestamp(400))).toBeInTheDocument();

  expect(titles()).toEqual([
    expect.stringContaining("mem/zulu"),
    expect.stringContaining("mem/middle"),
    expect.stringContaining("mem/alpha"),
  ]);
  expect(
    within(references).getByTitle(formatFullTimestamp(300)),
  ).toBeInTheDocument();
  expect(within(core).getByTitle(formatFullTimestamp(400))).toBeInTheDocument();
});

it("copies a memory from its context menu", async () => {
  const user = userEvent.setup();
  const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  setup(async () => ({
    entries: [entry("core", "Complete **Markdown** body.")],
    partial: false,
  }));
  const core = await screen.findByRole("region", { name: "Core memories" });
  expect(
    within(core).queryByRole("button", { name: "Actions for core" }),
  ).not.toBeInTheDocument();

  fireEvent.contextMenu(within(core).getByRole("button", { name: "core" }));
  await user.click(await screen.findByRole("menuitem", { name: "Copy name" }));
  expect(write).toHaveBeenLastCalledWith("core");
  expect(screen.getByText("Memory name copied.")).toBeVisible();

  fireEvent.contextMenu(within(core).getByRole("button", { name: "core" }));
  await user.click(
    await screen.findByRole("menuitem", { name: "Copy full body" }),
  );
  expect(write).toHaveBeenLastCalledWith("Complete **Markdown** body.");
  expect(screen.getByText("Memory body copied.")).toBeVisible();

  write.mockRejectedValueOnce(new Error("denied"));
  fireEvent.contextMenu(within(core).getByRole("button", { name: "core" }));
  await user.click(
    await screen.findByRole("menuitem", { name: "Copy full body" }),
  );
  expect(screen.getByText("Couldn’t copy the memory body.")).toBeVisible();

  fireEvent.contextMenu(within(core).getByRole("button", { name: "core" }));
  expect(
    await screen.findByRole("menuitem", { name: "Copy name" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("menuitem", { name: "Copy ID" }),
  ).not.toBeInTheDocument();
});

it("says when the agent has no memory yet", async () => {
  setup(async () => ({ entries: [], partial: false }));
  const core = await screen.findByRole("region", { name: "Core memories" });
  const memories = screen.getByRole("region", { name: "Memories" });
  for (const section of [core, memories]) {
    const empty = within(section).getByText("No memories yet");
    expect(empty.closest(".buzz-settings-group")).toBeInTheDocument();
    expect(section.querySelector("svg[aria-hidden=true]")).toBeInTheDocument();
  }
});

it("reports a failed read and reads again on refresh", async () => {
  const user = userEvent.setup();
  let fail = true;
  setup(async () => {
    if (fail) throw new Error("offline");
    return { entries: [entry("core", "Back.")], partial: false };
  });
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Memory couldn't be read.",
  );
  fail = false;
  await user.click(screen.getByRole("button", { name: "Refresh" }));
  await openCore();
  expect(await screen.findByText("Back.")).toBeInTheDocument();
});

it("shows pages streamed by a Retry of a partial listing before it finishes", async () => {
  const user = userEvent.setup();
  let page: ((page: MemoryListing) => void) | undefined;
  let finish: (listing: MemoryListing) => void = () => {};
  let calls = 0;
  setup((_agent, _signal, _slug, onPage) => {
    if (++calls === 1)
      return Promise.resolve({
        entries: [entry("mem/first", "One.")],
        partial: true,
      });
    page = onPage;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  await screen.findByText("Some memories couldn't be shown.");
  await user.click(
    screen.getByRole("button", { name: "Retry loading memories" }),
  );
  await vi.waitFor(() => expect(page).toBeDefined());
  act(() => page?.({ entries: [entry("mem/second", "Two.")], partial: false }));
  expect(
    await screen.findByRole("button", { name: /second/ }),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /first/ })).toBeInTheDocument();
  await act(async () =>
    finish({
      entries: [entry("mem/first", "One."), entry("mem/second", "Two.")],
      partial: false,
    }),
  );
  await vi.waitFor(() =>
    expect(screen.queryByText("Some memories couldn't be shown.")).toBeNull(),
  );
});

it("shows nothing to read without a session", () => {
  render(
    <MemoryPanel agents={scopeAgents} agent={agent} memories={undefined} />,
  );
  expect(screen.getByText("Memory isn't available here.")).toBeInTheDocument();
});

it("clears displayed plaintext when its session invalidates the view", async () => {
  const user = userEvent.setup();
  const { owner } = setup(async () => ({
    entries: [entry("core", "I am Ada.")],
    partial: false,
  }));
  const trigger = await screen.findByRole("button", { name: "core" });
  await user.click(trigger);
  expect(trigger).toHaveAttribute("aria-expanded", "true");
  await screen.findByText("I am Ada.");

  owner.clear();

  expect(await screen.findByText("Memory isn't loaded.")).toBeInTheDocument();
  expect(screen.queryByText("I am Ada.")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "core" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Actions for core" }),
  ).not.toBeInTheDocument();
});

it("holds one revocable memory view until the panel unmounts", async () => {
  const { memories, unmount } = setup(async () => ({
    entries: [entry("core", "I am Ada.")],
    partial: false,
  }));
  await openCore();
  await screen.findByText("I am Ada.");
  // The panel retains one of the session's four views while it retains text.
  const views = Array.from({ length: 3 }, () => memories.open(pubkey));
  expect(() => memories.open(pubkey)).toThrow("Memory views unavailable");
  for (const view of views) view.dispose();
  unmount();
  expect(() => memories.open(pubkey)).not.toThrow();
});

it("loads memories automatically without a refresh control in the loaded view", async () => {
  const read = vi.fn(async () => ({
    entries: [entry("core", "Remember.")],
    partial: false,
  }));
  setup(read);
  await screen.findByRole("region", { name: "Core memories" });
  expect(read).toHaveBeenCalledTimes(1);
  expect(
    screen.queryByRole("button", { name: "Refresh" }),
  ).not.toBeInTheDocument();
});

it("retries a partial listing while retaining its memories until recovery", async () => {
  const user = userEvent.setup();
  let complete: (listing: MemoryListing) => void = () => {};
  const pending = new Promise<MemoryListing>((resolve) => {
    complete = resolve;
  });
  const read = vi
    .fn<() => Promise<MemoryListing>>()
    .mockResolvedValueOnce({
      entries: [entry("core", "Retained.")],
      partial: true,
    })
    .mockReturnValueOnce(pending);
  setup(read);
  await screen.findByText("Some memories couldn't be shown.");
  await openCore();
  const retry = screen.getByRole("button", { name: "Retry loading memories" });
  await user.click(retry);
  // The retry shows what it holds and says more are loading, in place of the
  // Retry it replaces.
  expect(screen.getByRole("status")).toHaveTextContent(
    "Loading more memories…",
  );
  expect(
    screen.queryByRole("button", { name: "Retry loading memories" }),
  ).toBeNull();
  expect(screen.getByText("Retained.")).toBeInTheDocument();
  expect(document.querySelector("[data-memory-list]")).toHaveAttribute(
    "data-refreshing",
    "true",
  );
  expect(read).toHaveBeenCalledTimes(2);
  await act(async () =>
    complete({ entries: [entry("core", "Recovered.")], partial: false }),
  );
  expect(await screen.findByText("Recovered.")).toBeInTheDocument();
  expect(screen.queryByText("Some memories couldn't be shown.")).toBeNull();
  expect(
    screen.queryByRole("button", { name: /Retry loading memories|Refresh/ }),
  ).toBeNull();
});

it("keeps shown memories beside the error when a later page fails, then recovers", async () => {
  const user = userEvent.setup();
  let calls = 0;
  setup(async (_agent, _signal, _slug, onPage) => {
    if (++calls === 1) {
      onPage?.({ entries: [entry("mem/first", "One.")], partial: true });
      throw new Error("HTTP 500");
    }
    return {
      entries: [entry("mem/first", "One."), entry("mem/second", "Two.")],
      partial: false,
    };
  });
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Memory couldn't be read.",
  );
  expect(screen.getByRole("button", { name: /first/ })).toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Retry loading memories" }),
  );
  expect(
    await screen.findByRole("button", { name: /second/ }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("keeps a failed page's memories through a pending and failed Retry, then recovers", async () => {
  const user = userEvent.setup();
  const held: {
    resolve: (listing: MemoryListing) => void;
    reject: (error: Error) => void;
  }[] = [];
  const read = vi.fn(
    (
      _agent: string,
      _signal: AbortSignal,
      _slug?: string,
      onPage?: (page: MemoryListing) => void,
    ) =>
      new Promise<MemoryListing>((resolve, reject) => {
        if (read.mock.calls.length === 1)
          onPage?.({
            entries: [entry("core", "Kept."), entry("mem/first", "One.")],
            partial: true,
          });
        held.push({ resolve, reject });
      }),
  );
  setup(read);
  const fail = async () =>
    act(async () => held.at(-1)?.reject(new Error("broken")));
  const shown = () => {
    expect(screen.getByRole("button", { name: "core" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /first/ })).toBeInTheDocument();
  };
  // 1–2: a page loads, then a later page fails.
  await screen.findByRole("button", { name: /first/ });
  await fail();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Memory couldn't be read.",
  );
  shown();
  // 3: Retry is held pending.
  await user.click(
    screen.getByRole("button", { name: "Retry loading memories" }),
  );
  const retries = read.mock.calls.length;
  expect(retries).toBeGreaterThan(1);
  shown();
  // 4: the Retry fails before sending any page.
  await fail();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Memory couldn't be read.",
  );
  shown();
  // 5: a read succeeds and recovers.
  await user.click(
    screen.getByRole("button", { name: "Retry loading memories" }),
  );
  await act(async () =>
    held.at(-1)?.resolve({
      entries: [entry("core", "Kept."), entry("mem/second", "Two.")],
      partial: false,
    }),
  );
  expect(
    await screen.findByRole("button", { name: /second/ }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /first/ })).toBeNull();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
