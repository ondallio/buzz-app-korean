// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n";
import { SidebarSection } from "./SidebarSection";
import * as iconButtons from "../../shared/design-system/ui/IconButton";

beforeEach(() => setLanguage("en"));
afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
  vi.restoreAllMocks();
});

it("keeps an open sort popup, selected custom mode, focus and raw titles across languages without writes", async () => {
  const change = vi.fn();
  const user = userEvent.setup();
  render(
    <SidebarSection
      sectionKey="group:work"
      title="Starred"
      open
      onToggle={vi.fn()}
      sort={{
        value: "plugin:fixture.recent",
        modes: [{ id: "plugin:fixture.recent", label: "Recent" }],
        change,
      }}
    >
      <button type="button">Raw channel {"{name}"}</button>
    </SidebarSection>,
  );
  const trigger = screen.getByRole("button", {
    name: "More actions for Starred",
  });
  await user.click(trigger);
  const menu = await screen.findByRole("menu", {
    name: "More actions for Starred",
  });
  await user.keyboard("{ArrowDown}{ArrowRight}");
  const popup = await screen.findByRole("menu", { name: "Sort Starred" });
  const selected = screen
    .getAllByRole("menuitemradio", { name: "Recent" })
    .find((row) => row.getAttribute("aria-checked") === "true");
  if (!selected) throw new Error("Missing custom selected mode");
  selected.focus();
  for (const language of ["ko", "en"] as const) {
    act(() => setLanguage(language));
    expect(
      screen.getByRole("menu", {
        name:
          language === "ko" ? "Starred 추가 작업" : "More actions for Starred",
      }),
    ).toBe(menu);
    expect(
      screen.getByRole("menu", {
        name: language === "ko" ? "Starred 정렬" : "Sort Starred",
      }),
    ).toBe(popup);
    expect(selected).toHaveTextContent("Recent");
    expect(selected).toHaveAttribute("aria-checked", "true");
    expect(selected).toHaveFocus();
    if (language === "ko")
      expect(
        screen.getByRole("menuitemradio", { name: "최근 활동순" }),
      ).toHaveAttribute("aria-checked", "false");
    expect(change).not.toHaveBeenCalled();
  }
  await user.click(screen.getByRole("menuitemradio", { name: "A–Z" }));
  expect(change).toHaveBeenCalledExactlyOnceWith("alpha");
  await waitFor(() => expect(menu).not.toBeInTheDocument());
  expect(trigger).toHaveFocus();
  expect(screen.getByLabelText("Starred")).toHaveTextContent("Starred");
});

it.each([
  ["starred", "Starred", "즐겨찾기"],
  ["channels", "Channels", "채널"],
  ["forums", "Forums", "포럼"],
  ["dms", "Direct messages", "다이렉트 메시지"],
  ["group:work", "Starred", "Starred"],
  ["plugin:fixture", "Channels", "Channels"],
  ["scope:fixture", "Direct messages", "Direct messages"],
  ["channels", "Custom Channels", "Custom Channels"],
])(
  "projects only the proven title for %s/%s",
  async (sectionKey, title, korean) => {
    const toggle = vi.fn();
    render(
      <SidebarSection
        sectionKey={sectionKey}
        title={title}
        open={false}
        onToggle={toggle}
      >
        <button type="button">Raw row</button>
      </SidebarSection>,
    );
    const summary = screen.getByLabelText(title);
    const controls = summary.getAttribute("aria-controls");
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(screen.getByLabelText(language === "ko" ? korean : title)).toBe(
        summary,
      );
      expect(summary).toHaveTextContent(language === "ko" ? korean : title);
      expect(summary).toHaveAttribute("aria-controls", controls);
      expect(summary.closest("[data-sidebar-section]")).toHaveAttribute(
        "data-sidebar-section",
        sectionKey,
      );
      expect(toggle).not.toHaveBeenCalled();
    }
    await userEvent.click(summary);
    expect(toggle).toHaveBeenCalledExactlyOnceWith(true);
  },
);

