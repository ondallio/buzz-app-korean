// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { StrictMode } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n";
import type { Navigation } from "../../features/navigation/controller";
import { NavigationControls } from "./NavigationControls";

afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
});

it("updates the live history controls in both directions without replacing focus or their navigation actions", async () => {
  setLanguage("en");
  const state = { canGoBack: true, canGoForward: true };
  const back = vi.fn();
  const forward = vi.fn();
  const navigation = {
    subscribe: () => () => {},
    snapshot: () => state,
    back,
    forward,
  } as unknown as Navigation;
  const user = userEvent.setup();
  render(
    <StrictMode>
      <NavigationControls navigation={navigation} />
    </StrictMode>,
  );
  const button = screen.getByRole("button", { name: "Go back" });
  const region = screen.getByRole("navigation", { name: "Navigation history" });
  button.focus();
  act(() => setLanguage("ko"));
  expect(screen.getByRole("navigation", { name: "탐색 기록" })).toBe(region);
  expect(screen.getByRole("button", { name: "뒤로" })).toBe(button);
  expect(button).toHaveFocus();
  await user.hover(button);
  expect(await screen.findByRole("tooltip")).toHaveTextContent("뒤로");
  await user.keyboard("{Enter}");
  await user.click(screen.getByRole("button", { name: "앞으로" }));
  expect(back).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ type: "click" }),
  );
  expect(forward).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ type: "click" }),
  );
  act(() => setLanguage("en"));
  expect(screen.getByRole("navigation", { name: "Navigation history" })).toBe(
    region,
  );
  expect(screen.getByRole("button", { name: "Go back" })).toBe(button);
});
