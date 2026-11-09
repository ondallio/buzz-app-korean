import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { validateNativeMenus } from "./native-menus.mjs";
const source = readFileSync(
  new URL("../../src-tauri/resources/localization/menus.json", import.meta.url),
  "utf8",
);

it("checks the real native catalog separately from frontend translation totals", () => {
  const report = validateNativeMenus(source);
  expect(report.keys).toBe(29);
  for (const errors of Object.values(report.errors)) expect(errors).toEqual([]);
});

it("rejects duplicate keys even when JSON.parse would silently accept them", () => {
  const changed = source.replace(
    '"File": "파일"',
    '"File": "파일", "File": "다른 값"',
  );
  expect(validateNativeMenus(changed).errors.duplicates).toEqual(["File"]);
});

it("detects missing Korean, English fallback and template drift", () => {
  const changed = JSON.parse(source);
  delete changed.ko.File;
  changed.ko.Edit = "Edit";
  changed.ko["About {app}"] = "{name} 정보";
  const report = validateNativeMenus(JSON.stringify(changed));
  expect(report.errors.missing).toEqual(["File"]);
  expect(report.errors.englishFallback).toEqual(["Edit"]);
  expect(report.errors.variables).toHaveLength(1);
});

it("matches the native owner's placeholder occurrence and brace checks", () => {
  const catalog = JSON.parse(source);
  catalog.ko["About {app}"] = "{app} {app} 정보";
  catalog.ko.File = "파일 {";
  const report = validateNativeMenus(JSON.stringify(catalog));
  expect(report.errors.variableOccurrences).toEqual(["About {app}"]);
  expect(report.errors.templateSyntax).toEqual(["File"]);
});
