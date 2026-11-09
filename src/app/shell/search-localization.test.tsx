// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useRef, useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n";
import { createRelaySession } from "../../features/relay/session";
import { keypair, scriptedTransport } from "../../features/relay/testing";
import { SearchResults } from "./SearchResults";
import { PageSearch, type SearchServices } from "./PageSearch";
import { BestieNavigationContext } from "./bestie-context";
import { ChatCircleIcon } from "../../shared/design-system/icons";
import { SearchChoices } from "./SearchChoices";
import { useSearchSettings } from "./SearchSettings";
import type { AppServices } from "../services";

beforeEach(() => {
  setLanguage("en");
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
  Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});
const page = Object.freeze({
  key: "buzz.inbox/inbox",
  pluginId: "buzz.inbox",
  id: "inbox",
  title: "Activity",
  revision: "bundled",
  component: () => null,
});
it.each(["Activity", "활동"])(
  "finds the same app destination from %s in both languages without replacing the search or selection",
  async (query) => {
    const user = userEvent.setup();
    const select = vi.fn();
    render(<PageSearch pages={[page]} onSelect={select} />);
    await user.click(screen.getByRole("button", { name: "Search Buzz" }));
    const dialog = screen.getByRole("dialog", { name: "Search Buzz" });
    const input = within(dialog).getByRole("combobox", { name: "Search Buzz" });
    await user.type(input, query);
    const clear = within(dialog).getByRole("button", {
      name: "Clear search buzz",
    });
    expect(screen.getByRole("option", { name: "Activity" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    act(() => setLanguage("ko"));
    expect(screen.getByRole("dialog", { name: "Buzz 검색" })).toBe(dialog);
    expect(
      within(dialog).getByRole("button", { name: "buzz 검색 지우기" }),
    ).toBe(clear);
    expect(screen.getByRole("combobox", { name: "Buzz 검색" })).toBe(input);
    expect(input).toHaveValue(query);
    expect(input).toHaveFocus();
    expect(screen.getByRole("option", { name: "활동" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    act(() => setLanguage("en"));
    expect(screen.getByRole("option", { name: "Activity" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.keyboard("{Enter}");
    expect(select).toHaveBeenCalledExactlyOnceWith(page.key);
    expect(page.title).toBe("Activity");
  },
);

it("updates only the default search label and preserves caller labels, raw chips and chip objects", () => {
  const remove = vi.fn();
  const chip = {
    operand: "from:key",
    text: "from:@Search",
    edit: "from:@Search",
    label: "Remove supplied",
  };
  render(
    <SearchChoices
      query="사용자 원문"
      onQueryChange={vi.fn()}
      input={createRef()}
      chips={[chip]}
      onRemoveChip={remove}
      groups={[]}
    />,
  );
  const input = screen.getByRole("combobox", { name: "Search Buzz" });
  act(() => setLanguage("ko"));
  expect(screen.getByRole("combobox", { name: "Buzz 검색" })).toBe(input);
  expect(input).toHaveValue("사용자 원문");
  fireEvent.click(screen.getByRole("button", { name: "Remove supplied" }));
  expect(remove).toHaveBeenCalledExactlyOnceWith(chip);
});

it.each(["sound", "소리"])(
  "keeps the real inline settings switch and raw preference payload for %s",
  (query) => {
    const state = {
      preferences: { enabled: true, sound: true, notifyWhileViewing: false },
      developmentPaused: false,
    };
    const update = vi.fn();
    const notifications = {
      snapshot: () => state,
      subscribe: () => () => {},
      updatePreferences: update,
    } as unknown as AppServices["notifications"];
    function Palette() {
      const input = useRef<HTMLElement>(null);
      const groups = useSearchSettings({
        query,
        notifications,
        navigation: { open: vi.fn() } as unknown as AppServices["navigation"],
        close: vi.fn(),
        openSection: vi.fn(),
      });
      return (
        <SearchChoices
          query={query}
          onQueryChange={vi.fn()}
          input={input}
          groups={[]}
          inlineSettings={groups}
        />
      );
    }
    render(<Palette />);
    const control = screen.getByRole("switch", { name: "Sound" });
    control.focus();
    act(() => setLanguage("ko"));
    expect(screen.getByRole("switch", { name: "소리" })).toBe(control);
    expect(control).toHaveFocus();
    expect(control).toBeChecked();
    fireEvent.click(control);
    expect(update).toHaveBeenCalledExactlyOnceWith({ sound: false });
    act(() => setLanguage("en"));
    expect(screen.getByRole("switch", { name: "Sound" })).toBe(control);
  },
);

it("localizes date presets and retained chip labels while preserving the exact query DSL and chip DOM", () => {
  const viewer = keypair();
  const relay = keypair();
  const owner = createRelaySession(
    scriptedTransport(viewer.pubkey, relay.pubkey).transport,
  );
  const changes: string[] = [];
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 7, 12));
  function Search() {
    const [query, setQuery] = useState("deploy during:");
    const input = useRef<HTMLElement>(null);
    return (
      <SearchResults
        session={owner.session}
        query={query}
        input={input}
        onQueryChange={(next) => {
          changes.push(next);
          setQuery(next);
        }}
        pages={[]}
        openConversation={vi.fn()}
      />
    );
  }
  try {
    render(<Search />);
    const week = screen.getByRole("option", { name: /This week/ });
    act(() => setLanguage("ko"));
    expect(screen.getByRole("option", { name: /이번 주/ })).toBe(week);
    fireEvent.click(week);
    expect(changes).toEqual(["after:2026-10-05 deploy "]);
    const chip = screen.getByRole("button", {
      name: "날짜 after:2026-10-05 해제",
    });
    const input = screen.getByRole("combobox", { name: "Buzz 검색" });
    input.focus();
    act(() => setLanguage("en"));
    expect(
      screen.getByRole("button", { name: "Remove date after:2026-10-05" }),
    ).toBe(chip);
    expect(screen.getByRole("combobox", { name: "Search Buzz" })).toBe(input);
    expect(input).toHaveValue("deploy ");
    expect(input).toHaveFocus();
    expect(changes).toEqual(["after:2026-10-05 deploy "]);
  } finally {
    cleanup();
    owner.dispose();
  }
});

it("keeps the English Other category searchable after switching and preserves the external plugin name and ID", () => {
  const change = vi.fn();
  const state = {
    configuration: {
      status: "ready",
      catalog: {
        plugins: [
          {
            manifest: {
              id: "example.user",
              name: "Activity",
              description: "user description",
            },
            source: "external",
            enabled: false,
            revision: "fixture",
          },
        ],
      },
    },
    activation: {},
    busy: false,
  };
  const plugins = {
    snapshot: () => state,
    subscribe: () => () => {},
    change,
  } as unknown as AppServices["plugins"];
  function Palette() {
    const input = useRef<HTMLElement>(null);
    const groups = useSearchSettings({
      query: "other",
      plugins,
      navigation: { open: vi.fn() } as unknown as AppServices["navigation"],
      close: vi.fn(),
      openSection: vi.fn(),
    });
    return (
      <SearchChoices
        query="other"
        onQueryChange={vi.fn()}
        input={input}
        groups={[]}
        inlineSettings={groups}
      />
    );
  }
  render(<Palette />);
  const control = screen.getByRole("switch", { name: "Enable Activity" });
  act(() => setLanguage("ko"));
  expect(screen.getByRole("switch", { name: "Activity 켜기" })).toBe(control);
  expect(screen.getByText("기타")).toBeVisible();
  fireEvent.click(control);
  expect(change).toHaveBeenCalledExactlyOnceWith("enable", "example.user");
});

it.each(["en", "ko"] as const)(
  "keeps canonical page-name ordering and default Enter despite a detail-only generic rank (%s)",
  async (language) => {
    setLanguage(language);
    localStorage.removeItem("buzz-search-usage.v1");
    const viewer = keypair();
    const relay = keypair();
    const wire = scriptedTransport(viewer.pubkey, relay.pubkey);
    const owner = createRelaySession({
      ...wire.transport,
      query: async () => [],
    });
    const terry = vi.fn();
    const tools = vi.fn();
    const pages = [
      {
        key: "buzz.bestie/bestie",
        label: "Terry",
        detail: "Bestie",
        rank: 0,
        icon: ChatCircleIcon,
        run: terry,
      },
      {
        key: "example.tools/main",
        label: "Bestie Tools",
        rank: 1,
        icon: ChatCircleIcon,
        run: tools,
      },
    ];
    try {
      const input = createRef<HTMLElement>();
      render(
        <SearchResults
          session={owner.session}
          query="bestie"
          onQueryChange={vi.fn()}
          input={input}
          pages={pages}
          openConversation={vi.fn()}
          usageScope={`https://rank.example:${viewer.pubkey}`}
        />,
      );
      const group = await screen.findByRole("group", {
        name: language === "ko" ? "페이지" : "Pages",
      });
      const rows = within(group).getAllByRole("option");
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveTextContent("Bestie Tools");
      expect(rows[1]).toHaveTextContent("TerryBestie");
      expect(rows[0]).toHaveAttribute("aria-selected", "true");
      input.current?.focus();
      await userEvent.setup().keyboard("{Enter}");
      expect(tools).toHaveBeenCalledExactlyOnceWith();
      expect(terry).not.toHaveBeenCalled();
    } finally {
      cleanup();
      owner.dispose();
    }
  },
);

it.each(["en", "ko"] as const)(
  "keeps promoted Bestie detail matching separate from the real PageSearch Enter order (%s)",
  async (language) => {
    setLanguage(language);
    const viewer = keypair();
    const relay = keypair();
    const wire = scriptedTransport(viewer.pubkey, relay.pubkey);
    const owner = createRelaySession({
      ...wire.transport,
      query: async () => [],
    });
    const client = {
      selected: "https://rank.example",
      viewer: viewer.pubkey,
      memberships: [],
    };
    const connection = {
      status: "ready",
      generation: 0,
      scope: `https://rank.example:${viewer.pubkey}`,
      session: owner.session,
    };
    const target = { kind: "page", page: "buzz.channels/channels" };
    const bindings = { overrides: {}, error: null };
    const services = {
      communities: {
        snapshot: () => client,
        subscribe: () => () => {},
        relay: { snapshot: () => connection, subscribe: () => () => {} },
      },
      navigation: {
        snapshot: () => ({ entry: { target } }),
        subscribe: () => () => {},
      },
      shortcuts: { registerHost: () => () => {} },
      shortcutBindings: { snapshot: () => bindings, subscribe: () => () => {} },
    } as unknown as SearchServices;
    const pages = [
      {
        key: "buzz.channels/channels",
        pluginId: "buzz.channels",
        id: "channels",
        title: "Channels",
        revision: "fixture",
        component: () => null,
      },
      {
        key: "buzz.bestie/bestie",
        pluginId: "buzz.bestie",
        id: "bestie",
        title: "Bestie",
        revision: "fixture",
        component: () => null,
      },
      {
        key: "example.tools/main",
        pluginId: "example.tools",
        id: "main",
        title: "Bestie Tools",
        revision: "fixture",
        component: () => null,
      },
    ];
    const select = vi.fn();
    try {
      render(
        <BestieNavigationContext
          value={{
            label: "Terry",
            detail: "Bestie",
            avatar: { src: undefined, shape: "squircle" },
          }}
        >
          <PageSearch pages={pages} services={services} onSelect={select} />
        </BestieNavigationContext>,
      );
      const user = userEvent.setup();
      await user.click(
        screen.getByRole("button", {
          name: language === "ko" ? "Buzz 검색" : "Search Buzz",
        }),
      );
      const input = screen.getByRole("combobox", {
        name: language === "ko" ? "Buzz 검색" : "Search Buzz",
      });
      await user.type(input, "bestie");
      const group = await screen.findByRole("group", {
        name: language === "ko" ? "페이지" : "Pages",
      });
      const rows = within(group).getAllByRole("option");
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveTextContent("Bestie Tools");
      expect(rows[1]).toHaveTextContent("Terry");
      expect(rows[0]).toHaveAttribute("aria-selected", "true");
      act(() => setLanguage(language === "ko" ? "en" : "ko"));
      expect(input).toHaveValue("bestie");
      expect(input).toHaveFocus();
      const switched = screen.getByRole("group", {
        name: language === "ko" ? "Pages" : "페이지",
      });
      expect(within(switched).getAllByRole("option")[0]).toBe(rows[0]);
      expect(rows[0]).toHaveAttribute("aria-selected", "true");
      await user.keyboard("{Enter}");
      expect(select).toHaveBeenCalledExactlyOnceWith("example.tools/main");
    } finally {
      cleanup();
      owner.dispose();
    }
  },
);
