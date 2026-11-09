// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { setLanguage, useLanguage } from "../../shared/i18n";
import { AgentCardPreview } from "./AgentCardPreview";

afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
});

it.each(["Agent card", "사용자 카드 이름"])(
  "preserves provided image data and geometry across languages (%s)",
  (alt) => {
    function Host() {
      useLanguage();
      return (
        <AgentCardPreview src="https://example.invalid/user.png" alt={alt} />
      );
    }
    const view = render(<Host />);
    const image = screen.getByRole("img", { name: alt });
    const before = view.container.innerHTML;
    act(() => setLanguage("ko"));
    expect(screen.getByRole("img", { name: alt })).toBe(image);
    expect(image).toHaveAttribute("src", "https://example.invalid/user.png");
    expect(image).toHaveAttribute("draggable", "false");
    expect(view.container.innerHTML).toBe(before);
    act(() => setLanguage("en"));
    expect(screen.getByRole("img", { name: alt })).toBe(image);
    expect(view.container.innerHTML).toBe(before);
  },
);
