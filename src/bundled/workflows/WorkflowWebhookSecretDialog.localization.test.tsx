// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { StrictMode } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  localeStorageKey,
  setLanguage,
  type Language,
} from "../../shared/i18n/language";
import { english, korean } from "../../shared/i18n";
import { en, ko } from "../../shared/i18n/catalogs/workflow-webhook-secret";
import { validateCatalogs } from "../../shared/i18n/messages";
import {
  continueWithoutSecret,
  WorkflowWebhookSecretDialog,
} from "./WorkflowWebhookSecretDialog";

const workflowId = "55555555-5555-4555-8555-555555555555";
const hookUrl = `https://relay.example.test/hooks/${workflowId}?raw={path}`;
const masked = "•".repeat(24);
const clipboardDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  "clipboard",
);
const writeText = vi.fn(async (_value: string) => {});

beforeEach(() => {
  setLanguage("en");
  writeText.mockReset();
  writeText.mockImplementation(async () => {});
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
});
afterEach(() => {
  cleanup();
  setLanguage("en");
  if (clipboardDescriptor)
    Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
  else Reflect.deleteProperty(navigator, "clipboard");
  vi.restoreAllMocks();
});

function heldCopy() {
  let release!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((resolve, fail) => {
    release = resolve;
    reject = fail;
  });
  return { promise, release, reject };
}

function mount(secret: string | undefined, address: string | null = hookUrl) {
  const take = vi.fn(() => secret);
  const onContinue = vi.fn();
  const view = render(
    <StrictMode>
      <WorkflowWebhookSecretDialog
        workflowId={workflowId}
        hookUrl={address ?? undefined}
        take={take}
        onContinue={onContinue}
      />
    </StrictMode>,
  );
  return { ...view, take, onContinue };
}

const locale = (language: Language) => act(() => setLanguage(language));

it("keeps the same masked dialog and focused copy control across locale changes and one held copy", async () => {
  const secret = "Unavailable {path} <literal>\n한글";
  const copy = heldCopy();
  writeText.mockImplementation(() => copy.promise);
  const persist = vi.spyOn(Storage.prototype, "setItem");
  const h = mount(secret);
  const dialog = screen.getByRole("dialog", { name: "Webhook ready" });
  const url = screen.getByTestId("webhook-url");
  const code = screen.getByTestId("webhook-secret");
  const button = within(dialog).getByRole("button", { name: "Copy secret" });
  try {
    expect(h.take).toHaveBeenCalledTimes(1);
    expect(url.textContent).toBe(hookUrl);
    expect(code.textContent).toBe(masked);
    expect(document.body.textContent).not.toContain(secret);
    button.focus();
    fireEvent.click(button);
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(secret);
    for (const language of ["ko", "en", "ko"] as const) {
      locale(language);
      expect(
        screen.getByRole("dialog", {
          name: language === "ko" ? "웹훅 준비 완료" : "Webhook ready",
        }),
      ).toBe(dialog);
      expect(
        within(dialog).getByRole("button", {
          name: language === "ko" ? "시크릿 복사" : "Copy secret",
        }),
      ).toBe(button);
      expect(button).toHaveFocus();
      expect(screen.getByTestId("webhook-url")).toBe(url);
      expect(screen.getByTestId("webhook-secret")).toBe(code);
      expect(code.textContent).toBe(masked);
      expect(url.textContent).toBe(hookUrl);
      expect(writeText).toHaveBeenCalledTimes(1);
      expect(h.take).toHaveBeenCalledTimes(1);
    }
    await act(async () => {
      copy.release();
      await copy.promise;
    });
    const notice = screen.getByRole("status");
    expect(notice.textContent).toBe("시크릿을 복사했습니다.");
    locale("en");
    expect(screen.getByRole("status")).toBe(notice);
    expect(notice.textContent).toBe("Secret copied.");
    expect(code.textContent).toBe(masked);
    expect(document.body.textContent).not.toContain(secret);
    fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));
    expect(h.onContinue).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(persist.mock.calls).toEqual(
      ["ko", "en", "ko", "en"].map((language) => [localeStorageKey, language]),
    );
  } finally {
    await act(async () => {
      copy.release();
      await copy.promise;
    });
    h.unmount();
  }
});

