# Buzz Korean Beta source

This is an unofficial Korean/English localization of the new Buzz desktop app.
It is work in progress. No beta installer or update feed has been published
from this source.

The official baseline is block/buzz-app tag v0.7.0-preview.258.1, commit
c9239f737f4985979eb5939e84c33ab3da2b1321. Buzz 1.0 beta is the marketing name;
0.7.0 is the source version and 0.7.0-korean.1 is a planned Korean version.

Choose Settings > Appearance > Language to select 한국어 or English. The
device keeps the choice. On first use a Korean OS selects Korean, otherwise
English. Switching preserves the current draft. User content, identifiers,
commands, protocol/storage values and timezone are independent from display
translations.

The distribution ID is io.github.ondallio.buzz-korean-beta. The existing Korean
config overlays must be paired with matching native compile inputs. A plain
upstream build is not a Korean release. Do not import an existing account merely
to test this source. See PLAN.md, VALIDATION.md and GLOSSARY.md.

Activate the pinned Hermit environment and follow the contributor guide.
Use pnpm check, focused Vitest/browser tests and the production Vite build.
This source has no just ci recipe. just scan is optional, not a CI attestation.
Run node scripts/localization/check-catalogs.mjs for registered EN/KO keys,
variables and native resources. Its remaining-candidate inventory is a manual
review aid, not a completion percentage. English fallback is not completion.
