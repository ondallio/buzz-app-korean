// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { createRef } from "react";
import { afterEach, expect, it, vi } from "vitest";
import type { RegisteredAgentType } from "../../features/agents/service";
import { setLanguage } from "../../shared/i18n";
import { ProviderDialog } from "./ProviderDialog";

afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
  vi.restoreAllMocks();
});
it("subscribes the standalone fallback without a language-aware parent or retrying provider work", () => {
  const failed = vi.fn(() => {
    throw new Error("Opaque provider exception");
  });
  const check = vi.fn(),
    closed = vi.fn();
  const type = {
    key: "fixture/echo",
    pluginId: "fixture",
    revision: "1",
    id: "echo",
    title: "Harness defaults",
    defaults: () => ({ config: {} }),
    provider: {
      snapshot: () => ({ readiness: "ready" as const }),
      subscribe: () => () => {},
      check,
      DialogBody: failed,
    },
  } satisfies RegisteredAgentType;
  // Stable external-store snapshot; language must not be an inventory change.
  const snapshot = type.provider.snapshot();
  type.provider.snapshot = () => snapshot;
  vi.spyOn(console, "error").mockImplementation(() => {});
  render(
    <ProviderDialog
      type={type}
      finalFocus={createRef<HTMLElement>()}
      onClose={closed}
    />,
  );
  const dialog = screen.getByRole("dialog", { name: "Harness defaults" });
  const alert = screen.getByRole("alert"),
    close = screen.getByRole("button", { name: "Close" });
  const attempts = failed.mock.calls.length;
  close.focus();
  for (const language of ["ko", "en"] as const) {
    act(() => setLanguage(language));
    expect(screen.getByRole("dialog", { name: "Harness defaults" })).toBe(
      dialog,
    );
    expect(screen.getByRole("alert")).toBe(alert);
    expect(alert).toHaveTextContent(
      language === "ko"
        ? "공급자 설정을 사용할 수 없습니다."
        : "Provider controls are unavailable.",
    );
    expect(close).toHaveFocus();
    expect(failed).toHaveBeenCalledTimes(attempts);
    expect(closed).not.toHaveBeenCalled();
    expect(check).not.toHaveBeenCalled();
  }
  fireEvent.click(close);
  expect(closed).toHaveBeenCalledExactlyOnceWith();
  expect(type.key).toBe("fixture/echo");
  expect(type.provider.snapshot()).toBe(snapshot);
});
