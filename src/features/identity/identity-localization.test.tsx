// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import { afterEach, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { setLanguage } from "../../shared/i18n";
import { createIdentity } from "./service";
import { PublicKeyPanel } from "./PublicKeyPanel";
import { SetupProgress } from "./SetupProgress";
import { Welcome } from "./Welcome";
import { useLegacyIdentityOffer } from "./LegacyIdentityOffer";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  isTauri: vi.fn(() => false),
  Channel: class {},
}));
const identities: ReturnType<typeof createIdentity>[] = [];
function identity() {
  const result = createIdentity();
  identities.push(result);
  return result;
}
const communities: ComponentProps<typeof Welcome>["communities"] = {
  snapshot: () => {
    throw new Error("Unexpected community read");
  },
  subscribe: () => {
    throw new Error("Unexpected community subscription");
  },
  joined: () => {
    throw new Error("Unexpected join");
  },
  select: () => {
    throw new Error("Unexpected selection");
  },
};
afterEach(() => {
  cleanup();
  for (const item of identities.splice(0)) item.dispose();
  vi.restoreAllMocks();
  vi.resetAllMocks();
  localStorage.clear();
});

it("changes the actual welcome screen language without replacing the community draft or focus", async () => {
  setLanguage("en");
  vi.mocked(invoke).mockResolvedValue(null);
  render(
    <Welcome
      identity={identity()}
      communities={communities}
      invites={{ open: vi.fn() }}
    >
      <p>App content</p>
    </Welcome>,
  );
  const options = await screen.findByRole("button", { name: "Other options" });
  act(() => setLanguage("ko"));
  expect(screen.getByRole("button", { name: "다른 방법" })).toBe(options);
  fireEvent.click(options);
  expect(screen.getByRole("heading", { name: "커뮤니티 참여" })).toBeVisible();
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "사용자.example" } });
  input.focus();
  act(() => setLanguage("en"));
  expect(
    screen.getByRole("heading", { name: "Join a community" }),
  ).toBeVisible();
  expect(screen.getByRole("textbox")).toBe(input);
  expect(input).toHaveValue("사용자.example");
  expect(input).toHaveFocus();
  act(() => setLanguage("ko"));
  expect(screen.getByRole("textbox")).toBe(input);
  expect(input).toHaveValue("사용자.example");
  act(() => setLanguage("en"));
  expect(screen.getByRole("textbox")).toBe(input);
  expect(input).toHaveFocus();
});

it.each([false, true])(
  "retranslates retained clipboard feedback without changing the public key (failure=%s)",
  async (fails) => {
    setLanguage("en");
    const user = userEvent.setup();
    const write = vi.spyOn(navigator.clipboard, "writeText");
    if (fails) write.mockRejectedValue(new Error("host detail"));
    else write.mockResolvedValue();
    const npub = `npub1${"q".repeat(58)}`;
    render(<PublicKeyPanel publicKey={npub} />);
    const button = screen.getByRole("button", { name: "Copy npub" });
    const key = screen.getByText(npub);
    await user.click(button);
    expect(screen.getByRole("status")).toHaveTextContent(
      fails
        ? "Could not copy. Select the key above to copy it."
        : "Public key copied.",
    );
    act(() => setLanguage("ko"));
    expect(
      screen.getByRole("heading", { name: "내 공개 키(npub)" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "npub 복사" })).toBe(button);
    expect(screen.getByRole("status")).toHaveTextContent(
      fails
        ? "복사하지 못했습니다. 위의 키를 선택해서 복사해 주세요."
        : "공개 키를 복사했습니다.",
    );
    expect(screen.getByText(npub)).toBe(key);
    expect(write).toHaveBeenCalledWith(npub);
    act(() => setLanguage("en"));
    expect(screen.getByRole("button", { name: "Copy npub" })).toBe(button);
    expect(screen.getByRole("status")).toHaveTextContent(
      fails ? "Could not copy." : "Public key copied.",
    );
  },
);

it("preserves provided public-key headings and progress labels even when they resemble English copy", () => {
  setLanguage("ko");
  render(
    <>
      <PublicKeyPanel
        publicKey="npub-fixture"
        heading="Your public key (npub)"
      />
      <SetupProgress label="Opening Buzz…" />
    </>,
  );
  expect(
    screen.getByRole("heading", { name: "Your public key (npub)" }),
  ).toBeVisible();
  expect(screen.getByRole("heading", { name: "준비 중" })).toBeVisible();
  expect(screen.getAllByRole("status").at(-1)).toHaveTextContent(
    "Opening Buzz…",
  );
});

it("keeps an existing legacy offer mounted across language changes without probing again", async () => {
  setLanguage("en");
  vi.mocked(invoke).mockImplementation((command) =>
    Promise.resolve(command === "identity_legacy_available" ? true : null),
  );
  const service = identity();
  function Offer() {
    return useLegacyIdentityOffer(service, true);
  }
  render(<Offer />);
  const dialog = await screen.findByRole("alertdialog", {
    name: "Continue with your Buzz identity?",
  });
  const proceed = screen.getByRole("button", { name: "Continue" });
  act(() => setLanguage("ko"));
  expect(
    screen.getByRole("alertdialog", { name: "기존 Buzz 신원으로 계속할까요?" }),
  ).toBe(dialog);
  expect(screen.getByRole("button", { name: "계속" })).toBe(proceed);
  act(() => setLanguage("en"));
  expect(screen.getByRole("button", { name: "Continue" })).toBe(proceed);
  expect(
    vi
      .mocked(invoke)
      .mock.calls.filter(
        ([command]) => command === "identity_legacy_available",
      ),
  ).toEqual([["identity_legacy_available"]]);
});

it("changes the real loading heading and preserves a native diagnostic verbatim", async () => {
  setLanguage("en");
  let reject!: (reason: string) => void;
  const restored = new Promise<null>((_, fail) => {
    reject = fail;
  });
  vi.mocked(invoke).mockReturnValue(restored);
  render(
    <Welcome
      identity={identity()}
      communities={communities}
      invites={{ open: vi.fn() }}
    >
      <p>App content</p>
    </Welcome>,
  );
  const heading = screen.getByRole("heading", { name: "Your Buzz identity" });
  act(() => setLanguage("ko"));
  expect(screen.getByRole("heading", { name: "내 Buzz 신원" })).toBe(heading);
  expect(screen.getByRole("status")).toHaveTextContent(
    "저장된 신원을 열고 있습니다…",
  );
  await act(async () => reject("Your public key (npub)"));
  expect(screen.getByRole("alert")).toHaveTextContent("Your public key (npub)");
  const retry = screen.getByRole("button", {
    name: "보안 저장소 접근 다시 시도",
  });
  act(() => setLanguage("en"));
  expect(
    screen.getByRole("button", { name: "Retry secure storage access" }),
  ).toBe(retry);
  expect(screen.getByRole("alert")).toHaveTextContent("Your public key (npub)");
});
