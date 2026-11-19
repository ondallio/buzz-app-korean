import { expect, it } from "vitest";
import { ownedSettingsLabel } from "./owned-labels";

it("localizes both bundled titles of the mobile settings card", () => {
  expect(ownedSettingsLabel("buzz.pairing/mobile", "Pair mobile", "ko")).toBe(
    "모바일 기기 연결",
  );
  expect(ownedSettingsLabel("buzz.pairing/mobile", "Mobile app", "ko")).toBe(
    "모바일 앱",
  );
  expect(ownedSettingsLabel("buzz.pairing/mobile", "Mobile app", "en")).toBe(
    "Mobile app",
  );
  expect(ownedSettingsLabel("buzz.pairing/mobile", "Phone", "ko")).toBe(
    "Phone",
  );
});
