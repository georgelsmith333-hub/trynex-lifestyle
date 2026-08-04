# TryNex Lifestyle — Agent Handoff

This is the durable, shareable context for the TryNex Lifestyle project. Read it
after `AGENTS.md` and before planning or editing. Keep it updated after meaningful
work. Never put secret values in this file.

## Project identity

TryNex Lifestyle is a Bangladesh-focused print-on-demand commerce platform for
custom T-shirts, hoodies, mugs, caps, long sleeves, and water bottles. It includes
a customer storefront, browser Design Studio, admin back office, API server,
mobile app, promotional experience, and brand-system artifact.

## Read-first files

1. `AGENTS.md` — mandatory Agent operating rules
2. `AGENT_HANDOFF.md` — this durable project context
3. `replit.md` — architecture, workflows, product behavior, and gotchas
4. The relevant current source files and tests for the user's request

## Current product surfaces

- Customer storefront and admin panel: `artifacts/trynex-storefront`
- API server: `artifacts/api-server`
- Mobile app: `artifacts/trynex-mobile`
- Promo experience: `artifacts/trynex-promo`
- Brand system: `artifacts/trynex-brand-system`
- Shared API contract and generated clients: `lib/api-spec`, `lib/api-client-react`,
  and `lib/api-zod`
- Database schema and migrations: `lib/db`

## Existing work to preserve

- The storefront is the public TryNex Lifestyle commerce experience.
- The Design Studio supports precise 2D editing and realistic 3D/final rendering.
- Curved products use the 3D preview by default while flat apparel uses the 2D
  view by default.
- Product switching re-fits artwork to the target product's print zone.
- Shipping, payment, customer contact, admin settings, and other customer-facing
  values are settings-driven where documented in `replit.md` and memory.
- The API server is compiled before restart; editing API source alone does not
  hot-reload the running server.
- Existing authentication, admin session, database failover, backup, storage,
  rate limiting, and security behavior must be preserved unless the user
  explicitly requests a change.

## Working protocol for every new request

1. Read the current user request and identify the exact requested outcome.
2. Read the first-priority files listed above.
3. Inspect the relevant current implementation; do not rely only on this summary.
4. Submit a plan before editing.
5. Identify all related paths, including API/client, desktop/mobile, admin/customer,
   persisted/runtime, and old/new or before/after behavior.
6. Implement only the approved scope.
7. If independent work is parallelized, reconcile it before completion.
8. Run the relevant verification, rebuilding/restarting services when required.
9. Update this file with durable results, decisions, and remaining work.
10. Submit a completion note before closing or handing off the work.

## Current open work

No open implementation task is recorded by this handoff setup. Agents must
inspect the current project and the user's latest request rather than assuming
this section is complete or exhaustive.

## Completed handoff setup

The project now contains a mandatory Agent operating protocol in `AGENTS.md`,
with a pointer from `replit.md`. It requires first-reading the project context,
preserving existing work, planning before edits, updating related before/after
paths together, safely coordinating parallel work, verifying results, and
updating this handoff before completion.

This protocol is file-based and will be included when the project is copied or
Remixed. A Remix still starts a new private Agent conversation; the original
chat itself is not transferred. The durable context that has been written into
these project files is what the next Agent can read.

## Approved plans and decisions

The project owner has approved this handoff protocol:

- Future Agents must read the project context first.
- User instructions and newer explicit decisions remain authoritative.
- Existing work must be preserved and related before/after paths updated together.
- Plans must be submitted before implementation.
- Independent parallel work is allowed only with clear boundaries and a final
  reconciliation.
- A completion summary and updated handoff are required before closing.

## Safe next prompt template

> Read `AGENTS.md`, `AGENT_HANDOFF.md`, and `replit.md` first. Then inspect the
> current implementation related to my request. Do not rewrite working features.
> Before editing, submit a concise plan that lists affected files, preserved
> behavior, dependencies, before/after paths, verification, and any safe
> parallel work. After implementation, reconcile all changes, verify the result,
> update `AGENT_HANDOFF.md`, and provide a completion note.
