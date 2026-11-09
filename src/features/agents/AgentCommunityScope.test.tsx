// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n";
import { useState } from "react";
import type { CommunityReader } from "../communities/service";
import {
  AgentCommunityScope,
  useAgentScopeCommunity,
  type AgentScopeReader,
} from "./AgentCommunityScope";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  setLanguage("en");
});

it.each(["Memory", "Avatar"] as const)(
  "%s scope follows this agent's remaining memberships, including offline ones",
  async (scope) => {
    const user = userEvent.setup();
    const agent = {
      pubkey: "a".repeat(64),
      relay: "wss://current.example",
      place: "here" as const,
    };
    const current = { key: agent.pubkey, origin: agent.relay, connected: true };
    const other = {
      key: "other",
      origin: "https://other.example",
      connected: false,
    };
    let memberships: ReturnType<AgentScopeReader["memberships"]> = [current];
    const listeners = new Set<() => void>();
    const agents: AgentScopeReader = {
      memberships: (pubkey) => {
        expect(pubkey).toBe(agent.pubkey);
        return [...memberships];
      },
      subscribe: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    };
    const update = (next: typeof memberships) =>
      act(() => {
        memberships = next;
        for (const listener of listeners) listener();
      });
    function View() {
      const community = useAgentScopeCommunity(agent, agents, undefined);
      return <AgentCommunityScope scope={scope} community={community} />;
    }
    const view = render(<View />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    update([current, { ...other, deleting: true }]);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    update([current, other]);
    const trigger = screen.getByRole("button", {
      name:
        scope === "Avatar"
          ? "Only in current.example"
          : `${scope} scope: current.example`,
    });
    await user.click(trigger);
    expect(
      await screen.findByRole("dialog", { name: `${scope} scope` }),
    ).toBeVisible();
    update([current]);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: `${scope} scope` }),
    ).not.toBeInTheDocument();
    view.unmount();
    expect(listeners.size).toBe(0);
  },
);

it.each([
  {
    scope: "Memory",
    title: "Memory scope",
    koreanTitle: "기억 범위",
    trigger: "Memory scope: Memory scope {community} 한글",
    koreanTrigger: "기억 범위: Memory scope {community} 한글",
    description:
      "Memories are specific to this community and aren’t shared with other communities.",
    koreanDescription:
      "기억은 이 커뮤니티에만 적용되며 다른 커뮤니티와 공유되지 않습니다.",
  },
  {
    scope: "Avatar",
    title: "Avatar scope",
    koreanTitle: "아바타 범위",
    trigger: "Only in Memory scope {community} 한글",
    koreanTrigger: "Memory scope {community} 한글에서만",
    description:
      "This avatar is specific to this community and isn’t shared with other communities.",
    koreanDescription:
      "이 아바타는 이 커뮤니티에만 적용되며 다른 커뮤니티와 공유되지 않습니다.",
  },
  {
    scope: "Agents",
    title: "Agents scope",
    koreanTitle: "에이전트 범위",
    trigger: "Agents scope: Memory scope {community} 한글",
    koreanTrigger: "에이전트 범위: Memory scope {community} 한글",
    description:
      "These are your agents imported into this community on this device.",
    koreanDescription: "이 기기에서 이 커뮤니티에 가져온 내 에이전트입니다.",
  },
] as const)(
  "keeps the same open $scope popup and raw community through EN/KO/EN",
  async (item) => {
    setLanguage("en");
    const user = userEvent.setup();
    const community = Object.freeze({
      id: "https://raw.example/community",
      name: "Memory scope {community} 한글",
      src: undefined,
    });
    const original = { ...community };
    const opened = vi.fn();
    const network = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Raw external failure"));
    const diagnostic = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <AgentCommunityScope
        scope={item.scope}
        community={community}
        onOpenChange={opened}
      />,
    );
    const trigger = screen.getByRole("button", { name: item.trigger });
    await user.click(trigger);
    const popup = await screen.findByRole("dialog", { name: item.title });
    const name = within(popup).getByText(community.name);
    const description = within(popup).getByText(item.description);
    trigger.focus();
    const changes = opened.mock.calls.length;
    act(() => setLanguage("ko"));
    expect(screen.getByRole("button", { name: item.koreanTrigger })).toBe(
      trigger,
    );
    expect(screen.getByRole("dialog", { name: item.koreanTitle })).toBe(popup);
    expect(within(popup).getByText(community.name)).toBe(name);
    expect(within(popup).getByText(item.koreanDescription)).toBe(description);
    expect(trigger).toHaveFocus();
    if (item.scope === "Avatar")
      expect(trigger).toHaveTextContent("Memory scope {community} 한글에서만");
    expect(opened.mock.calls).toHaveLength(changes);
    act(() => setLanguage("en"));
    expect(screen.getByRole("button", { name: item.trigger })).toBe(trigger);
    expect(screen.getByRole("dialog", { name: item.title })).toBe(popup);
    expect(within(popup).getByText(item.description)).toBe(description);
    expect(trigger).toHaveFocus();
    expect(community).toEqual(original);
    expect(opened.mock.calls).toHaveLength(changes);
    expect(network).not.toHaveBeenCalled();
    expect(diagnostic).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: item.title })).toBeNull();
    expect(trigger).toHaveFocus();
  },
);

