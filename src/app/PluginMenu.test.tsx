// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import type { PluginManager } from "../plugins/manager";
import type { PluginInfo } from "../plugins/types";
import { setLanguage } from "../shared/i18n/language";
import { PluginMenu } from "./PluginMenu";

afterEach(() => {
  cleanup();
  setLanguage("en");
});

function fixture() {
  const plugin: PluginInfo = {
    manifest: {
      id: "example.raw",
      name: "Delete {raw} 사용자",
      apiVersion: 1,
      updates: { defaultEnabled: true },
    },
    source: "external",
    enabled: true,
    revision: "current",
    previous: "previous",
    reloadable: false,
    error: null,
    updateSource: {
      repository: "https://example.org/raw.git",
      reference: "main",
      path: "raw",
    },
  };
  const change = vi.fn<PluginManager["change"]>().mockResolvedValue(true);
  let error: string | null = null;
  const plugins = {
    change,
    snapshot: () => ({ error }),
  } as unknown as PluginManager;
  return {
    plugin,
    plugins,
    change,
    setError(value: string | null) {
      error = value;
    },
  };
}

it.each(["remove", "rollback"] as const)(
  "keeps %s confirmation, pending operation and fallback live without changing raw action or plugin identity",
  async (action) => {
    const f = fixture();
    const removed = vi.fn();
    render(
      <PluginMenu
        plugin={f.plugin}
        plugins={f.plugins}
        busy={false}
        onRemoved={removed}
      />,
    );
    const trigger = screen.getByRole("button", { name: "More plugin actions" });
    const user = userEvent.setup();
    await user.click(trigger);
    const menu = await screen.findByRole("menu", { name: "Plugin actions" });
    const item = within(menu).getByRole("menuitem", {
      name: action === "remove" ? "Delete" : "Roll back",
    });
    item.focus();
    act(() => setLanguage("ko"));
    expect(screen.getByRole("menu", { name: "플러그인 작업" })).toBe(menu);
    expect(
      within(menu).getByRole("menuitem", {
        name: action === "remove" ? "삭제" : "이전 버전으로 되돌리기",
      }),
    ).toBe(item);
    expect(item).toHaveFocus();
    expect(screen.getByRole("button", { name: "플러그인 추가 작업" })).toBe(
      trigger,
    );
    await user.keyboard("{Enter}");
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveAccessibleName(
      action === "remove"
        ? `${f.plugin.manifest.name} 삭제?`
        : `${f.plugin.manifest.name} 이전 버전으로 되돌리기?`,
    );
    const confirm = within(dialog).getByRole("button", {
      name: action === "remove" ? "플러그인 삭제" : "이전 버전으로 되돌리기",
    });
    let finish!: (value: boolean) => void;
    f.change.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    await user.click(confirm);
    try {
      expect(confirm).toBeDisabled();
      act(() => setLanguage("en"));
      expect(screen.getByRole("alertdialog")).toBe(dialog);
      expect(
        within(dialog).getByRole("button", {
          name: action === "remove" ? "Delete plugin" : "Roll back",
        }),
      ).toBe(confirm);
      expect(f.change).toHaveBeenCalledExactlyOnceWith(action, "example.raw");
      await user.keyboard("{Escape}");
      expect(screen.getByRole("alertdialog")).toBe(dialog);
      await act(async () => finish(false));
      const error = within(dialog).getByRole("alert");
      expect(error).toHaveTextContent(
        action === "remove"
          ? "Plugin deletion wasn’t confirmed. Try again."
          : "Plugin rollback wasn’t confirmed. Try again.",
      );
      act(() => setLanguage("ko"));
      expect(within(dialog).getByRole("alert")).toBe(error);
      expect(error).toHaveTextContent(
        action === "remove"
          ? "플러그인 삭제를 확인하지 못했습니다. 다시 시도해 주세요."
          : "플러그인 이전 버전 복원을 확인하지 못했습니다. 다시 시도해 주세요.",
      );
      f.setError("Plugin deletion wasn’t confirmed. Try again.");
      f.change.mockResolvedValueOnce(false);
      await user.click(confirm);
      expect(await within(dialog).findByRole("alert")).toHaveTextContent(
        "Plugin deletion wasn’t confirmed. Try again.",
      );
      expect(f.change).toHaveBeenNthCalledWith(2, action, "example.raw");
      await user.click(confirm);
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
      expect(f.change).toHaveBeenNthCalledWith(3, action, "example.raw");
      expect(removed).toHaveBeenCalledTimes(action === "remove" ? 1 : 0);
    } finally {
      await act(async () => finish(false));
    }
  },
);

it("preserves explicit labels, policy value and raw capability identifiers in a live access dialog", async () => {
  const f = fixture();
  f.plugin.manifest = {
    ...f.plugin.manifest,
    host: { networkOrigins: ["https://example.org/Review%20access"] },
  };
  render(
    <PluginMenu
      plugin={f.plugin}
      plugins={f.plugins}
      busy={false}
      label="More plugin actions"
      toggle={{ label: "Review access raw", disabled: false, run: vi.fn() }}
    />,
  );
  act(() => setLanguage("ko"));
  const trigger = screen.getByRole("button", { name: "More plugin actions" });
  fireEvent.click(trigger);
  const choice = await screen.findByRole("menuitemcheckbox", {
    name: "자동으로 업데이트 확인",
  });
  expect(choice).toHaveAttribute("aria-checked", "true");
  expect(
    screen.getByRole("menuitem", { name: "Review access raw" }),
  ).toBeVisible();
  fireEvent.click(choice);
  expect(f.change).toHaveBeenCalledExactlyOnceWith(
    "disable-update-checks",
    "example.raw",
  );
  expect(screen.getByRole("menu", { name: "플러그인 작업" })).toBeVisible();
  fireEvent.click(screen.getByRole("menuitem", { name: "접근 권한 검토" }));
  const dialog = await screen.findByRole("dialog", {
    name: "이 플러그인이 할 수 있는 작업",
  });
  fireEvent.click(
    within(dialog).getByRole("button", {
      name: /example\.org\/Review%20access/,
    }),
  );
  await waitFor(() =>
    expect(
      within(dialog).getByText("https://example.org/Review%20access"),
    ).toBeVisible(),
  );
  const done = within(dialog).getByRole("button", { name: "완료" });
  done.focus();
  act(() => setLanguage("en"));
  expect(screen.getByRole("dialog", { name: "What this plugin can do" })).toBe(
    dialog,
  );
  expect(within(dialog).getByRole("button", { name: "Done" })).toBe(done);
  expect(done).toHaveFocus();
  expect(f.change).toHaveBeenCalledTimes(1);
});
