// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n";
import { CreateSidebarSection } from "./CreateSidebarSection";
import { RenameSidebarSection } from "./RenameSidebarSection";
import { SidebarActiveDialog, activeWindowLabel } from "./SidebarActiveDialog";

beforeEach(() => setLanguage("en"));
afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
});

it.each(["retry", "cancel"] as const)(
  "retains the recovery draft and %s focus across locale and preference recovery",
  async (target) => {
    let finish: (() => void) | undefined;
    const retry = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const props = {
      channelName: "Create new section",
      create: vi.fn(() => false),
      close: vi.fn(),
      refreshing: false,
      retry,
    };
    try {
      const view = render(<CreateSidebarSection {...props} writable={false} />);
      const dialog = screen.getByRole("dialog", {
        name: "Move to new section",
      });
      const input = screen.getByRole("textbox", { name: "Section name" });
      await waitFor(() => expect(input).toHaveFocus());
      fireEvent.change(input, { target: { value: "Raw 한글 {section}" } });
      const retryButton = screen.getByRole("button", {
        name: "Retry preferences",
      });
      retryButton.focus();
      act(() => setLanguage("ko"));
      expect(screen.getByRole("dialog", { name: "새 섹션으로 이동" })).toBe(
        dialog,
      );
      expect(screen.getByRole("button", { name: "설정 다시 불러오기" })).toBe(
        retryButton,
      );
      expect(retryButton).toHaveFocus();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "저장된 설정을 불러올 수 없습니다. 설정을 다시 불러온 뒤 시도해 주세요.",
      );
      expect(
        screen.getByRole("button", { name: "만들고 이동" }),
      ).toBeDisabled();
      fireEvent.click(retryButton);
      expect(retry).toHaveBeenCalledExactlyOnceWith();
      const cancel = screen.getByRole("button", { name: "취소" });
      if (target === "cancel") cancel.focus();
      act(() => setLanguage("en"));
      expect(input).toHaveValue("Raw 한글 {section}");
      expect(target === "cancel" ? cancel : retryButton).toHaveFocus();
      view.rerender(<CreateSidebarSection {...props} writable />);
      await act(async () => finish?.());
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(target === "cancel" ? cancel : input).toHaveFocus();
      expect(props.create).not.toHaveBeenCalled();
      if (target === "cancel") {
        await userEvent.keyboard("{Enter}");
        expect(props.close).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({ type: "click", target: cancel }),
        );
      }
    } finally {
      await act(async () => finish?.());
    }
  },
);

it("keeps rename input, range and raw failure while a trimmed rename is pending and retried", async () => {
  let reject: ((reason: Error) => void) | undefined;
  const rename = vi
    .fn<(name: string) => Promise<void>>()
    .mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    )
    .mockResolvedValue(undefined);
  const close = vi.fn();
  try {
    render(
      <RenameSidebarSection
        title="Rename section"
        rename={rename}
        close={close}
        finalFocus={{ current: null }}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Rename section" });
    const input = screen.getByRole("textbox", { name: "Section name" });
    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveValue("Rename section");
    fireEvent.change(input, { target: { value: "  Raw 새 이름 {name}  " } });
    (input as HTMLInputElement).setSelectionRange(3, 7);
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(
        screen.getByRole("dialog", {
          name: language === "ko" ? "섹션 이름 변경" : "Rename section",
        }),
      ).toBe(dialog);
      expect(
        screen.getByRole("textbox", {
          name: language === "ko" ? "섹션 이름" : "Section name",
        }),
      ).toBe(input);
      expect(input).toHaveValue("  Raw 새 이름 {name}  ");
      expect(input).toHaveFocus();
      expect([
        (input as HTMLInputElement).selectionStart,
        (input as HTMLInputElement).selectionEnd,
      ]).toEqual([3, 7]);
      expect(rename).not.toHaveBeenCalled();
    }
    const form = input.closest("form");
    if (!form) throw new Error("Missing rename form");
    fireEvent.submit(form);
    expect(rename).toHaveBeenCalledExactlyOnceWith("Raw 새 이름 {name}");
    expect(input).toBeDisabled();
    act(() => setLanguage("ko"));
    expect(screen.getByRole("status")).toHaveTextContent(
      "섹션 이름을 변경하고 확인을 기다리는 중입니다…",
    );
    expect(screen.getByRole("button", { name: "취소" })).toBeDisabled();
    await userEvent.keyboard("{Escape}");
    expect(close).not.toHaveBeenCalled();
    await act(async () => reject?.(new Error("Rename section")));
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Rename section");
    act(() => setLanguage("en"));
    expect(screen.getByRole("alert")).toBe(alert);
    expect(alert).toHaveTextContent("Rename section");
    expect(input).toHaveValue("  Raw 새 이름 {name}  ");
    fireEvent.submit(form);
    await waitFor(() => expect(close).toHaveBeenCalledExactlyOnceWith());
    expect(rename.mock.calls).toEqual([
      ["Raw 새 이름 {name}"],
      ["Raw 새 이름 {name}"],
    ]);
  } finally {
    await act(async () => reject?.(new Error("Test cleanup")));
  }
});

