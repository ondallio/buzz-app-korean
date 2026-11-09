import { fileURLToPath } from "node:url";

/** A Tauri overlay paired with the native BUZZ_DISTRIBUTION_ID build input. */
export function koreanDesktopConfig(id, { development = false } = {}) {
  if (
    typeof id !== "string" ||
    id.length > 128 ||
    !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(
      id,
    ) ||
    /^(?:xyz\.block\.buzz|dev\.local\.buzz)(?:\.|$)/.test(id)
  )
    throw new Error("Invalid or official Buzz distribution ID");
  return {
    productName: "Buzz Korean Beta",
    identifier: `${id}${development ? ".dev" : ""}`,
    plugins: { "deep-link": { desktop: { schemes: [`buzz-${id}`] } } },
  };
}

// Print configuration only. Importing or invoking this helper never starts Tauri.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--development") || args.length > 1)
    throw new Error("Usage: korean-desktop-config.mjs [--development]");
  console.log(
    JSON.stringify(
      koreanDesktopConfig(process.env.BUZZ_DISTRIBUTION_ID, {
        development: args.includes("--development"),
      }),
    ),
  );
}