it.each([undefined, 0, 1, 2])(
  "retains the %s-count confirmation, pending operation, opaque error and retry focus",
  async (count) => {
    let reject: ((error: Error) => void) | undefined;
    const remove = vi
      .fn<() => Promise<void>>()
      .mockImplementationOnce(
        () =>
          new Promise((_, fail) => {
            reject = fail;
          }),
      )
      .mockResolvedValue(undefined);
    const user = userEvent.setup();
    try {
      render(
        <SidebarSection
          sectionKey="group:work"
          title="Starred"
          open
          onToggle={vi.fn()}
          onRemove={remove}
          channelCount={count}
        >
          <button type="button">Raw channel</button>
        </SidebarSection>,
      );
      const trigger = screen.getByRole("button", {
        name: "More actions for Starred",
      });
      await user.click(trigger);
      await user.click(
        await screen.findByRole("menuitem", { name: "Remove section" }),
      );
      const dialog = screen.getByRole("dialog", { name: "Remove Starred?" });
      const cancel = within(dialog).getByRole("button", { name: "Cancel" });
      expect(dialog).toHaveAccessibleDescription(
        count === undefined
          ? "Assigned channels will move back to Channels. This does not delete any channels."
          : `${count} ${count === 1 ? "channel" : "channels"} will move back to Channels. This does not delete any channels.`,
      );
      await user.click(
        within(dialog).getByRole("button", { name: "Remove section" }),
      );
      expect(remove).toHaveBeenCalledExactlyOnceWith();
      const focus = document.activeElement;
      for (const language of ["ko", "en", "ko"] as const) {
        act(() => setLanguage(language));
        expect(
          screen.getByRole("dialog", {
            name:
              language === "ko"
                ? "Starred 섹션을 제거할까요?"
                : "Remove Starred?",
          }),
        ).toBe(dialog);
        expect(cancel).toBeDisabled();
        expect(document.activeElement).toBe(focus);
        if (language === "ko") {
          expect(dialog).toHaveAccessibleDescription(
            count === undefined
              ? "할당된 채널은 채널 섹션으로 돌아갑니다. 채널이 삭제되지는 않습니다."
              : `채널 ${count}개가 채널 섹션으로 돌아갑니다. 채널이 삭제되지는 않습니다.`,
          );
          expect(within(dialog).getByRole("status")).toHaveTextContent(
            "섹션을 제거하고 확인을 기다리는 중입니다…",
          );
        }
        expect(remove).toHaveBeenCalledTimes(1);
      }
      await user.keyboard("{Escape}");
      expect(dialog).toBeVisible();
      await act(async () => reject?.(new Error("Remove section")));
      const alert = within(dialog).getByRole("alert");
      expect(alert).toHaveTextContent("Remove section");
      act(() => setLanguage("en"));
      expect(within(dialog).getByRole("alert")).toBe(alert);
      expect(alert).toHaveTextContent("Remove section");
      await user.click(
        within(dialog).getByRole("button", { name: "Remove section" }),
      );
      await waitFor(() => expect(dialog).not.toBeInTheDocument());
      await waitFor(() => expect(trigger).toHaveFocus());
      expect(remove.mock.calls).toEqual([[], []]);
    } finally {
      await act(async () => reject?.(new Error("Test cleanup")));
    }
  },
);

