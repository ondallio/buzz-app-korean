import "@testing-library/jest-dom/vitest";
import { act, fireEvent } from "@testing-library/react";
import { setLanguage } from "../../shared/i18n/language";
// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { ComposerCompletions } from "./ComposerCompletions";
import type { CompletionEditor } from "./useCompletionEditor";
import type { ComposerCompletion } from "./contracts";
import type { Contribution } from "../../plugins/contributions";
import type { RelaySession } from "../relay/session";
import type { ComposerInputElement } from "../messages/composer-dom";
import type { ComposerSnapshot } from "../messages/mention-draft";
import { channelQuery } from "../../bundled/channels/channel-query";
import * as markdown from "../relay/message-content";

afterEach(() => {
  cleanup();
  setLanguage("en");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});
const providers: Contribution<ComposerCompletion>[] = [
  {
    id: "channel-typeahead",
    key: "buzz.channels/channel-typeahead",
    pluginId: "buzz.channels",
    revision: "1",
    title: "Channel",
    match: ({ text, start }) => channelQuery(text, start),
    component: () => <span>Channel provider mounted</span>,
  },
];
function mount(text: string, caret = text.length, document?: ComposerSnapshot) {
  const editor = {
    observation: { revision: 1, text, start: caret, end: caret },
    valid: () => true,
    observe: () => {},
    invalidate: () => {},
    keys: { current: undefined },
    composing: { current: false },
  } as CompletionEditor;
  return render(
    <ComposerCompletions
      registry={{ snapshot: () => providers, subscribe: () => () => {} }}
      editor={editor}
      input={{ current: null as ComposerInputElement | null }}
      replace={() => true}
      resolved={{ text, recipients: [], ...(document ? { document } : {}) }}
      session={{} as RelaySession}
      scope="test"
      channelId="c"
    />,
  );
}
it.each(["#", "prose #we", "## Heading #we", "> #we", "- #we"])(
  "allows prose: %s",
  (text) => {
    mount(text);
    expect(screen.queryByText("Channel provider mounted")).not.toBeNull();
  },
);
it.each([
  ["`code #we`", 9],
  ["```\n#we\n```", 7],
  ["    #we", 7],
  ["[label #we](https://example.test)", 10],
  ["![alt #we](https://example.test)", 9],
  ["[label #we][ref]\n\n[ref]: https://example.test", 10],
  ["<span>\n#we\n</span>", 10],
  ["[ref]: https://example.test (#we)", 30],
] as const)("does not mount inside raw code/links/HTML: %s", (text, caret) => {
  mount(text, caret);
  expect(screen.queryByText("Channel provider mounted")).toBeNull();
});
it.each(["code", "link", "literal"])(
  "does not mount in rich %s marks",
  (mark) => {
    mount("#we", 3, {
      version: 1,
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "#we",
                marks: [
                  {
                    type: mark,
                    ...(mark === "link"
                      ? { attrs: { href: "https://example.test" } }
                      : {}),
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    expect(screen.queryByText("Channel provider mounted")).toBeNull();
  },
);
it("does no additional Markdown parsing on ordinary typing", () => {
  const scan = vi.spyOn(markdown, "scanMarkdown");
  mount("An ordinary message without a channel trigger");
  expect(scan).not.toHaveBeenCalled();
});

function mountPeople(pluginId: string) {
  // The open popup measures itself and keeps its selection in view.
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: () => {},
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  const items = [
    {
      id: "a".repeat(64),
      label: "Honey",
      detail: "Managed by Wes",
      agent: true,
      edit: { mention: { pubkey: "a".repeat(64), name: "Honey" } },
    },
    {
      id: "b".repeat(64),
      label: "Hannah",
      edit: { mention: { pubkey: "b".repeat(64), name: "Hannah" } },
    },
  ];
  const people: Contribution<ComposerCompletion> = {
    id: "people",
    key: `${pluginId}/people`,
    pluginId,
    revision: "1",
    title: "People",
    match: ({ text, start }) =>
      text.startsWith("@") ? { start: 0, end: start, query: "h" } : null,
    component: function People({ publish }) {
      // One publication for this query lifetime, as providers do.
      const published = useRef(publish);
      useEffect(() => {
        const withdraw = published.current({ items });
        return withdraw || undefined;
      }, []);
      return null;
    },
  };
  const registered = [people];
  // The host reads only the input's attributes and position.
  const input = document.createElement(
    "div",
  ) as unknown as ComposerInputElement;
  document.body.append(input);
  const editor = {
    observation: { revision: 1, text: "@h", start: 2, end: 2 },
    valid: () => true,
    observe: () => {},
    invalidate: () => {},
    keys: { current: undefined },
    composing: { current: false },
  } as CompletionEditor;
  return render(
    <ComposerCompletions
      registry={{ snapshot: () => registered, subscribe: () => () => {} }}
      editor={editor}
      input={{ current: input }}
      replace={() => true}
      resolved={{ text: "@h", recipients: [] }}
      session={{} as RelaySession}
      scope="test"
      channelId="c"
    />,
  );
}
it("marks and announces agents and shows their manager in mention completion", async () => {
  mountPeople("buzz.mentions");
  expect(
    await screen.findByRole("option", {
      name: /^Honey\s*Agent\s*Managed by Wes$/,
    }),
  ).not.toBeNull();
  expect(screen.getByRole("option", { name: /^Hannah$/ })).not.toBeNull();
});
it("ignores the agent flag from providers outside the bundled people providers", async () => {
  mountPeople("acme.people");
  expect(
    await screen.findByRole("option", { name: /^Honey\s*Managed by Wes$/ }),
  ).not.toBeNull();
});

it.each(["bundled", "external", "changed-title"] as const)(
  "projects only owned completion copy without republishing or changing raw edits: %s",
  async (kind) => {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: () => {},
    });
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    const withdrawn = vi.fn();
    const published = vi.fn();
    const retry = vi.fn();
    const rawEdit = { text: ":raw_user-code:" };
    const provider: Contribution<ComposerCompletion> = {
      id: "typeahead",
      key:
        kind === "external" ? "acme.emoji/typeahead" : "buzz.emoji/typeahead",
      pluginId: kind === "external" ? "acme.emoji" : "buzz.emoji",
      revision: "1",
      title: kind === "changed-title" ? "Emoji user" : "Emoji",
      match: () => ({ start: 0, end: 4, query: "raw" }),
      component: function Suggestions({ publish }) {
        useEffect(() => {
          published();
          const withdraw = publish({
            items: [
              {
                id: "raw-item",
                label: ":raw_user-code:",
                detail: "Unicode emoji",
                edit: rawEdit,
              },
            ],
            status: "Community emoji unavailable; Unicode results shown.",
            retry,
          });
          return () => {
            withdrawn();
            if (withdraw) withdraw();
          };
        }, [publish]);
        return null;
      },
    };
    const registered = [provider];
    const input = document.body.appendChild(
      document.createElement("div"),
    ) as unknown as ComposerInputElement;
    input.tabIndex = 0;
    const replace = vi.fn(() => true);
    const editor = {
      observation: { revision: 1, text: ":raw", start: 4, end: 4 },
      valid: () => true,
      observe: () => {},
      invalidate: vi.fn(),
      keys: { current: undefined },
      composing: { current: false },
    } as CompletionEditor;
    const rendered = render(
      <ComposerCompletions
        registry={{ snapshot: () => registered, subscribe: () => () => {} }}
        editor={editor}
        input={{ current: input }}
        replace={replace}
        resolved={{ text: ":raw", recipients: [] }}
        session={{} as RelaySession}
        scope="fixture"
        channelId="c"
      />,
    );
    const option = await screen.findByRole("option", {
      name: /:raw_user-code:.*Unicode emoji/,
    });
    const list = screen.getByRole("listbox");
    input.focus();
    act(() => setLanguage("ko"));
    const title = kind === "bundled" ? "이모지" : provider.title;
    expect(screen.getByRole("listbox", { name: `${title} 추천` })).toBe(list);
    expect(
      screen.getByRole("option", {
        name:
          kind === "bundled"
            ? /:raw_user-code:.*유니코드 이모지/
            : /:raw_user-code:.*Unicode emoji/,
      }),
    ).toBe(option);
    expect(screen.getByRole("status")).toHaveTextContent(
      kind === "bundled"
        ? "커뮤니티 이모지를 사용할 수 없어 유니코드 결과를 표시합니다."
        : "Community emoji unavailable; Unicode results shown.",
    );
    expect(input).toHaveFocus();
    expect(option).toHaveAttribute("aria-selected", "true");
    expect(published).toHaveBeenCalledTimes(1);
    expect(withdrawn).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("option", { name: "추천 다시 불러오기" }));
    expect(retry).toHaveBeenCalledTimes(1);
    act(() => setLanguage("en"));
    expect(
      screen.getByRole("listbox", { name: `${provider.title} suggestions` }),
    ).toBe(list);
    expect(
      screen.getByRole("option", { name: /:raw_user-code:.*Unicode emoji/ }),
    ).toBe(option);
    fireEvent.click(option);
    expect(replace).toHaveBeenCalledExactlyOnceWith(
      rawEdit,
      { start: 0, end: 4, query: "raw" },
      editor.observation,
      "click",
    );
    expect(published).toHaveBeenCalledTimes(1);
    rendered.unmount();
    expect(withdrawn).toHaveBeenCalledTimes(1);
  },
);

it("announces a complete localized agent name once without replacing the selected option", async () => {
  mountPeople("buzz.mentions");
  const option = await screen.findByRole("option", {
    name: /^Honey\s*Agent\s*Managed by Wes$/,
  });
  act(() => setLanguage("ko"));
  expect(
    screen.getByRole("option", { name: /^Honey 에이전트\s*Managed by Wes$/ }),
  ).toBe(option);
  expect(screen.getByRole("option", { name: "Hannah" })).toBeVisible();
  act(() => setLanguage("en"));
  expect(
    screen.getByRole("option", { name: /^Honey Agent\s*Managed by Wes$/ }),
  ).toBe(option);
});
