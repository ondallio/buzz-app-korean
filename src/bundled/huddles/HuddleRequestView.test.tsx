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
import { stubAvatarBrowserApis } from "../../features/agents/avatar-testing";
import type { HuddleView } from "../../features/huddle/window";
import { HuddleWindowView } from "./HuddleWindowView";

stubAvatarBrowserApis();
afterEach(() => {
  cleanup();
  setLanguage("en");
});
it.each(["Someone", "Raw {caller} 한글", null])(
  "keeps raw caller %s, request controls and focus through language and call phases",
  (name) => {
    const view: HuddleView = {
      id: "raw-call-id",
      title: "Raw Huddle title",
      phase: "incoming",
      muted: false,
      level: 0,
      dark: false,
      participants:
        name === null
          ? []
          : [
              {
                key: "raw-peer-key",
                name,
                picture: null,
                own: false,
                level: 0,
              },
            ],
      error: "Connecting your microphone…",
    };
    const action = vi.fn();
    const mounted = render(<HuddleWindowView view={view} act={action} />);
    const region = screen.getByRole("main", {
      name: "Incoming Huddle request",
    });
    const join = screen.getByRole("button", { name: "Join" });
    const decline = screen.getByRole("button", {
      name: "Decline",
    });
    const caller = screen.getByText(name ?? "Someone", { exact: true });
    const sentence = caller.parentElement;
    expect(sentence).toHaveTextContent(`${name ?? "Someone"} is calling`);
    expect(sentence?.children).toHaveLength(2);
    expect(caller).toHaveAttribute("title", name ?? "Someone");
    join.focus();
    act(() => setLanguage("ko"));
    expect(screen.getByRole("main", { name: "허들 통화 요청" })).toBe(region);
    expect(screen.getByRole("button", { name: "참여" })).toBe(join);
    expect(screen.getByRole("button", { name: "거절" })).toBe(decline);
    expect(join).toHaveFocus();
    const koCaller = screen.getByText(name ?? "누군가", { exact: true });
    expect(koCaller).toBe(caller);
    expect(caller).toHaveAttribute("title", name ?? "누군가");
    expect(sentence).toHaveTextContent(`${name ?? "누군가"}의 통화 요청`);
    expect(sentence?.children).toHaveLength(2);
    expect(sentence?.lastElementChild?.tagName).toBe("SPAN");
    expect(screen.getByRole("alert")).toHaveTextContent(view.error ?? "");
    expect(action).not.toHaveBeenCalled();
    fireEvent.click(join);
    expect(action.mock.calls).toEqual([["join"]]);
    expect(decline).toHaveFocus();
    mounted.rerender(
      <HuddleWindowView view={{ ...view, phase: "connecting" }} act={action} />,
    );
    expect(screen.getByRole("button", { name: "취소" })).toBe(decline);
    expect(join).toBeDisabled();
    expect(decline).toHaveFocus();
    act(() => setLanguage("en"));
    expect(screen.getByRole("button", { name: "Cancel" })).toBe(decline);
    expect(caller).toHaveTextContent(name ?? "Someone");
    expect(sentence).toHaveTextContent(`${name ?? "Someone"} is calling`);
    expect(action.mock.calls).toEqual([["join"]]);
    fireEvent.click(decline);
    expect(action.mock.calls).toEqual([["join"], ["decline"]]);
    mounted.rerender(
      <HuddleWindowView
        view={{ ...view, phase: "connected", error: undefined }}
        act={action}
      />,
    );
    expect(screen.getByRole("button", { name: "Mute" })).toHaveFocus();
    expect(
      screen.queryByRole("main", { name: "Incoming Huddle request" }),
    ).not.toBeInTheDocument();
  },
);
