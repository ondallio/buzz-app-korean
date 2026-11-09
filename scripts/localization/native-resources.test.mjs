import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { validateNativeResources } from "./native-resources.mjs";

const file = (path) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const info = file("src-tauri/Info.plist");
const en = file("src-tauri/resources/en.lproj/InfoPlist.strings");
const ko = file("src-tauri/resources/ko.lproj/InfoPlist.strings");
const config = JSON.parse(file("src-tauri/tauri.conf.json"));

it("checks the real English/Korean permission resources and bundle destinations", () => {
  const report = validateNativeResources(info, en, ko, config);
  expect(report.keys).toEqual(["NSMicrophoneUsageDescription"]);
  for (const failures of Object.values(report.errors))
    expect(failures).toEqual([]);
});

it("fails if Korean becomes English fallback or a required localization is not bundled", () => {
  expect(
    validateNativeResources(info, en, en, config).errors.englishFallback,
  ).toEqual(["NSMicrophoneUsageDescription"]);
  const modified = structuredClone(config);
  delete modified.bundle.resources["resources/ko.lproj/"];
  expect(
    validateNativeResources(info, en, ko, modified).errors.destinations,
  ).toEqual(["ko"]);
});

it("requires new source permission descriptions to be localized rather than silently ignored", () => {
  const changed = info.replace(
    "</dict>",
    "<key>NSCameraUsageDescription</key><string>Fixture camera request.</string></dict>",
  );
  const report = validateNativeResources(changed, en, ko, config);
  expect(report.errors.englishKeys).toContain("NSCameraUsageDescription");
  expect(report.errors.koreanKeys).toContain("NSCameraUsageDescription");
});
