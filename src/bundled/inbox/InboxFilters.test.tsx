// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n/language";
import {
  InboxFilters,
  type ActivityFilter,
  type SenderFilter,
} from "./InboxFilters";

afterEach(() => {
  cleanup();
  setLanguage("en");
});

it("keeps the same open sender menu, focus and canonical filter values across EN to KO to EN", async () => {
  const changed = vi.fn();
  function Host() {
    const [sender, setSender] = useState<SenderFilter>("humans");
    const [view, setView] = useState<ActivityFilter>("all");
    const [unread, setUnread] = useState(false);
    return (
      <InboxFilters
        view={view}
        sender={sender}
        unreadOnly={unread}
        triggerRef={useRef(null)}
        onSenderChange={(value) => {
          changed("sender", value);
          setSender(value);
        }}
        onViewChange={(value) => {
          changed("view", value);
          setView(value);
        }}
        onUnreadChange={(value) => {
          changed("unread", value);
          setUnread(value);
        }}
      />
    );
  }
  const user = userEvent.setup();
  render(<Host />);
  const from = screen.getByRole("button", { name: "From people" });
  await user.click(from);
  const menu = await screen.findByRole("menu", { name: "From" });
  const people = screen.getByRole("menuitemradio", { name: "People" });
  people.focus();
  act(() => setLanguage("ko"));
  expect(screen.getByRole("button", { name: "보낸 사람: 사람" })).toBe(from);
  expect(screen.getByRole("menu", { name: "보낸 사람" })).toBe(menu);
  expect(screen.getByRole("menuitemradio", { name: "사람" })).toBe(people);
  expect(people).toHaveFocus();
  expect(people).toHaveAttribute("aria-checked", "true");
  expect(changed).not.toHaveBeenCalled();
  await user.click(screen.getByRole("menuitemradio", { name: "에이전트" }));
  expect(changed).toHaveBeenLastCalledWith("sender", "agents");
  act(() => setLanguage("en"));
  expect(screen.getByRole("button", { name: "From agents" })).toBe(from);
  fireEvent.click(screen.getByRole("tab", { name: "Mentions" }));
  expect(changed).toHaveBeenLastCalledWith("view", "mentions");
  fireEvent.click(screen.getByRole("switch", { name: "Unread" }));
  expect(changed).toHaveBeenLastCalledWith("unread", true);
});