it.each([1, 14])(
  "keeps the %s-day filter metadata, selected enum and hidden channel data across languages",
  async (days) => {
    const change = vi.fn(),
      select = vi.fn(),
      toggle = vi.fn();
    const user = userEvent.setup();
    render(
      <SidebarSection
        sectionKey="channels"
        title="Channels"
        open={false}
        onToggle={toggle}
        filter={{ value: "active", activeWindowSeconds: days * 86400, change }}
        channels={{ rows: [{ id: "raw-id", name: "Active" }], select }}
      >
        <span>Raw body</span>
      </SidebarSection>,
    );
    const trigger = screen.getByRole("button", {
      name: "More actions for Channels",
    });
    await user.click(trigger);
    await user.click(await screen.findByRole("menuitem", { name: "Filter" }));
    const popup = await screen.findByRole("menu", { name: "Filter Channels" });
    const selected = screen.getByRole("menuitemradio", {
      name: /Active in the last/,
    });
    selected.focus();
    const hiddenRow = screen.getByRole("menuitem", {
      name: "Active",
    });
    for (const language of ["ko", "en"] as const) {
      act(() => setLanguage(language));
      expect(
        screen.getByRole("menu", {
          name: language === "ko" ? "채널 필터" : "Filter Channels",
        }),
      ).toBe(popup);
      expect(
        screen.getByRole("menuitemradio", {
          name: language === "ko" ? /최근 활동 기간/ : /Active in the last/,
        }),
      ).toBe(selected);
      expect(selected).toHaveTextContent(
        language === "ko"
          ? `${days}일`
          : `${days} ${days === 1 ? "day" : "days"}`,
      );
      expect(selected).toHaveAttribute("aria-checked", "true");
      expect(selected).toHaveFocus();
      expect(
        screen.getByRole("group", {
          name:
            language === "ko"
              ? `최근 ${days}일 동안 활동 없음`
              : `No activity in the last ${days} ${days === 1 ? "day" : "days"}`,
        }),
      ).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: "Active" })).toBe(hiddenRow);
      expect(change).not.toHaveBeenCalled();
      expect(select).not.toHaveBeenCalled();
    }
    hiddenRow.focus();
    await user.keyboard("{Enter}");
    expect(select).toHaveBeenCalledExactlyOnceWith("raw-id");
    expect(toggle).toHaveBeenCalledExactlyOnceWith(true);
    await waitFor(() => expect(trigger).toHaveFocus());
  },
);

it("keeps raw rename draft, move availability and caller buttons while localizing host labels", async () => {
  const originalIconButton = iconButtons.IconButton;
  const icons = vi
    .spyOn(iconButtons, "IconButton")
    .mockImplementation((props) => originalIconButton(props));
  const user = userEvent.setup();
  const rename = vi.fn(),
    down = vi.fn(),
    create = vi.fn(),
    message = vi.fn();
  render(
    <SidebarSection
      sectionKey="group:work"
      title="Starred"
      open
      onToggle={vi.fn()}
      onRename={rename}
      move={{ down }}
      createSection={{ available: true, open: create }}
      newMessage={message}
      createChannel={{ available: false, open: vi.fn() }}
    >
      <span>Raw body</span>
    </SidebarSection>,
  );
  act(() => setLanguage("ko"));
  const channel = screen.getByRole("button", { name: "채널 만들기" });
  expect(channel).toBeDisabled();
  expect(
    icons.mock.calls.find(
      ([props]) => props["aria-label"] === "채널 만들기",
    )?.[0].title,
  ).toBe("채널을 만들 수 없음");
  await user.click(screen.getByRole("button", { name: "새 메시지" }));
  expect(message).toHaveBeenCalledTimes(1);
  const trigger = screen.getByRole("button", { name: "Starred 추가 작업" });
  await user.click(trigger);
  expect(
    await screen.findByRole("menuitem", { name: "위로 이동" }),
  ).toHaveAttribute("aria-disabled", "true");
  await user.click(screen.getByRole("menuitem", { name: "아래로 이동" }));
  expect(down).toHaveBeenCalledExactlyOnceWith();
  await user.click(trigger);
  await user.click(
    await screen.findByRole("menuitem", { name: "섹션 만들기" }),
  );
  expect(create).toHaveBeenCalledExactlyOnceWith(trigger);
  await user.click(trigger);
  await user.click(
    await screen.findByRole("menuitem", { name: "섹션 이름 변경" }),
  );
  const dialog = screen.getByRole("dialog", { name: "섹션 이름 변경" });
  const input = within(dialog).getByRole("textbox", { name: "섹션 이름" });
  expect(input).toHaveValue("Starred");
  await user.click(within(dialog).getByRole("button", { name: "취소" }));
  await waitFor(() => expect(trigger).toHaveFocus());
  expect(rename).not.toHaveBeenCalled();
});