it("keeps the unseen-secret confirmation, IDs and focused cancel action through EN KO EN", async () => {
  const secret = "Continue without this secret? {path}";
  const h = mount(secret);
  const dialog = screen.getByRole("dialog", { name: "Webhook ready" });
  const maskedCode = screen.getByTestId("webhook-secret");
  const proceed = within(dialog).getByRole("button", { name: "Continue" });
  proceed.focus();
  fireEvent.click(proceed);
  const confirm = await screen.findByRole("alertdialog", {
    name: "Continue without this secret?",
  });
  const back = within(confirm).getByRole("button", { name: "Go back" });
  await waitFor(() => expect(back).toHaveFocus());
  const ids = ["id", "aria-labelledby", "aria-describedby"].map((name) =>
    confirm.getAttribute(name),
  );
  for (const language of ["ko", "en", "ko"] as const) {
    locale(language);
    expect(
      screen.getByRole("alertdialog", {
        name:
          language === "ko"
            ? "시크릿을 보관하지 않고 계속할까요?"
            : "Continue without this secret?",
      }),
    ).toBe(confirm);
    expect(
      within(confirm).getByRole("button", {
        name: language === "ko" ? "돌아가기" : "Go back",
      }),
    ).toBe(back);
    expect(back).toHaveFocus();
    expect(
      ["id", "aria-labelledby", "aria-describedby"].map((name) =>
        confirm.getAttribute(name),
      ),
    ).toEqual(ids);
    expect(maskedCode.textContent).toBe(masked);
    expect(document.body.textContent).not.toContain(secret);
    expect(h.take).toHaveBeenCalledTimes(1);
    expect(h.onContinue).not.toHaveBeenCalled();
    expect(writeText).not.toHaveBeenCalled();
  }
  fireEvent.click(back);
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect(screen.getByRole("dialog", { name: "웹훅 준비 완료" })).toBe(dialog);
  await waitFor(() => expect(proceed).toHaveFocus());
  fireEvent.click(proceed);
  const again = await screen.findByRole("alertdialog", {
    name: "시크릿을 보관하지 않고 계속할까요?",
  });
  fireEvent.click(within(again).getByRole("button", { name: "계속" }));
  expect(h.onContinue).toHaveBeenCalledTimes(1);
  expect(h.take).toHaveBeenCalledTimes(1);
});

it.each([
  ["URL", true, "URL copied.", "URL을 복사했습니다."],
  [
    "URL",
    false,
    "Couldn’t copy the URL. Select it and copy it manually.",
    "URL을 복사하지 못했습니다. URL을 선택해 직접 복사하세요.",
  ],
  [
    "secret",
    false,
    "Couldn’t copy the secret. Reveal it and copy it manually.",
    "시크릿을 복사하지 못했습니다. 시크릿을 표시한 뒤 직접 복사하세요.",
  ],
] as const)(
  "retains a %s copy notice across locales with success=%s and keeps the original handling guard",
  async (target, success, englishNotice, koreanNotice) => {
    const copy = heldCopy();
    writeText.mockImplementationOnce(() => copy.promise);
    const secret = "Secret copied. {path} Unavailable";
    const h = mount(secret);
    const dialog = screen.getByRole("dialog", { name: "Webhook ready" });
    const button = within(dialog).getByRole("button", {
      name: target === "URL" ? "Copy URL" : "Copy secret",
    });
    const raw = target === "URL" ? hookUrl : secret;
    try {
      button.focus();
      fireEvent.click(button);
      expect(writeText).toHaveBeenCalledTimes(1);
      expect(writeText).toHaveBeenCalledWith(raw);
      locale("ko");
      expect(
        within(dialog).getByRole("button", {
          name: target === "URL" ? "URL 복사" : "시크릿 복사",
        }),
      ).toBe(button);
      expect(button).toHaveFocus();
      expect(screen.queryByRole("status")).toBeNull();
      await act(async () => {
        if (success) copy.release();
        else copy.reject(new Error("Synthetic clipboard failure {path}"));
        await copy.promise.catch(() => {});
      });
      const notice = screen.getByRole("status");
      expect(notice.textContent).toBe(koreanNotice);
      expect(notice).toHaveClass(success ? "text-secondary" : "text-danger");
      locale("en");
      expect(screen.getByRole("status")).toBe(notice);
      expect(notice.textContent).toBe(englishNotice);
      expect(screen.getByTestId("webhook-secret").textContent).toBe(masked);
      expect(document.body.textContent).not.toContain(secret);
      expect(document.body.textContent).not.toContain(
        "Synthetic clipboard failure",
      );
      fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));
      const confirm = await screen.findByRole("alertdialog", {
        name: "Continue without this secret?",
      });
      expect(h.onContinue).not.toHaveBeenCalled();
      fireEvent.click(within(confirm).getByRole("button", { name: "Go back" }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
      // A new explicit copy action retries the boundary with the same raw secret.
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Copy secret" }),
      );
      await waitFor(() => expect(notice.textContent).toBe("Secret copied."));
      expect(writeText).toHaveBeenCalledTimes(2);
      expect(writeText).toHaveBeenLastCalledWith(secret);
      expect(h.take).toHaveBeenCalledTimes(1);
      fireEvent.click(within(dialog).getByRole("button", { name: "Continue" }));
      expect(h.onContinue).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("alertdialog")).toBeNull();
    } finally {
      await act(async () => {
        copy.release();
        await copy.promise.catch(() => {});
      });
      h.unmount();
    }
  },
);

