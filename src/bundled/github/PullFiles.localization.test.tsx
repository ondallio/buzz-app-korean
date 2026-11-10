// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n";
import type { GitHubDiff } from "./gh";
import { PullFiles } from "./PullFiles";

function deferred<T>() {
  let resolve: (value: T) => void = () => {
    throw new Error("Uninitialized fixture gate");
  };
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => {
  localStorage.clear();
  setLanguage("en");
});
afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("retains the real delayed loading region and exact pending diff arguments across languages", async () => {
  vi.useFakeTimers();
  const gate = deferred<string>();
  const diff = vi.fn<GitHubDiff>(() => gate.promise);
  const pull = {
    repository: "example/project",
    base: "Raw Changes",
    head: "raw-head-1000",
    merged: undefined,
  };
  const view = render(
    <PullFiles
      url="https://github.com/example/project/pull/7"
      pull={pull}
      diff={diff}
    />,
  );
  try {
    expect(diff).toHaveBeenCalledOnce();
    expect(screen.queryByRole("status")).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading changes from GitHub…");
    const signal = diff.mock.calls[0]?.[1];
    if (!(signal instanceof AbortSignal))
      throw new Error("Missing actual diff signal");
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(screen.getByRole("status")).toBe(status);
      expect(status).toHaveTextContent(
        language === "ko"
          ? "GitHub에서 변경 사항 불러오는 중…"
          : "Loading changes from GitHub…",
      );
      expect(diff).toHaveBeenCalledExactlyOnceWith(pull, signal);
      expect(signal.aborted).toBe(false);
    }
    await act(async () => {
      gate.resolve("");
      await gate.promise;
    });
    expect(screen.getByText("No file changes.")).toBeVisible();
    expect(diff).toHaveBeenCalledExactlyOnceWith(pull, signal);
    expect(signal.aborted).toBe(false);
    view.unmount();
    expect(signal.aborted).toBe(true);
  } finally {
    await act(async () => {
      gate.resolve("");
      await gate.promise;
    });
    view.unmount();
  }
});

it.each([
  {
    name: "same-English Error",
    failure: new Error("No file changes."),
    text: "No file changes.",
  },
  {
    name: "same-English string",
    failure: "Open on GitHub",
    text: "Open on GitHub",
  },
  { name: "empty Error", failure: new Error(""), text: "" },
])(
  "keeps the actual $name diagnostic raw while only translating its recovery link",
  async (c) => {
    const gate = deferred<void>();
    const diff = vi.fn<GitHubDiff>(async () => {
      await gate.promise;
      throw c.failure;
    });
    const pull = {
      repository: "example/project",
      base: "raw-base",
      head: "raw-head",
      merged: 7,
    };
    const view = render(
      <PullFiles
        url="https://github.com/example/project/pull/7"
        pull={pull}
        diff={diff}
      />,
    );
    try {
      act(() => setLanguage("ko"));
      await act(async () => {
        gate.resolve();
        await gate.promise;
      });
      const alert = await screen.findByRole("alert");
      const paragraph = alert.querySelector("p");
      expect(paragraph?.textContent).toBe(c.text);
      const link = screen.getByRole("link", { name: "GitHub에서 열기" });
      link.focus();
      const signal = diff.mock.calls[0]?.[1];
      if (!(signal instanceof AbortSignal))
        throw new Error("Missing actual diff signal");
      for (const language of ["en", "ko"] as const) {
        act(() => setLanguage(language));
        expect(screen.getByRole("alert")).toBe(alert);
        expect(alert.querySelector("p")).toBe(paragraph);
        expect(paragraph?.textContent).toBe(c.text);
        expect(
          screen.getByRole("link", {
            name: language === "ko" ? "GitHub에서 열기" : "Open on GitHub",
          }),
        ).toBe(link);
        expect(link).toHaveAttribute(
          "href",
          "https://github.com/example/project/pull/7/files",
        );
        expect(link).toHaveFocus();
        expect(diff).toHaveBeenCalledExactlyOnceWith(pull, signal);
        expect(signal.aborted).toBe(false);
      }
    } finally {
      await act(async () => {
        gate.resolve();
        await gate.promise;
      });
      view.unmount();
    }
  },
);

it("keeps the empty-files result in the same node across languages with no second diff request", async () => {
  const diff = vi.fn<GitHubDiff>(async () => "");
  const view = render(
    <PullFiles
      url="https://github.com/example/project/pull/7"
      pull={{
        repository: "example/project",
        base: "main",
        head: "same",
        merged: undefined,
      }}
      diff={diff}
    />,
  );
  try {
    const empty = await screen.findByText("No file changes.");
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(
        screen.getByText(
          language === "ko" ? "파일 변경 사항이 없습니다." : "No file changes.",
        ),
      ).toBe(empty);
      expect(diff).toHaveBeenCalledOnce();
    }
  } finally {
    view.unmount();
  }
});
