import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseSync, transformSync } from "rolldown/utils";
import { validateNativeMenus } from "./native-menus.mjs";
import { validateNativeResources } from "./native-resources.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const catalogDirectory = path.join(root, "src/shared/i18n/catalogs");
async function loadPureTypescript(file) {
  const source = await fs.readFile(file, "utf8");
  const result = transformSync(file, source);
  if (result.errors.length) throw new Error(JSON.stringify(result.errors));
  return import(
    `data:text/javascript;base64,${Buffer.from(result.code).toString("base64")}`
  );
}
const { validateCatalogs } = await loadPureTypescript(
  path.join(root, "src/shared/i18n/messages.ts"),
);
const english = {};
const korean = {};
const duplicates = [];
for (const name of (await fs.readdir(catalogDirectory))
  .filter((name) => name.endsWith(".ts"))
  .sort()) {
  const { en, ko } = await loadPureTypescript(
    path.join(catalogDirectory, name),
  );
  for (const key of Object.keys(en)) {
    if (Object.hasOwn(english, key)) duplicates.push(key);
  }
  Object.assign(english, en);
  Object.assign(korean, ko);
}
const validation = { ...validateCatalogs(english, korean), duplicates };
const [info, permissionEnglish, permissionKorean, tauriConfig] =
  await Promise.all([
    fs.readFile(path.join(root, "src-tauri/Info.plist"), "utf8"),
    fs.readFile(
      path.join(root, "src-tauri/resources/en.lproj/InfoPlist.strings"),
      "utf8",
    ),
    fs.readFile(
      path.join(root, "src-tauri/resources/ko.lproj/InfoPlist.strings"),
      "utf8",
    ),
    fs.readFile(path.join(root, "src-tauri/tauri.conf.json"), "utf8"),
  ]);
const nativeResources = validateNativeResources(
  info,
  permissionEnglish,
  permissionKorean,
  JSON.parse(tauriConfig),
);

const nativeMenus = validateNativeMenus(
  await fs.readFile(
    path.join(root, "src-tauri/resources/localization/menus.json"),
    "utf8",
  ),
);

const attributes = new Set([
  "title",
  "label",
  "description",
  "subtitle",
  "placeholder",
  "alt",
  "aria-label",
  "closeLabel",
  "emptyMessage",
]);
const candidates = [];
async function walk(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (file === catalogDirectory || entry.name === "__snapshots__") continue;
      await walk(file);
      continue;
    }
    if (!/\.tsx?$/.test(file) || /\.(test|spec|d)\.tsx?$/.test(file)) continue;
    const source = await fs.readFile(file, "utf8");
    const parsed = parseSync(file, source);
    if (parsed.errors.length)
      throw new Error(JSON.stringify({ file, errors: parsed.errors }));
    const ast = parsed.program;
    const record = (node, kind, text) => {
      const normalized = text.replace(/\s+/g, " ").trim();
      if (!/[A-Za-z]{2}/.test(normalized)) return;
      candidates.push({
        file: path.relative(root, file),
        line: source.slice(0, node.start).split("\n").length,
        kind,
        text: normalized,
      });
    };
    const visit = (node) => {
      if (node.type === "JSXText") record(node, "jsx-text", node.value);
      if (
        node.type === "JSXAttribute" &&
        attributes.has(node.name.name) &&
        typeof node.value?.value === "string"
      )
        record(node, "jsx-attribute", node.value.value);
      if (
        node.type === "Property" &&
        attributes.has(node.key.name ?? node.key.value) &&
        typeof node.value?.value === "string"
      )
        record(node, "display-property-review", node.value.value);
      for (const child of Object.values(node)) {
        if (Array.isArray(child)) {
          for (const item of child) if (item?.type) visit(item);
        } else if (child?.type) visit(child);
      }
    };
    visit(ast);
  }
}
await walk(path.join(root, "src"));
const report = {
  source: "block/buzz-app@c9239f737f4985979eb5939e84c33ab3da2b1321",
  catalogKeys: Object.keys(english).length,
  koreanEntries: Object.keys(english).filter((key) => korean[key]?.trim())
    .length,
  validation,
  nativeResources,
  nativeMenus,
  limitation:
    "Candidate inventory is a lower bound for manual review. It includes product names, developer diagnostics and specimens; it misses computed labels, native strings and runtime server errors. It is not a translation completion percentage.",
  remainingCandidates: candidates,
};
if (process.argv.includes("--write")) {
  const destination = path.join(
    root,
    "docs/localization/coverage-current.json",
  );
  const formatted = execFileSync(
    process.execPath,
    [
      path.join(root, "node_modules/@biomejs/biome/bin/biome"),
      "format",
      "--stdin-file-path",
      destination,
    ],
    {
      input: JSON.stringify(report),
      encoding: "utf8",
      cwd: root,
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  await fs.writeFile(destination, formatted);
}
console.log(
  JSON.stringify({
    catalogKeys: report.catalogKeys,
    koreanEntries: report.koreanEntries,
    validation,
    nativeResources,
    nativeMenus,
    candidatesToReview: candidates.length,
  }),
);
if (Object.values(validation).some((items) => items.length))
  process.exitCode = 1;
if (Object.values(nativeResources.errors).some((items) => items.length))
  process.exitCode = 1;

if (Object.values(nativeMenus.errors).some((items) => items.length))
  process.exitCode = 1;
