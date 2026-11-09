# Validation status

This source is for review, not a released or fully validated installer.

This public source passed its own current pnpm check and production Vite build.
The build retains the existing large-chunk warning. Those commands do not run
the full test suite or establish native packaging.

An earlier frozen implementation, before the later staff/status/focus batches,
passed workspace/all-targets Clippy. That earlier snapshot's full Vitest run
executed 20384 cases: 20357 passed, 4 failed and 23 existing conditional cases
were skipped. The four failures were stale language or timezone expectations.
Repairs now included here preserve and strengthen assertions; the affected
59 cases passed together. The new integrated source still needs a full rerun.

Independent focused reviews cover the integrated relay-staff and status/focus
batches. The same 70 status/focus cases passed separately in Seoul and New York,
and 61 related cases passed. Overlapping focused results are not added to the
full-suite total.

Four new browser journeys ran in Chromium and WebKit, 8/8 with no page/console
errors. They cover agent detail, workflow form/scheduling, raw draft and signed
resource/mention-message preservation, and browser/native settings boundaries.
Two independent review findings were fixed and all eight reran. Narrow/enlarged
layouts were exercised only in tested states, not every screen.

139 named native unit cases passed using fake/in-memory credentials and
temporary locks. Real-account integration targets were excluded. These results
do not establish native IME, real key storage, OS permissions, packaging or
updating.

Dependency policy fails on this lockfile's libsqlite3-sys 0.38.2 and rmcp 3.8.0
advisories. No ignore was added. The targeted rmcp candidate and coordinated
SQLite/SDK repair are separate from this checkpoint. An installer cannot be
called validated while those gates remain unresolved.

No installer/feed, Apple signing/notarization, user installation or maintainer
acceptance is attested. Hosted CI and platform requirements remain authoritative;
local checks do not replace them.
