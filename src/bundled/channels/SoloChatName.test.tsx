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
import { afterEach, expect, it, vi } from "vitest";
import type { RelaySession } from "../../features/relay/session";
import type {
  ChannelDetailsCapability,
  DetailsAttempt,
} from "../../features/relay/channel-details";
import { setLanguage } from "../../shared/i18n";
import { SoloChatName } from "./SoloChatName";

afterEach(() => {
  cleanup();
  setLanguage("en");
  localStorage.clear();
});

function setup(overrides: Partial<ChannelDetailsCapability> = {}) {
  const save = vi.fn(async () => {});
  const close = vi.fn();
  const details: ChannelDetailsCapability = {
    available: true,
    load: vi.fn(async () => ({
      channelId: "chat",
      name: "Plan",
      description: "Keep this",
      visibility: "private" as const,
      labels: ["buzz.solo"],
      ttlSeconds: 600,
      version: "one",
      canEdit: true,
    })),
    save,
    check: vi.fn(async () => {}),
    snapshot: () => undefined,
    subscribe: () => () => {},
    ...overrides,
  };
  render(
    <>
      <SoloChatName
        session={{ channelDetails: details } as RelaySession}
        id="chat"
        title="Plan"
        close={close}
      />
      <button type="button">Elsewhere</button>
    </>,
  );
  return { save, close, details, user: userEvent.setup() };
}

it.each(["", "Plan"])(
  "keeps the confirmed title without writing for %j",
  async (value) => {
    const f = setup();
    const input = await screen.findByRole("textbox", { name: "Chat name" });
    await waitFor(() => expect(input).toHaveFocus());
    await f.user.clear(input);
    if (value) await f.user.keyboard(value);
    await f.user.keyboard("{Enter}");
    await waitFor(() => expect(f.close).toHaveBeenCalledWith(true));
    expect(f.save).not.toHaveBeenCalled();
  },
);

it("saves on click-away without taking focus back from the destination", async () => {
  const f = setup();
  await waitFor(() =>
    expect(screen.getByRole("textbox", { name: "Chat name" })).toHaveFocus(),
  );
  await f.user.keyboard("Renamed");
  await f.user.click(screen.getByRole("button", { name: "Elsewhere" }));
  await waitFor(() => expect(f.close).toHaveBeenCalledWith(false));
  expect(f.save).toHaveBeenCalledWith(
    expect.objectContaining({ name: "Plan" }),
    expect.objectContaining({
      name: "Renamed",
      ttlSeconds: 600,
      description: "Keep this",
      labels: ["buzz.solo"],
    }),
    expect.any(AbortSignal),
  );
  expect(screen.getByRole("button", { name: "Elsewhere" })).toHaveFocus();
});

it("retains an oversized draft without writing on Enter or blur", async () => {
  const f = setup();
  const input = screen.getByRole("textbox", { name: "Chat name" });
  await waitFor(() => expect(input).toHaveFocus());
  await f.user.paste("a".repeat(121));
  await f.user.keyboard("{Enter}");
  const error = screen.getByRole("alert");
  expect(error).toHaveTextContent("at most 120");
  act(() => setLanguage("ko"));
  expect(screen.getByRole("textbox", { name: "채팅 이름" })).toBe(input);
  expect(screen.getByRole("alert")).toBe(error);
  expect(error).toHaveTextContent("채팅 이름은 120자 이내로 입력하세요.");
  expect(input).toHaveValue("a".repeat(121));
  act(() => setLanguage("en"));
  await f.user.click(screen.getByRole("button", { name: "Elsewhere" }));
  expect(f.save).not.toHaveBeenCalled();
  expect(f.close).not.toHaveBeenCalled();
});

it("checks an uncertain save without republishing", async () => {
  const attempt = {
    status: "unconfirmed" as const,
    draft: {
      name: "Pending name",
      description: "Keep this",
      visibility: "private" as const,
      labels: ["buzz.solo"],
      ttlSeconds: 600,
    },
  };
  const f = setup({
    snapshot: () => attempt,
  });
  const input = screen.getByRole("textbox", { name: "Chat name" });
  await waitFor(() => expect(input).toHaveValue("Pending name"));
  expect(input).toHaveAttribute("readonly");
  await f.user.click(screen.getByRole("button", { name: "Check save status" }));
  await waitFor(() => expect(f.close).toHaveBeenCalledWith(true));
  expect(f.details.check).toHaveBeenCalledWith("chat", expect.any(AbortSignal));
  expect(f.save).not.toHaveBeenCalled();
});