it.each([null, ""])(
  "keeps the relative route code node and missing-secret policy when the address is %s",
  (address) => {
    const h = mount(undefined, address);
    const path = `/hooks/${workflowId}`;
    const code = screen.getByText(path, { selector: "code" });
    const notice = screen.getByRole("alert");
    const reveal = screen.getByRole("button", {
      name: "Reveal webhook secret",
    });
    const copy = screen.getByRole("button", { name: "Copy secret" });
    const ids = Array.from(document.querySelectorAll("[id]")).map(
      (node) => node.id,
    );
    expect(screen.queryByTestId("webhook-url")).toBeNull();
    expect(code.parentElement?.textContent).toBe(
      `The relay’s HTTP address is unavailable from this host. Send requests to ${path} on the relay.`,
    );
    for (const language of ["ko", "en", "ko"] as const) {
      locale(language);
      expect(screen.getByText(path, { selector: "code" })).toBe(code);
      expect(code.textContent).toBe(path);
      expect(
        Array.from(document.querySelectorAll("[id]")).map((node) => node.id),
      ).toEqual(ids);
      expect(screen.getByTestId("webhook-secret").textContent).toBe(
        language === "ko" ? "사용할 수 없음" : "Unavailable",
      );
      expect(screen.getByRole("alert")).toBe(notice);
      expect(notice.textContent).toBe(
        language === "ko"
          ? "이 세션에서 더 이상 이 시크릿을 확인할 수 없습니다."
          : "This secret is no longer available from this session.",
      );
      expect(code.parentElement?.textContent).toBe(
        language === "ko"
          ? `이 호스트에서 릴레이의 HTTP 주소를 확인할 수 없습니다. 릴레이의 ${path} 경로로 요청을 보내세요.`
          : `The relay’s HTTP address is unavailable from this host. Send requests to ${path} on the relay.`,
      );
      expect(reveal).toBeDisabled();
      expect(copy).toBeDisabled();
      fireEvent.click(copy);
      fireEvent.click(reveal);
      expect(writeText).not.toHaveBeenCalled();
      expect(h.take).toHaveBeenCalledTimes(1);
    }
    fireEvent.click(screen.getByRole("button", { name: "계속" }));
    expect(h.onContinue).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  },
);

it.each([
  "Unavailable",
  "Couldn’t copy the URL. Select it and copy it manually.",
  "",
])(
  "preserves the provided secret %j without guessing from its English text",
  async (secret) => {
    const h = mount(secret);
    const code = screen.getByTestId("webhook-secret");
    const reveal = screen.getByRole("button", {
      name: "Reveal webhook secret",
    });
    const copy = screen.getByRole("button", { name: "Copy secret" });
    expect(reveal).toBeEnabled();
    expect(copy).toBeEnabled();
    reveal.focus();
    fireEvent.click(reveal);
    expect(code.textContent).toBe(secret);
    for (const language of ["ko", "en", "ko"] as const) {
      locale(language);
      expect(
        screen.getByRole("button", {
          name:
            language === "ko" ? "웹훅 시크릿 숨기기" : "Hide webhook secret",
        }),
      ).toBe(reveal);
      expect(reveal).toHaveFocus();
      expect(screen.getByTestId("webhook-secret")).toBe(code);
      expect(code.textContent).toBe(secret);
      expect(h.take).toHaveBeenCalledTimes(1);
    }
    fireEvent.click(copy);
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(
        "시크릿을 복사했습니다.",
      ),
    );
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(secret);
    // Revealing already satisfies the original handling guard.
    fireEvent.click(screen.getByRole("button", { name: "계속" }));
    expect(h.onContinue).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  },
);

it("registers the complete finite catalog with matching variables and no fallback", () => {
  expect(Object.keys(en)).toHaveLength(21);
  expect(validateCatalogs(en, ko)).toEqual({
    missing: [],
    unexpected: [],
    variables: [],
  });
  for (const [key, text] of Object.entries(en))
    expect(english).toHaveProperty(key, text);
  for (const [key, text] of Object.entries(ko))
    expect(korean).toHaveProperty(key, text);
});

it("keeps the exported English confirmation contract unchanged in Korean", () => {
  locale("ko");
  expect(continueWithoutSecret).toEqual({
    title: "Continue without this secret?",
    description:
      "This private webhook secret cannot be recovered. Copy and store it before continuing, or explicitly leave it behind.",
    action: "Continue",
    cancel: "Go back",
    destructive: true,
  });
});
