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
import { AvatarCustomColor } from "./AvatarCustomColor";
afterEach(() => {
  cleanup();
  setLanguage("en");
});
it("updates accessible color instructions in place and preserves keyboard color calculations", () => {
  setLanguage("en");
  const changed = vi.fn();
  const close = vi.fn();
  render(
    <AvatarCustomColor
      color="#FF0000"
      disabled={false}
      onChange={changed}
      onClose={close}
    />,
  );
  const spectrum = screen.getByRole("slider", { name: "Color spectrum" });
  spectrum.focus();
  fireEvent.keyDown(spectrum, { key: "ArrowLeft" });
  expect(changed).toHaveBeenLastCalledWith("#FF0303");
  act(() => setLanguage("ko"));
  expect(screen.getByRole("slider", { name: "색상 스펙트럼" })).toBe(spectrum);
  expect(spectrum).toHaveFocus();
  expect(spectrum).toHaveAttribute(
    "aria-valuetext",
    "채도 99%, 밝기 100%. 좌우 화살표로 채도를, 위아래 화살표로 밝기를 조절하세요.",
  );
  fireEvent.keyDown(spectrum, { key: "ArrowLeft" });
  expect(changed).toHaveBeenLastCalledWith("#FF0505");
  act(() => setLanguage("en"));
  expect(screen.getByRole("slider", { name: "Color spectrum" })).toBe(spectrum);
  fireEvent.click(screen.getByRole("button", { name: "Use color" }));
  expect(close).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ type: "click" }),
  );
});
