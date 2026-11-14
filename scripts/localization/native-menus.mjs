import { parseSync } from "rolldown/utils";
import { validateCatalogs } from "../../src/shared/i18n/messages.ts";

/** Validates the same JSON embedded in the native caption owner, including duplicate keys. */
export function validateNativeMenus(source) {
  const catalog = JSON.parse(source);
  const parsed = parseSync("native-menus.js", `(${source})`);
  if (parsed.errors.length) throw new Error("Invalid native menu catalog");
  const duplicates = [];
  const visit = (node) => {
    if (node.type === "ObjectExpression") {
      const keys = new Set();
      for (const property of node.properties) {
        const key = property.key.value;
        if (keys.has(key)) duplicates.push(key);
        keys.add(key);
      }
    }
    for (const child of Object.values(node)) {
      if (Array.isArray(child)) {
        for (const item of child) if (item?.type) visit(item);
      } else if (child?.type) visit(child);
    }
  };
  visit(parsed.program);
  if (
    !catalog.en ||
    !catalog.ko ||
    Object.keys(catalog).sort().join() !== "en,ko"
  )
    throw new Error("Expected native menu en/ko catalogs");
  return {
    keys: Object.keys(catalog.en).length,
    errors: {
      ...validateCatalogs(catalog.en, catalog.ko),
      duplicates,
      variableOccurrences: Object.keys(catalog.en).filter(
        (key) =>
          typeof catalog.ko[key] === "string" &&
          catalog.en[key].split("{app}").length !==
            catalog.ko[key].split("{app}").length,
      ),
      templateSyntax: Object.keys(catalog.en).filter((key) =>
        [catalog.en[key], catalog.ko[key]].some(
          (value) =>
            typeof value === "string" &&
            /[{}]/.test(value.replaceAll("{app}", "")),
        ),
      ),
      sourceMismatch: Object.keys(catalog.en).filter(
        (key) => catalog.en[key] !== key,
      ),
      englishFallback: Object.keys(catalog.en).filter(
        (key) => catalog.ko[key] === catalog.en[key],
      ),
    },
  };
}
