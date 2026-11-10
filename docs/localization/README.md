# Buzz Korean Beta source

This is an unofficial Korean/English localization of the new Buzz desktop app.
It is incomplete reviewable source. No beta installer or update feed has been
published from this source.

The official baseline is block/buzz-app tag v0.7.0-preview.260.1, commit
58116b826171d190a7376fc57b0509c32c507dde. Buzz 1.0 beta is the marketing name;
0.7.0 is the upstream source version. The configured Korean candidate version
is 0.7.0-korean.1, not a released installer.

Choose Settings > Appearance > Language to select 한국어 or English. The device
keeps the choice. On first use a Korean OS selects Korean, otherwise English.
Switching preserves the current draft. User content, identifiers, commands,
protocol/storage values and timezone remain independent of display translations.

The distribution ID is io.github.ondallio.buzz-korean-beta. Korean native overlays
must be paired with their matching compile inputs. A plain upstream developer
build is not the Korean distribution. Existing account namespaces are not
silently imported. See [PLAN.md](PLAN.md), [VALIDATION.md](VALIDATION.md) and
[GLOSSARY.md](GLOSSARY.md) for scope, evidence and remaining work.

For source development, activate the pinned Hermit environment and follow the
[contributor guide](../contributing.md). Use pnpm check, focused Vitest/browser
checks and a production Vite build. There is no just ci recipe; just scan is
optional and is not a CI attestation. The catalog check is:

```sh
. ./bin/activate-hermit
bin/node scripts/localization/check-catalogs.mjs
```

Its remaining-candidate inventory is a manual review aid, not a completion
percentage. Registered keys and English fallback do not establish a fully
translated screen.

The source also includes a macOS arm64 keyless candidate builder. In a clean
checkout without environment files, after installing the documented platform
prerequisites, its entry point is:

```sh
bin/node scripts/beta/build.mjs --commit "$(git rev-parse HEAD)"
```

It produces local app/DMG candidates without signing or publishing. It does not
launch the app, install it, verify an updater chain or make it release-ready.
An earlier candidate was built and statically inspected; that was not a native
build of this newer source. Dependency, runtime and human acceptance gates in
VALIDATION.md remain open. Do not import an existing account merely to test
unfinished source. Any later installer/feed requires separate approval.
