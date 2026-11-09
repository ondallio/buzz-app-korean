// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n";
import { createRelaySession } from "../../features/relay/session";
import { ChannelHeaderIdentity, memberAccess } from "./ChannelHeaderIdentity";

afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
});

it.each([
  [
    { channelType: "solo", viewerRole: "owner" },
    "Share access to User {name}",
    "User {name}의 접근 권한 공유",
  ],
  [
    { channelType: "solo", viewerRole: "guest" },
    "Chat access for User {name}",
    "User {name}의 채팅 접근 권한",
  ],
  [
    { channelType: "stream", viewerRole: "guest" },
    "Channel access for User {name}",
    "User {name}의 채널 접근 권한",
  ],
  [
    { channelType: "stream", viewerRole: "owner" },
    "Manage members of User {name}",
    "User {name}의 멤버 관리",
  ],
] as const)(
  "projects frozen access metadata without changing its object identity (%j)",
  (channel, english, korean) => {
    const host = createRelaySession(null);
    const access = memberAccess(channel);
    const open = vi.fn();
    const view = render(
      <ChannelHeaderIdentity
        session={host.session}
        channelId="raw-id"
        name="User {name}"
        access={access}
        onClick={open}
      />,
    );
    try {
      const button = screen.getByRole("button", { name: english });
      button.focus();
      act(() => setLanguage("ko"));
      expect(screen.getByRole("button", { name: korean })).toBe(button);
      expect(button).toHaveFocus();
      expect(memberAccess(channel)).toBe(access);
      act(() => setLanguage("en"));
      expect(screen.getByRole("button", { name: english })).toBe(button);
      fireEvent.click(button);
      expect(open).toHaveBeenCalledOnce();
    } finally {
      view.unmount();
      host.dispose();
    }
  },
);
