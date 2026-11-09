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
import type { KeyState } from "./key";
import { TypeSafeSettings } from "./TypeSafeSettings";

beforeEach(() => setLanguage("en"));
afterEach(() => {
  cleanup();
  setLanguage("en");
});

/** The key as the form uses it, with a store that can fail. */
function fake(desktop = true, keyState: KeyState = "missing") {
  const listeners = new Set<() => void>();
  const set = (next: KeyState) => {
    keyState = next;
    for (const listener of listeners) listener();
  };
  return {
    snapshot: () => keyState,
    desktop: () => desktop,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    save: vi.fn(async (_key: string) => set("saved")),
    clear: vi.fn(async () => set("missing")),
  };
}

it("changes language without saving or changing the same password draft and selection", async () => {
  const typesafe = fake();
  render(<TypeSafeSettings typesafe={typesafe} active={() => true} />);
  const input = screen.getByLabelText("TypeSafe API key") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "  fixture-{key}-한글  " } });
  input.focus();
  input.setSelectionRange(2, 7);
  act(() => setLanguage("ko"));
  expect(screen.getByLabelText("TypeSafe API 키")).toBe(input);
  expect(input).toHaveAttribute("type", "password");
  expect(input).toHaveValue("  fixture-{key}-한글  ");
  expect(input).toHaveFocus();
  expect(input.selectionStart).toBe(2);
  expect(input.selectionEnd).toBe(7);
  expect(screen.getByRole("button", { name: "키 저장" })).toBeEnabled();
  expect(typesafe.save).not.toHaveBeenCalled();
  expect(typesafe.clear).not.toHaveBeenCalled();
  act(() => setLanguage("en"));
  expect(screen.getByLabelText("TypeSafe API key")).toBe(input);
  expect(input).toHaveFocus();
  expect(input.selectionStart).toBe(2);
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Save key" }));
  await waitFor(() => expect(input).toHaveValue(""));
  expect(typesafe.save).toHaveBeenCalledExactlyOnceWith("fixture-{key}-한글");
  expect(typesafe.clear).not.toHaveBeenCalled();
});

it.each([
  ["checking", "저장된 키를 확인하고 있습니다…"],
  ["saved", "TypeSafe 키가 저장되어 있습니다."],
  ["missing", "TypeSafe를 사용하려면 TypeSafe API 키를 추가하세요."],
  ["unreadable", "Buzz에서 저장된 키를 읽을 수 없습니다."],
  ["refused", "TypeSafe에서 키를 거부했습니다."],
] as const)(
  "translates the finite %s state without changing or reading credential data",
  (state, korean) => {
    const typesafe = fake(true, state);
    render(
      <TypeSafeSettings
        typesafe={typesafe}
        active={() => true}
        apple={false}
      />,
    );
    const status = screen.getByRole("status");
    const english = status.textContent;
    act(() => setLanguage("ko"));
    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveTextContent(korean);
    expect(
      screen.getByText(/다른 프로그램도 저장된 키를 읽을 수 있습니다/),
    ).toBeInTheDocument();
    act(() => setLanguage("en"));
    expect(status.textContent).toBe(english);
    expect(typesafe.snapshot()).toBe(state);
    expect(typesafe.save).not.toHaveBeenCalled();
    expect(typesafe.clear).not.toHaveBeenCalled();
  },
);

it("keeps a deferred save busy and an opaque same-English failure raw across languages", async () => {
  const typesafe = fake(true, "saved");
  let reject: (error: Error) => void = () => {
    throw new Error("Save did not start");
  };
  typesafe.save.mockImplementationOnce(
    () =>
      new Promise<void>((_resolve, fail) => {
        reject = fail;
      }),
  );
  render(<TypeSafeSettings typesafe={typesafe} active={() => true} />);
  const input = screen.getByLabelText("TypeSafe API key");
  fireEvent.change(input, { target: { value: "fixture-only" } });
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Replace key" }));
  await waitFor(() => expect(typesafe.save).toHaveBeenCalledOnce());
  try {
    act(() => setLanguage("ko"));
    expect(screen.getByLabelText("TypeSafe API 키")).toBe(input);
    expect(input).toBeDisabled();
    expect(input).toHaveValue("fixture-only");
    expect(screen.getByRole("button", { name: "키 교체" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "키 제거" })).toBeDisabled();
  } finally {
    await act(async () =>
      reject(
        new Error(
          "TypeSafe did not accept your key. Replace it to keep using TypeSafe.",
        ),
      ),
    );
  }
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent(
    "TypeSafe did not accept your key. Replace it to keep using TypeSafe.",
  );
  expect(input).toBeEnabled();
  act(() => setLanguage("en"));
  expect(screen.getByRole("alert")).toBe(alert);
  act(() => setLanguage("ko"));
  expect(screen.getByRole("alert")).toBe(alert);
  expect(alert).toHaveTextContent(
    "TypeSafe did not accept your key. Replace it to keep using TypeSafe.",
  );
  expect(typesafe.save).toHaveBeenCalledExactlyOnceWith("fixture-only");
  expect(typesafe.clear).not.toHaveBeenCalled();
});

