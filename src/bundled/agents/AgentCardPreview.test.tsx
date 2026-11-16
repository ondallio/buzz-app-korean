// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { setLanguage, useLanguage } from "../../shared/i18n";
import { AgentCardPreview } from "./AgentCardPreview";

afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
  document.documentElement.removeAttribute("data-keyboard-navigation");
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

it("waits for each image to load before revealing it", () => {
  const { container, rerender } = render(
    <AgentCardPreview src="blob:first" alt="Ada’s agent card" />,
  );
  expect(container.querySelector("[data-ready]")).toHaveAttribute(
    "data-ready",
    "false",
  );
  fireEvent.load(screen.getByRole("img"));
  expect(container.querySelector("[data-ready]")).toHaveAttribute(
    "data-ready",
    "true",
  );
  rerender(<AgentCardPreview src="blob:second" alt="Ada’s agent card" />);
  expect(container.querySelector("[data-ready]")).toHaveAttribute(
    "data-ready",
    "false",
  );
  fireEvent.load(screen.getByRole("img"));
  expect(container.querySelector("[data-ready]")).toHaveAttribute(
    "data-ready",
    "true",
  );
});

it("leaves the image alternative visible if the preview cannot load", () => {
  const { container } = render(
    <AgentCardPreview src="blob:missing" alt="Ada’s agent card" />,
  );
  fireEvent.error(screen.getByRole("img", { name: "Ada’s agent card" }));
  expect(container.querySelector("[data-ready]")).toHaveAttribute(
    "data-ready",
    "true",
  );
});

it("shows keyboard-opened cards immediately without replaying on pointer use", () => {
  document.documentElement.setAttribute("data-keyboard-navigation", "");
  const { container, rerender } = render(
    <AgentCardPreview src="blob:first" alt="Ada’s agent card" />,
  );
  fireEvent.load(screen.getByRole("img"));
  document.documentElement.removeAttribute("data-keyboard-navigation");
  rerender(<AgentCardPreview src="blob:first" alt="Ada’s agent card" />);
  expect(container.querySelector("[data-ready]")).toHaveAttribute(
    "data-animate",
    "false",
  );
});
