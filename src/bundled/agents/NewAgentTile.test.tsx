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
import { NewAgentTile } from "./NewAgentTile";
afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
});
it.each(["tile", "button"] as const)(
  "retains the same focused %s action while translating its owned default label",
  (variant) => {
    setLanguage("en");
    const open = vi.fn();
    render(<NewAgentTile variant={variant} onClick={open} />);
    const tile = screen.getByRole("button", { name: "New agent" });
    tile.focus();
    act(() => setLanguage("ko"));
    expect(screen.getByRole("button", { name: "새 에이전트" })).toBe(tile);
    expect(tile).toHaveFocus();
    expect(open).not.toHaveBeenCalled();
    fireEvent.click(tile);
    expect(open).toHaveBeenCalledOnce();
    act(() => setLanguage("en"));
    expect(screen.getByRole("button", { name: "New agent" })).toBe(tile);
    expect(tile).toHaveFocus();
  },
);
it("preserves an explicit authored label equal to the default English phrase", () => {
  setLanguage("en");
  render(
    <NewAgentTile label="New agent" description="Raw {description} 한글" />,
  );
  const tile = screen.getByRole("button", {
    name: "Raw {description} 한글New agent",
  });
  act(() => setLanguage("ko"));
  expect(
    screen.getByRole("button", { name: "Raw {description} 한글New agent" }),
  ).toBe(tile);
});
