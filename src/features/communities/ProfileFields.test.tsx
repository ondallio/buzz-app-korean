// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../shared/i18n";
import type { PersonalProfile } from "./service";
import { ProfileFields, canSaveProfile } from "./ProfileFields";

afterEach(() => {
  cleanup();
  setLanguage("en");
});
it("keeps the profile draft, field nodes and selection across both languages without changing emitted data", async () => {
  setLanguage("en");
  const changed = vi.fn();
  function Form() {
    const [profile, setProfile] = useState<PersonalProfile>({
      name: "Before",
      picture: "",
      about: "Hello",
    });
    return (
      <ProfileFields
        showAvatar={false}
        profile={profile}
        onChange={(next) => {
          setProfile(next);
          changed(next);
        }}
      />
    );
  }
  const user = userEvent.setup();
  render(<Form />);
  const name = screen.getByLabelText("Display name") as HTMLInputElement;
  const about = screen.getByLabelText("Profile description (optional)");
  await user.clear(name);
  await user.type(name, "Profile");
  name.setSelectionRange(1, 4);
  act(() => setLanguage("ko"));
  expect(screen.getByLabelText("표시 이름")).toBe(name);
  expect(screen.getByLabelText("프로필 설명 (선택 사항)")).toBe(about);
  expect(name).toHaveFocus();
  expect([name.selectionStart, name.selectionEnd]).toEqual([1, 4]);
  expect(name).toHaveValue("Profile");
  expect(about).toHaveAccessibleDescription("500자 중 5자");
  act(() => setLanguage("en"));
  expect(screen.getByLabelText("Display name")).toBe(name);
  expect(changed).toHaveBeenLastCalledWith({
    name: "Profile",
    picture: "",
    about: "Hello",
  });
  expect(canSaveProfile({ name: "Profile", picture: "", about: "Hello" })).toBe(
    true,
  );
});

it.each(["checked", "cached"] as const)(
  "translates only verified-name metadata and preserves issuer, username and read-only identity (%s)",
  (status) => {
    setLanguage("en");
    render(
      <ProfileFields
        showAvatar={false}
        profile={{ name: "Before", picture: "", about: "" }}
        onChange={vi.fn()}
        verifiedName={{
          name: "Profile",
          issuerLabel: "Display name",
          username: "Original",
          status,
        }}
      />,
    );
    const name = screen.getByLabelText("Display name");
    expect(name).toHaveValue("Profile");
    expect(name).toHaveAttribute("readonly");
    act(() => setLanguage("ko"));
    expect(screen.getByLabelText("표시 이름")).toBe(name);
    expect(name).toHaveAccessibleDescription(
      status === "checked"
        ? "Display name에서 확인한 이름 · @Original"
        : "Display name의 저장된 확인 정보 · @Original",
    );
    act(() => setLanguage("en"));
    expect(screen.getByLabelText("Display name")).toBe(name);
    expect(name).toHaveAccessibleDescription(
      status === "checked"
        ? "Name verified by Display name · @Original"
        : "Cached verification from Display name · @Original",
    );
  },
);