it("quietly disables the name while a real pending receipt is saving", async () => {
  let pending: DetailsAttempt | undefined;
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const listener of listeners) listener();
  };
  const save: ChannelDetailsCapability["save"] = vi.fn(async (_base, draft) => {
    pending = { status: "saving", draft };
    emit();
    await gate;
    pending = undefined;
    emit();
  });
  const f = setup({
    save,
    snapshot: () => pending,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  });
  const input = screen.getByRole("textbox", { name: "Chat name" });
  await waitFor(() => expect(input).toHaveFocus());
  await f.user.keyboard("New name{Enter}");
  try {
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(input).toHaveAttribute("readonly");
    expect(input).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("form", { name: "Rename Plan" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    act(() => setLanguage("ko"));
    expect(screen.getByRole("textbox", { name: "채팅 이름" })).toBe(input);
    expect(input).toHaveFocus();
    expect(input).toHaveValue("New name");
    expect(
      screen.getByRole("form", { name: "Plan 이름 변경" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(save).toHaveBeenCalledOnce();
    act(() => setLanguage("en"));
    expect(screen.queryByText("Saving name…")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Reload chat details" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Check save status" }),
    ).toBeNull();
  } finally {
    await act(async () => {
      finish();
      await gate;
    });
  }
  await waitFor(() => expect(f.close).toHaveBeenCalledWith(true));
});

it("releases an abandoned initial read without restoring focus when it completes", async () => {
  let release!: (
    value: Awaited<ReturnType<ChannelDetailsCapability["load"]>>,
  ) => void;
  const loaded = new Promise<
    Awaited<ReturnType<ChannelDetailsCapability["load"]>>
  >((resolve) => {
    release = resolve;
  });
  const f = setup({ load: vi.fn(() => loaded) });
  await f.user.click(screen.getByRole("button", { name: "Elsewhere" }));
  expect(f.close).toHaveBeenCalledWith(false);
  await act(async () => {
    release({
      channelId: "chat",
      name: "Plan",
      description: "Keep this",
      visibility: "private",
      labels: ["buzz.solo"],
      version: "one",
      canEdit: true,
    });
    await loaded;
  });
  expect(screen.getByRole("button", { name: "Elsewhere" })).toHaveFocus();
  expect(f.save).not.toHaveBeenCalled();
});

it.each(["ineligible", "unrelated attempt"])(
  "releases a blocked %s editor on blur without writing",
  async (reason) => {
    const attempt = {
      status: "saving" as const,
      draft: {
        name: "Other",
        description: "Changed elsewhere",
        visibility: "private" as const,
        labels: ["buzz.solo"],
      },
    };
    const f = setup({
      ...(reason === "ineligible"
        ? {
            load: vi.fn(async () => ({
              channelId: "chat",
              name: "Plan",
              description: "",
              visibility: "private" as const,
              labels: ["stream"],
              version: "one",
              canEdit: false,
            })),
          }
        : { snapshot: () => attempt }),
    });
    await screen.findByText(
      reason === "ineligible"
        ? "This chat can’t be renamed."
        : "Finish the pending change in Chat settings first.",
    );
    await f.user.click(screen.getByRole("button", { name: "Elsewhere" }));
    expect(f.close).toHaveBeenCalledWith(false);
    expect(f.save).not.toHaveBeenCalled();
  },
);

it("preserves the same raw rename draft, caret and save request through EN to KO to EN", async () => {
  const h = setup();
  const input = screen.getByRole("textbox", {
    name: "Chat name",
  }) as HTMLInputElement;
  await waitFor(() => expect(input).toHaveFocus());
  fireEvent.change(input, { target: { value: "Raw {name} 한글" } });
  input.setSelectionRange(1, 4);
  const loads = vi.mocked(h.details.load).mock.calls.length;
  act(() => setLanguage("ko"));
  expect(screen.getByRole("textbox", { name: "채팅 이름" })).toBe(input);
  expect(input).toHaveFocus();
  expect(input).toHaveValue("Raw {name} 한글");
  expect([input.selectionStart, input.selectionEnd]).toEqual([1, 4]);
  expect(screen.getByRole("form", { name: "Plan 이름 변경" })).toBeVisible();
  expect(h.details.load).toHaveBeenCalledTimes(loads);
  expect(h.save).not.toHaveBeenCalled();
  act(() => setLanguage("en"));
  expect(screen.getByRole("textbox", { name: "Chat name" })).toBe(input);
  expect(input).toHaveFocus();
  await h.user.keyboard("{Enter}");
  await waitFor(() => expect(h.close).toHaveBeenCalledWith(true));
  expect(h.save).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ name: "Plan" }),
    expect.objectContaining({
      name: "Raw {name} 한글",
      description: "Keep this",
      ttlSeconds: 600,
      labels: ["buzz.solo"],
    }),
    expect.any(AbortSignal),
  );
});

it("preserves an external diagnostic identical to local copy and retries only on request", async () => {
  const load = vi
    .fn<ChannelDetailsCapability["load"]>()
    .mockRejectedValueOnce(new Error("This chat can’t be renamed."))
    .mockResolvedValue({
      channelId: "chat",
      name: "Restored",
      description: "Raw {name}",
      visibility: "private",
      labels: ["buzz.solo"],
      ttlSeconds: 600,
      version: "two",
      canEdit: true,
    });
  const h = setup({ load });
  const input = screen.getByRole("textbox", { name: "Chat name" });
  const error = await screen.findByRole("alert");
  expect(error).toHaveTextContent("This chat can’t be renamed.");
  act(() => setLanguage("ko"));
  expect(screen.getByRole("textbox", { name: "채팅 이름" })).toBe(input);
  expect(error).toHaveTextContent("This chat can’t be renamed.");
  expect(load).toHaveBeenCalledOnce();
  await h.user.click(
    screen.getByRole("button", { name: "채팅 세부 정보 다시 불러오기" }),
  );
  await waitFor(() => expect(input).toHaveValue("Restored"));
  expect(input).toHaveFocus();
  expect(load).toHaveBeenCalledTimes(2);
  expect(h.save).not.toHaveBeenCalled();
  act(() => setLanguage("en"));
  expect(screen.getByRole("textbox", { name: "Chat name" })).toBe(input);
});
