# Validation status

This source is for review, not a released or fully validated installer.
This public projection passed pnpm check, its catalog check and a production
Vite build in a fresh public environment. pnpm check took 9.46 seconds and
covers Biome, TypeScript and design checks. Catalog validation took 1.04 seconds:
3531 English/Korean pairs, no missing/unexpected keys, variable/duplicate errors
or native resource/menu errors. Its 2069 remaining candidates are an unreviewed
inventory, not a completion measure.

The production command used Vite's build({envFile:false}) API with new empty
public configuration fixtures. Vite reported 1.40 seconds, or 1.87 seconds for
the child process. The existing greater-than-500-kB chunk warning remains.
These checks run neither the full test suite nor native Cargo/packaging.
Earlier checks below belong to their named scopes and do not establish a fresh
full run for this newer source.

## Earlier full-suite and hosted evidence

An earlier frozen source's first full Vitest run had 20357 passes, four stale
language/timezone expectations and 23 existing conditional skips. The repairs
preserved and strengthened assertions. A later mandatory pre-push run for the
previous public checkpoint had 20398 passes and 23 conditional skips, with no
failures. These are different snapshots. Neither is a full-suite pass for this
newer source; a fresh integrated run is still required.

Hosted CI for the previous public checkpoint passed all six JavaScript shards
and its protected-feature, recording, measurements and native-fixture lanes.
The overall run was not green. Rust dependency policy failed on SQLite, three
browser files failed on stale English/count/pagination expectations, and flake
selection exceeded its listing-output cap. Hosted results cannot be replaced
with local results or described as a current-source CI pass.

The included browser repairs use complete clear-search labels, exact
locale-formatted counts and the exact visual pagination target. They retain
existing keyboard/focus, raw data, geometry, row-budget and performance checks.
Their local targeted run passed 50 cases across Chromium/WebKit. Related Node
checks passed 29 cases. The flake listing has a finite 4 MiB cap only for that
process, preserves complete collection/error propagation, and has real child
output-boundary regressions. These are targeted repair results, not a rerun of
the entire hosted matrix.

## Focused implementation evidence

Independent reviews cover the integrated UI batches. The 70 status/focus cases
passed separately in Seoul and New York, with 61 related cases in a separate
run. Huddle-related integration passed 145 cases in 18 files. A later companion
close-animation regression was found and fixed; its independent two-file
18-case closure confirms language changes no longer restart the close lifecycle.
These overlapping results are not summed as unique full-suite coverage.

Four later browser journeys passed in Chromium and WebKit, eight cases with
one worker and no retries. They cover DM recipient selection and retained draft,
empty agent memory, Focus preferences/status draft and a modeled membership
invitation. Canonical recipient values and modeled invite parameters remain
unchanged. They do not create/send a DM, write memory, start Focus, save status
or prove real invite authorization. Three journeys use
the existing production-broker fixture; membership uses the existing HTTP
fixture instead. Those tests ran on an earlier source snapshot, not this
newer public projection. Browser fixtures do not establish native IME, account
storage, audio, permissions or every theme/width. The calendar comparison's
faint background was also present in its English control; its cause remains
unresolved and is not attributed to Korean text alone.

Fake/in-memory credential and temporary-lock native cases were exercised in
earlier bounded runs. The later Huddle ACL's two focused cases and locked
workspace/all-target Clippy also passed at their recorded native snapshot.
Real-account integration targets were excluded. No new Cargo/native command
was run while preparing this public projection.

## Packaging, security and remaining acceptance

A separate earlier macOS arm64 keyless candidate produced an app/archive/DMG.
Its app Rust compile took 11m 09s, excluding separate helper/frontend/packaging
work. Static inspection compared the complete 16-entry/nine-file app manifest
with its archive and recorded readonly DMG contents. Four executable headers,
Apple OS linkage, embedded public configuration and actual en/ko permission
resources were checked; original artifact/receipt hashes were independently
recomputed. The owned image was detached and its mountpoint was confirmed
empty. That candidate predates later Huddle/companion changes. It is not a
native build, runtime test or installer acceptance result for this source.

The private builder receipt remains verification:pending and signing:not-requested;
static results are separate records. No public installer or feed is supplied.
Apple signing/seal/notarization/Gatekeeper, app/helper runtime, installation,
actual native IME/permissions, restart persistence, human acceptance and a real
A-to-B update remain unverified.

Dependency policy still fails on libsqlite3-sys 0.38.2. No ignore was added.
The two-block rmcp/macro update to 3.9.0 is included. Its separate candidate
passed locked metadata and Clippy, and 52 upstream HTTP response-limit cases
passed in a disposable library fixture. Those are not complete SDK/shipping-app
integration tests. The coordinated SQLite/SDK repair remains unresolved and
blocks release acceptance.
