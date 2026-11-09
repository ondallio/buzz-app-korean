import { validateCatalogs } from "../../src/shared/i18n/messages.ts";

function parseStrings(source) {
  const entries = {};
  const lines = source.replace(/\/\*[\s\S]*?\*\//g, "").split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const match =
      /^\s*"([A-Za-z0-9_]+)"\s*=\s*("(?:[^"\\]|\\.)*")\s*;\s*$/.exec(line);
    if (!match) throw new Error("Unsupported InfoPlist.strings syntax");
    if (Object.hasOwn(entries, match[1]))
      throw new Error(`Duplicate native resource: ${match[1]}`);
    entries[match[1]] = JSON.parse(match[2]);
  }
  return entries;
}

/** Checks actual permission descriptions and the bundler destinations, not key presence alone. */
export function validateNativeResources(
  info,
  englishSource,
  koreanSource,
  config,
) {
  const source = {};
  for (const match of info.matchAll(
    /<key>(NS[A-Za-z]+UsageDescription)<\/key>\s*<string>([^<]*)<\/string>/g,
  ))
    source[match[1]] = match[2].replace(
      /&(amp|lt|gt|quot|apos);/g,
      (_, name) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[name],
    );
  const keys = [
    ...info.matchAll(/<key>(NS[A-Za-z]+UsageDescription)<\/key>/g),
  ].map((match) => match[1]);
  if (keys.length !== Object.keys(source).length || keys.length === 0)
    throw new Error("Unsupported or missing native permission descriptions");
  const en = parseStrings(englishSource);
  const ko = parseStrings(koreanSource);
  const sourceCheck = validateCatalogs(source, en);
  const koreanCheck = validateCatalogs(source, ko);
  return {
    keys,
    errors: {
      englishKeys: [...sourceCheck.missing, ...sourceCheck.unexpected],
      sourceMismatch: keys.filter((key) => en[key] !== source[key]),
      koreanKeys: [...koreanCheck.missing, ...koreanCheck.unexpected],
      variables: koreanCheck.variables,
      englishFallback: keys.filter((key) => ko[key] === en[key]),
      destinations: ["en", "ko"].filter(
        (language) =>
          config.bundle?.resources?.[`resources/${language}.lproj/`] !==
          `${language}.lproj/`,
      ),
      languages:
        /<key>CFBundleLocalizations<\/key>\s*<array>\s*<string>en<\/string>\s*<string>ko<\/string>\s*<\/array>/.test(
          info,
        )
          ? []
          : ["CFBundleLocalizations"],
    },
  };
}
