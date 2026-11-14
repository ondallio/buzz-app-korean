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
import { ToastProvider, useToastNotification } from "../design-system/ui/Toast";
import { TranslatedMessage } from "./Message";
import { localMessage } from "./deferred-message";
import { setLanguage, useLanguage, t } from "./index";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
});

it("keeps an existing actionable toast and its expiry while changing live content and dismiss names", async () => {
  vi.useFakeTimers();
  setLanguage("en");
  const action = vi.fn();
  function Trigger() {
    const notify = useToastNotification();
    return (
      <button
        type="button"
        onClick={() =>
          notify(
            <TranslatedMessage value={localMessage("language.unsaved")} />,
            "info",
            {
              label: (
                <TranslatedMessage value={localMessage("language.retry")} />
              ),
              onClick: action,
              timeout: 8000,
            },
          )
        }
      >
        show
      </button>
    );
  }
  function Host() {
    useLanguage();
    return (
      <ToastProvider
        labels={{ dismiss: t("toast.dismiss"), region: t("toast.region") }}
      >
        <Trigger />
      </ToastProvider>
    );
  }
  render(<Host />);
  fireEvent.click(screen.getByRole("button", { name: "show" }));
  await act(() => vi.advanceTimersByTimeAsync(0));
  const card = screen.getByRole("dialog", {
    name: "This language is active, but could not be saved on this device.",
  });
  const toast = card.closest("[data-sonner-toast]");
  const button = screen.getByRole("button", { name: "Retry saving language" });
  await act(() => vi.advanceTimersByTimeAsync(3000));
  act(() => setLanguage("ko"));
  expect(
    screen.getByRole("dialog", {
      name: "선택한 언어를 적용했지만 이 기기에 저장하지 못했습니다.",
    }),
  ).toBe(card);
  expect(screen.getByRole("button", { name: "언어 저장 다시 시도" })).toBe(
    button,
  );
  expect(screen.getByRole("button", { name: "알림 닫기" })).toBeInTheDocument();
  expect(toast).not.toHaveAttribute("data-removed", "true");
  await act(() => vi.advanceTimersByTimeAsync(4999));
  expect(toast).not.toHaveAttribute("data-removed", "true");
  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(toast).toHaveAttribute("data-removed", "true");
  expect(action).not.toHaveBeenCalled();
});
