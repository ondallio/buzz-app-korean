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
import { PluginReadme } from "./PluginReadme";
import { setLanguage } from "../shared/i18n/language";

afterEach(() => {
  cleanup();
  setLanguage("en");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function geometry(height: number) {
  let measure = () => {};
  const disconnect = vi.fn();
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(
    () => height,
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        measure = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  return {
    resize(next: number) {
      height = next;
      act(() => measure());
    },
    disconnect,
  };
}

it("leaves short READMEs fully visible without a disclosure", () => {
  geometry(200);
  render(<PluginReadme text="Short description." />);
  expect(screen.getByText("Short description.")).toBeVisible();
  expect(screen.queryByRole("button")).toBeNull();
});

it("expands and collapses long READMEs and remeasures on resize", () => {
  const size = geometry(900);
  const view = render(<PluginReadme text="Long description." />);
  const more = screen.getByRole("button", { name: "View more" });
  expect(more).toHaveAttribute("aria-expanded", "false");
  const clip = document.getElementById(
    more.getAttribute("aria-controls") ?? "",
  );
  expect(clip).toContainElement(screen.getByText("Long description."));
  expect(clip).toHaveStyle({ "max-height": "320px" });
  expect(clip).toHaveAttribute("data-collapsed", "true");
  fireEvent.click(more);
  expect(screen.getByRole("button", { name: "View less" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  expect(clip).not.toHaveAttribute("data-collapsed");
  fireEvent.click(more);
  expect(more).toHaveAttribute("aria-expanded", "false");
  expect(clip).toHaveAttribute("data-collapsed", "true");
  size.resize(200);
  expect(screen.queryByRole("button")).toBeNull();
  expect(clip).not.toHaveAttribute("data-collapsed");
  view.unmount();
  expect(size.disconnect).toHaveBeenCalledOnce();
});

it("reveals clipped links when they receive keyboard focus and resets on plugin change", () => {
  geometry(900);
  const view = render(
    <PluginReadme key="first" text="[Documentation](https://example.com)" />,
  );
  fireEvent.focus(screen.getByRole("link", { name: "Documentation" }));
  expect(screen.getByRole("button", { name: "View less" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  view.rerender(<PluginReadme key="second" text="Another plugin." />);
  expect(screen.getByRole("button", { name: "View more" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});

it("keeps authored Markdown, the disclosure and focused link intact through EN to KO to EN", () => {
  geometry(900);
  const markdown =
    "# Example\n\nView more 사용자 {raw}\n\n[View less](https://example.org/raw?q=View%20more#part)";
  render(<PluginReadme text={markdown} />);
  const control = screen.getByRole("button", { name: "View more" });
  const link = screen.getByRole("link", { name: "View less" });
  control.focus();
  act(() => setLanguage("ko"));
  expect(screen.getByRole("button", { name: "더 보기" })).toBe(control);
  expect(control).toHaveFocus();
  expect(control).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByText("View more 사용자 {raw}")).toBeVisible();
  fireEvent.click(control);
  expect(screen.getByRole("button", { name: "간략히 보기" })).toBe(control);
  expect(control).toHaveAttribute("aria-expanded", "true");
  act(() => link.focus());
  act(() => setLanguage("en"));
  expect(screen.getByRole("link", { name: "View less" })).toBe(link);
  expect(link).toHaveFocus();
  expect(link).toHaveAttribute(
    "href",
    "https://example.org/raw?q=View%20more#part",
  );
  expect(screen.getByRole("button", { name: "View less" })).toBe(control);
  expect(control).toHaveAttribute("aria-expanded", "true");
});