it("preserves a raw same-English name and closes a whitespace-only rename without writing", async () => {
  const rename = vi.fn(),
    close = vi.fn();
  render(
    <RenameSidebarSection
      title="Rename section"
      rename={rename}
      close={close}
      finalFocus={{ current: null }}
    />,
  );
  const input = screen.getByRole("textbox", { name: "Section name" });
  await waitFor(() => expect(input).toHaveFocus());
  act(() => setLanguage("ko"));
  expect(input).toHaveValue("Rename section");
  fireEvent.change(input, { target: { value: "  Rename section  " } });
  await userEvent.click(screen.getByRole("button", { name: "이름 바꾸기" }));
  expect(close).toHaveBeenCalledExactlyOnceWith();
  expect(rename).not.toHaveBeenCalled();
});

it("retains the four numeric presets and 90-day pending choice, raw failure and exact retry across languages", async () => {
  let reject: ((reason: Error) => void) | undefined;
  const apply = vi
    .fn<(seconds: number) => Promise<void>>()
    .mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    )
    .mockResolvedValue(undefined);
  const close = vi.fn();
  try {
    render(
      <SidebarActiveDialog
        seconds={14 * 86400}
        apply={apply}
        close={close}
        finalFocus={{ current: null }}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Active in the last" });
    expect(screen.getByRole("radio", { name: "30 days" })).toBeChecked();
    const choices = screen.getAllByRole("radio");
    expect(choices).toHaveLength(4);
    await userEvent.click(screen.getByRole("radio", { name: "90 days" }));
    const selected = screen.getByRole("radio", { name: "90 days" });
    selected.focus();
    act(() => setLanguage("ko"));
    expect(screen.getByRole("dialog", { name: "최근 활동 기간" })).toBe(dialog);
    expect(
      screen.getByRole("radiogroup", { name: "기간" }),
    ).toBeInTheDocument();
    for (const [index, days] of [1, 7, 30, 90].entries())
      expect(screen.getByRole("radio", { name: `${days}일` })).toBe(
        choices[index],
      );
    expect(selected).toHaveFocus();
    expect(selected).toBeChecked();
    expect(apply).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "적용" }));
    const focus = document.activeElement;
    expect(apply).toHaveBeenCalledExactlyOnceWith(90 * 86400);
    expect(screen.getByRole("status")).toHaveTextContent(
      "필터를 저장하고 확인을 기다리는 중입니다…",
    );
    act(() => setLanguage("en"));
    expect(screen.getByRole("radio", { name: "90 days" })).toBe(selected);
    expect(document.activeElement).toBe(focus);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Saving filter and waiting for confirmation…",
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    await userEvent.keyboard("{Escape}");
    expect(close).not.toHaveBeenCalled();
    await act(async () => reject?.(new Error("Active in the last")));
    act(() => setLanguage("ko"));
    expect(screen.getByRole("alert")).toHaveTextContent("Active in the last");
    expect(selected).toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "적용" }));
    await waitFor(() => expect(close).toHaveBeenCalledExactlyOnceWith());
    expect(apply.mock.calls).toEqual([[90 * 86400], [90 * 86400]]);
    expect(activeWindowLabel(86400)).toBe("1 day");
    expect(activeWindowLabel(14 * 86400)).toBe("14 days");
  } finally {
    await act(async () => reject?.(new Error("Test cleanup")));
  }
});

