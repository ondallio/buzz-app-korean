// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { StrictMode } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n";
import type { RegisteredPage } from "../../features/pages/service";
import { ACTIVITY_PAGE, ActivityEmojiContext } from "./activity-context";
import { PageNavigation } from "./PageNavigation";

afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
});

it("localizes the app navigation label while preserving contributed titles, raw selection and focused tabs", async () => {
  setLanguage("en");
  const pages: RegisteredPage[] = [
    {
      key: "example.plugin/page",
      pluginId: "example.plugin",
      id: "page",
      title: "Settings",
      revision: "fixture",
      component: () => null,
    },
    {
      key: "example.other/page",
      pluginId: "example.other",
      id: "page",
      title: "Messages",
      revision: "fixture",
      component: () => null,
    },
  ];
  const onSelect = vi.fn();
  render(
    <StrictMode>
      <PageNavigation
        pages={pages}
        selected="example.plugin/page"
        onSelect={onSelect}
        placement="dock"
      />
    </StrictMode>,
  );
  const apps = screen.getByRole("tablist", { name: "Apps" });
  const tab = screen.getByRole("tab", { name: "Settings" });
  tab.focus();
  act(() => setLanguage("ko"));
  expect(screen.getByRole("tablist", { name: "앱" })).toBe(apps);
  expect(screen.getByRole("tab", { name: "Settings" })).toBe(tab);
  expect(tab).toHaveFocus();
  expect(tab).toHaveAttribute("aria-selected", "true");
  await userEvent.setup().click(screen.getByRole("tab", { name: "Messages" }));
  expect(onSelect.mock.calls).toEqual([
    ["example.other/page", { focus: "preserve" }],
  ]);
  act(() => setLanguage("en"));
  expect(screen.getByRole("tablist", { name: "Apps" })).toBe(apps);
  expect(screen.getByRole("tab", { name: "Settings" })).toBe(tab);
});

const activity: RegisteredPage = {
  key: ACTIVITY_PAGE,
  pluginId: "buzz.inbox",
  id: "inbox",
  title: "Activity",
  revision: "bundled",
  primary: true,
  component: () => null,
};

it("swaps the sidebar Activity row's bell for the latest reaction emoji", () => {
  const row = (emoji?: { content: string; active: boolean }) => (
    <ActivityEmojiContext value={emoji}>
      <PageNavigation
        pages={[activity]}
        selected="buzz.channels/channels"
        onSelect={() => {}}
      />
    </ActivityEmojiContext>
  );
  const view = render(row());
  const button = screen.getByRole("button", { name: "Activity" });
  expect(button.querySelector("svg")).toBeInTheDocument();
  expect(button.querySelector("[data-active]")).toBeNull();

  view.rerender(row({ content: "🎉", active: true }));
  // The emoji is decoration; the row keeps its name.
  expect(screen.getByRole("button", { name: "Activity" })).toBe(button);
  expect(button.querySelector("[data-active]")).toHaveTextContent("🎉");
});
