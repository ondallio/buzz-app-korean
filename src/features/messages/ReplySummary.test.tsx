// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { setLanguage } from "../../shared/i18n";
import { ReplySummary } from "./ReplySummary";
afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
});
it("updates numeric reply, unread and draft labels on the same mounted summary", () => {
  setLanguage("en");
  render(
    <ReplySummary
      count={2}
      unreadCount={1}
      participants={[]}
      resolveName={(_id, name) => name}
      media={(url) => url}
      draft
    />,
  );
  const replies = screen.getByText("2 replies");
  const draft = screen.getByText("Draft");
  act(() => setLanguage("ko"));
  expect(screen.getByText("답글 2개")).toBe(replies);
  expect(screen.getByText("(새 답글 1개)")).toBeVisible();
  expect(screen.getByText("초안")).toBe(draft);
  act(() => setLanguage("en"));
  expect(screen.getByText("2 replies")).toBe(replies);
});