it("keeps controlled Avatar state, reader diagnostics and host drafts unchanged on locale changes", async () => {
  const rawError =
    "Memories are specific to this community and aren’t shared with other communities.";
  const rawName = "Avatar scope {community} 한글";
  const id = "https://raw.example";
  const state: ReturnType<CommunityReader["snapshot"]> = {
    status: "unavailable",
    relayAvailable: false,
    profile: { name: "Raw profile", picture: "" },
    memberships: [{ id, name: rawName }],
    selected: id,
    sync: { known: [], outbox: [] },
    error: rawError,
  };
  const communityListeners = new Set<() => void>();
  const communities: CommunityReader = {
    snapshot: vi.fn(() => state),
    subscribe: vi.fn((listener) => {
      communityListeners.add(listener);
      return () => {
        communityListeners.delete(listener);
      };
    }),
  };
  const agent = { pubkey: "a".repeat(64), relay: id, place: "here" as const };
  const agentListeners = new Set<() => void>();
  const agents: AgentScopeReader = {
    memberships: vi.fn(() => [
      { key: agent.pubkey, origin: id, connected: true },
      { key: "other", origin: "https://other.example", connected: false },
    ]),
    subscribe: vi.fn((listener) => {
      agentListeners.add(listener);
      return () => {
        agentListeners.delete(listener);
      };
    }),
  };
  const changed = vi.fn();
  function Host() {
    const [open, setOpen] = useState(false);
    const community = useAgentScopeCommunity(agent, agents, communities);
    return (
      <>
        <input
          aria-label="Raw avatar draft"
          defaultValue="Memory scope {community} 한글"
        />
        <AgentCommunityScope
          community={community}
          scope="Avatar"
          open={open}
          onOpenChange={(next) => {
            changed(next);
            setOpen(next);
          }}
        />
      </>
    );
  }
  const view = render(<Host />);
  const input = screen.getByRole("textbox", { name: "Raw avatar draft" });
  if (!(input instanceof HTMLInputElement))
    throw new Error("Missing avatar draft input");
  input.setSelectionRange(2, 7);
  const user = userEvent.setup();
  const trigger = screen.getByRole("button", { name: `Only in ${rawName}` });
  await user.click(trigger);
  const popup = await screen.findByRole("dialog", { name: "Avatar scope" });
  trigger.focus();
  const membershipReads = vi.mocked(agents.memberships).mock.calls.length;
  const communityReads = vi.mocked(communities.snapshot).mock.calls.length;
  act(() => setLanguage("ko"));
  expect(screen.getByRole("dialog", { name: "아바타 범위" })).toBe(popup);
  expect(screen.getByRole("button", { name: `${rawName}에서만` })).toBe(
    trigger,
  );
  expect(within(popup).getByText(rawName)).toBeVisible();
  expect(trigger).toHaveFocus();
  expect(input).toHaveValue("Memory scope {community} 한글");
  expect([input.selectionStart, input.selectionEnd]).toEqual([2, 7]);
  expect(state.error).toBe(rawError);
  expect(state.memberships).toEqual([{ id, name: rawName }]);
  expect(changed).toHaveBeenCalledExactlyOnceWith(true);
  expect(vi.mocked(agents.memberships).mock.calls).toHaveLength(
    membershipReads,
  );
  expect(vi.mocked(communities.snapshot).mock.calls).toHaveLength(
    communityReads,
  );
  expect(agentListeners.size).toBe(1);
  expect(communityListeners.size).toBe(1);
  act(() => setLanguage("en"));
  expect(screen.getByRole("dialog", { name: "Avatar scope" })).toBe(popup);
  expect(screen.getByRole("textbox", { name: "Raw avatar draft" })).toBe(input);
  expect(trigger).toHaveFocus();
  expect(changed).toHaveBeenCalledExactlyOnceWith(true);
  await user.keyboard("{Escape}");
  expect(changed.mock.calls.map(([next]) => next)).toEqual([true, false]);
  view.unmount();
  expect(agentListeners.size).toBe(0);
  expect(communityListeners.size).toBe(0);
});