it("localizes the desktop-only fallback without creating a password field", () => {
  render(<TypeSafeSettings typesafe={fake(false)} active={() => true} />);
  act(() => setLanguage("ko"));
  expect(screen.getByRole("status")).toHaveTextContent(
    "TypeSafe를 사용하려면 Buzz 데스크톱 앱을 여세요.",
  );
  expect(screen.queryByLabelText("TypeSafe API 키")).not.toBeInTheDocument();
});

it("asks for the TypeSafe key", () => {
  render(<TypeSafeSettings typesafe={fake()} active={() => true} />);
  expect(screen.getByLabelText("TypeSafe API key")).toBeInTheDocument();
});

it("asks for the desktop app in the browser", () => {
  render(<TypeSafeSettings typesafe={fake(false)} active={() => true} />);
  expect(screen.getByRole("status")).toHaveTextContent("desktop app");
  expect(screen.queryByLabelText("TypeSafe API key")).not.toBeInTheDocument();
});

it("saves a key without showing it again, and removes it", async () => {
  const user = userEvent.setup();
  const typesafe = fake();
  render(<TypeSafeSettings typesafe={typesafe} active={() => true} />);
  expect(screen.getByRole("status")).toHaveTextContent(
    "Add your TypeSafe API key",
  );
  const input = screen.getByLabelText("TypeSafe API key");
  expect(input).toHaveAttribute("type", "password");
  expect(screen.getByRole("button", { name: "Save key" })).toBeDisabled();
  await user.type(input, "  tk-secret  ");
  await user.click(screen.getByRole("button", { name: "Save key" }));
  expect(typesafe.save).toHaveBeenCalledWith("tk-secret");
  expect(input).toHaveValue("");
  expect(screen.getByRole("status")).toHaveTextContent(
    "Your TypeSafe key is saved",
  );
  await user.click(screen.getByRole("button", { name: "Remove key" }));
  expect(typesafe.clear).toHaveBeenCalledOnce();
  expect(screen.getByRole("status")).toHaveTextContent(
    "Add your TypeSafe API key",
  );
});

it("keeps the typed key and shows why a save failed", async () => {
  const user = userEvent.setup();
  const typesafe = fake();
  typesafe.save.mockRejectedValueOnce(
    new Error("That does not look like a TypeSafe API key"),
  );
  render(<TypeSafeSettings typesafe={typesafe} active={() => true} />);
  await user.type(screen.getByLabelText("TypeSafe API key"), "bad key");
  await user.click(screen.getByRole("button", { name: "Save key" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "does not look like",
  );
  expect(screen.getByLabelText("TypeSafe API key")).toHaveValue("bad key");
});

it("does not call a key missing until its status is read, or when it cannot be", async () => {
  const user = userEvent.setup();
  const { rerender } = render(
    <TypeSafeSettings typesafe={fake(true, "checking")} active={() => true} />,
  );
  expect(screen.getByRole("status")).toHaveTextContent("Checking");
  expect(screen.queryByRole("button", { name: "Remove key" })).toBeNull();
  const unreadable = fake(true, "unreadable");
  rerender(<TypeSafeSettings typesafe={unreadable} active={() => true} />);
  expect(screen.getByRole("status")).toHaveTextContent("could not read");
  expect(screen.getByRole("button", { name: "Replace key" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Remove key" }));
  expect(unreadable.clear).toHaveBeenCalledOnce();
  rerender(
    <TypeSafeSettings typesafe={fake(true, "refused")} active={() => true} />,
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "TypeSafe did not accept your key",
  );
  expect(screen.getByRole("button", { name: "Replace key" })).toBeVisible();
});

it("warns that other programs can read the key only off Apple platforms", () => {
  const text = /Other programs you run, agent shells included, can read/;
  const { unmount } = render(
    <TypeSafeSettings typesafe={fake()} active={() => true} apple={false} />,
  );
  expect(screen.getByText(text)).toBeVisible();
  unmount();
  render(<TypeSafeSettings typesafe={fake()} active={() => true} apple />);
  expect(screen.queryByText(text)).not.toBeInTheDocument();
});
