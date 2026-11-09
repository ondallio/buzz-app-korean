// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n";
import type { Identity } from "./service";
import { SignOutDialog, WIPE_PHRASE } from "./SignOut";
afterEach(() => {
  cleanup();
  setLanguage("en");
});
it("keeps the exact wipe phrase, revealed fixture and controls through locale changes and signs out only on explicit confirmation", async () => {
  setLanguage("en");
  const identity = {
    wipeRefusal: vi.fn(async () => null),
    exportKey: vi.fn(async () => "nsec-public-test-fixture"),
    signOut: vi.fn().mockRejectedValueOnce({ message: "Native denied" }),
  } as unknown as Identity;
  const user = userEvent.setup();
  render(<SignOutDialog identity={identity} onClose={vi.fn()} />);
  await waitFor(() =>
    expect(identity.wipeRefusal).toHaveBeenCalledExactlyOnceWith(),
  );
  await user.click(screen.getByRole("button", { name: "Reveal private key" }));
  await user.click(screen.getByRole("checkbox", { name: "I have my key" }));
  await user.click(
    screen.getByRole("checkbox", {
      name: "Also erase everything else Buzz stores on this device",
    }),
  );
  await user.click(
    screen.getByRole("checkbox", { name: "Also remove my agents" }),
  );
  const phrase = screen.getByLabelText(
    `Type “${WIPE_PHRASE}” to confirm`,
  ) as HTMLInputElement;
  await user.type(phrase, WIPE_PHRASE);
  phrase.setSelectionRange(1, 5);
  const dialog = screen.getByRole("alertdialog", { name: "Sign out of Buzz?" });
  const confirm = screen.getByRole("button", { name: "Sign out and erase" });
  expect(confirm).toBeEnabled();
  act(() => setLanguage("ko"));
  expect(
    screen.getByRole("alertdialog", { name: "Buzz에서 로그아웃할까요?" }),
  ).toBe(dialog);
  expect(
    screen.getByLabelText(`확인하려면 “${WIPE_PHRASE}”을 입력하세요`),
  ).toBe(phrase);
  expect(phrase).toHaveFocus();
  expect([phrase.selectionStart, phrase.selectionEnd]).toEqual([1, 5]);
  expect(phrase).toHaveValue("erase all my data");
  expect(identity.signOut).not.toHaveBeenCalled();
  act(() => setLanguage("en"));
  expect(screen.getByRole("button", { name: "Sign out and erase" })).toBe(
    confirm,
  );
  await user.click(confirm);
  expect(await screen.findByRole("alert")).toHaveTextContent("Native denied");
  expect(identity.signOut).toHaveBeenCalledExactlyOnceWith({
    wipe: true,
    removeAgents: true,
  });
  expect(identity.exportKey).toHaveBeenCalledExactlyOnceWith();
});