it("keeps the original empty-diagnostic truthiness and 14-day fallback draft", async () => {
  const apply = vi.fn().mockRejectedValue(new Error(""));
  render(
    <SidebarActiveDialog
      seconds={14 * 86400}
      apply={apply}
      close={vi.fn()}
      finalFocus={{ current: null }}
    />,
  );
  act(() => setLanguage("ko"));
  expect(screen.getByRole("radio", { name: "30일" })).toBeChecked();
  await userEvent.click(screen.getByRole("button", { name: "적용" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "취소" })).toBeEnabled(),
  );
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(apply).toHaveBeenCalledExactlyOnceWith(30 * 86400);
  expect(screen.getByRole("radio", { name: "30일" })).toBeChecked();
});

it("retains the actual create form, selection and one pending snapshot across languages and retries the uncertain identity", async () => {
  let reject: ((reason: Error) => void) | undefined;
  const create = vi
    .fn<(section: { id: string; name: string }) => Promise<boolean>>()
    .mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    )
    .mockResolvedValue(true);
  const close = vi.fn();
  try {
    render(
      <CreateSidebarSection
        create={create}
        close={close}
        writable
        refreshing={false}
        retry={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Create new section" });
    const input = screen.getByRole("textbox", { name: "Section name" });
    await waitFor(() => expect(input).toHaveFocus());
    fireEvent.change(input, { target: { value: "  Name 한글 {name}  " } });
    const form = input.closest("form");
    if (!form) throw new Error("Missing create form");
    const formId = form.id;
    fireEvent.submit(form);
    expect(create).toHaveBeenCalledExactlyOnceWith({
      id: expect.any(String),
      name: "Name 한글 {name}",
    });
    const snapshot = create.mock.calls[0]?.[0];
    input.focus();
    (input as HTMLInputElement).setSelectionRange(2, 8);
    act(() => setLanguage("ko"));
    expect(screen.getByRole("dialog", { name: "새 섹션 만들기" })).toBe(dialog);
    expect(screen.getByRole("textbox", { name: "섹션 이름" })).toBe(input);
    expect(input).toHaveAttribute("placeholder", "섹션 이름");
    expect(input).toHaveValue("  Name 한글 {name}  ");
    expect(input).toHaveFocus();
    expect([
      (input as HTMLInputElement).selectionStart,
      (input as HTMLInputElement).selectionEnd,
    ]).toEqual([2, 8]);
    expect(input).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "취소" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "만들기" })).toHaveAttribute(
      "form",
      formId,
    );
    fireEvent.submit(form);
    expect(create).toHaveBeenCalledTimes(1);
    await act(async () => reject?.(new Error("arbitrary upstream diagnostic")));
    const alert = screen.getByRole("alert");
    const alertId = alert.id;
    expect(alert).toHaveTextContent(
      "섹션이 저장되었는지 확인할 수 없습니다. 다시 시도해 주세요.",
    );
    expect(input).toHaveAttribute("aria-describedby", alertId);
    expect(
      screen.queryByText("arbitrary upstream diagnostic"),
    ).not.toBeInTheDocument();
    act(() => setLanguage("en"));
    expect(screen.getByRole("dialog", { name: "Create new section" })).toBe(
      dialog,
    );
    expect(screen.getByRole("alert")).toBe(alert);
    expect(alert).toHaveTextContent(
      "Couldn't confirm the section was saved. Try again.",
    );
    expect(alert.id).toBe(alertId);
    expect(input.closest("form")).toBe(form);
    expect(input).toHaveValue("  Name 한글 {name}  ");
    fireEvent.submit(form);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled(),
    );
    expect(create.mock.calls).toEqual([[snapshot], [snapshot]]);
    expect(close).not.toHaveBeenCalled();
  } finally {
    await act(async () => reject?.(new Error("Test cleanup")));
  }
});
