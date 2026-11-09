# Localization scope

Localize fixed app-owned desktop text in startup, connection, onboarding,
navigation, channels, messages, threads, direct messages, search, settings,
notifications, agents, repositories, workflows and accessible administration
and experimental plugins. Include menus, tooltips, loading, errors, empty
states, confirmations, accessibility names and app-owned native copy. Separate
mobile/server localization is outside this change.

Use whole templates and named arguments. Persist the device language preference,
preserve mounted drafts/focus during switching, and format dates/numbers for
the selected language with the user's timezone and clock settings. Preserve
user content, API fields, events, saved values, permissions, authentication and
destructive-action guards.

The maintainer explicitly authorized translation wiring/display-only changes in
FOUNDATION files src/main.tsx, src/app/App.tsx, src/app/RecoveryScreen.tsx,
src/features/communities/service.ts and src/features/relay/session.ts. Other
marked contracts need separate guidance. In particular,
src/features/conversation/contracts.ts is unchanged.

Implementation owners work in disjoint files and catalogs. The coordinator owns
common registration/integration. Independent reviewers check actual source,
retained behavior and current evidence. Screen audits and remaining producer
errors are separate from registered catalog keys.

This checkpoint includes reviewed shell, message, settings, agent, workflow,
repository, relay-staff and status/focus batches. Deeper agent memory,
provider/model setup, community administration, huddle and other bundled
features remain incomplete. It is not a fully translated app.

Native IME composition/Enter/Shift+Enter, real native controls, restart
persistence, signed A-to-B updating and the maintainer's own acceptance test
remain outstanding. Keep PRs draft. Agent checks cannot attest human testing,
merge approval or release approval.
