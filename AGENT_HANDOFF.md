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
4. In the first response, confirm the three required files were read and clearly
   report completed work, the previous stopping point, remaining work, blockers,
   the proposed plan, preserved behavior, verification, and safe parallel work.
5. Submit a plan before editing.
6. Identify all related paths, including API/client, desktop/mobile, admin/customer,
   persisted/runtime, and old/new or before/after behavior.
7. Implement only the approved scope.
8. If independent work is parallelized, reconcile it before completion.
9. Run the relevant verification, rebuilding/restarting services when required.
10. Update this file with durable results, decisions, and remaining work.
11. Submit a completion note before closing or a status handoff when pausing,
    blocking, or transferring the work.

## Current open work

The TryNex Design Studio audit is in progress. The public `/design-studio` route
is V1; `/design-studio-v1` is its compatibility alias and `/design-studio-v2`
remains an explicit comparison/rollback route. The source-kit/runtime mockup
audit now validates the editable manifest as well as public assets.

## Required status at every handoff

Every Agent must keep the following status fields current before ending a chat,
pausing work, or transferring the project:

```text
Status: in progress
Last completed: Wired the existing V1 first-use guide and print-quality status components into the public Design Studio, added actionable low-resolution image warnings, and corrected the mockup audit to validate all 108 manifest documents against both editable source-kit and flattened runtime roots
Stopped at: Live storefront verification after restarting the storefront workflow
Files/areas changed: `artifacts/trynex-storefront/src/pages/DesignStudio.tsx`, `scripts/audit_trynex_mockups.py`, and this handoff; unrelated pre-existing API/mobile/promo/brand-system changes were preserved
Remaining work: Browser-level interaction and responsive verification across all six product categories, colors, editor tools, save/restore, export, add-to-cart, cart/checkout/admin previews, and the editable PSD visual review
Blocker: The artifact registry returns no registered artifacts, so the screenshot helper cannot resolve `trynex-storefront`; the browser-use executable is also unavailable in the shell. Direct HTTPS preview checks are available and pass.
Next safe action: Repair or reconcile the existing storefront artifact registration without creating a duplicate app, then run the six-product responsive browser matrix; if registry repair is unavailable, use an approved browser/preview path or document the manual test gap
Verification: Storefront typecheck passed; production build passed; `scripts/audit_trynex_mockups.py --json /tmp/trynex-mockups-audit.json` passed with 108 pairs, 108 manifest documents, and 0 errors; storefront workflow restarted cleanly; live routes and representative mockup assets returned HTTP 200

## Latest audit checkpoint

- Confirmed strengths: settings-driven commerce, multi-surface product catalog,
  high-fidelity photo mockups, 2D/3D Design Studio, draft autosave, product
  switching with print-zone refit, API caching/rate limits/CSRF protection,
  dynamic sitemap, and mobile loading/error states.
- Highest-priority findings: icon-only navigation controls need accessible names;
  mobile sticky actions need a shared stacking context; image dimensions need
  reserved layout space; 25% advance payment needs to be visible beside buying
  actions; the Design Studio needs a clearer guided workflow and quality gate;
  mobile checkout keyboard handling needs verification; production security
  must never expose development reset/bypass behavior.
- Visual direction recommended for approval: a premium "Dhaka Color Spectrum"
  system—warm white and ink foundations with controlled orange, indigo, teal,
  Bangladesh green, and violet accents—using multicolor for product/category
  meaning and moments of delight, not as uncontrolled decoration.
- Audit evidence: `audit/live-trynexshop-home.png`,
  `audit/live-trynexshop-products.png`, and
  `audit/live-trynexshop-design-studio.png`.
```

For future implementation work, replace these values with the real current
checkpoint. Do not leave the next Agent to reconstruct the state from chat
history.

## Completed handoff setup

The project now contains a mandatory Agent operating protocol in `AGENTS.md`,
with a pointer from `replit.md`. It requires first-reading the project context,
preserving existing work, planning before edits, updating related before/after
paths together, safely coordinating parallel work, verifying results, and
updating this handoff before completion.

The strong startup command is now prominently included in `AGENTS.md`,
`AGENT_HANDOFF.md`, and `replit.md`. Replit Agent automatically reads
`replit.md`, so the command is available in the original project and in
copies/Remixes that include the project README.

This protocol is file-based and will be included when the project is copied or
Remixed. A Remix still starts a new private Agent conversation; the original
chat itself is not transferred. The durable context that has been written into
these project files is what the next Agent can read.

## Approved plans and decisions

The project owner has approved this handoff protocol:

- Future Agents must read the project context first.
- The exact default instruction must be treated as the first operating request
  in every new or Remixed Agent chat.
- Every new chat must clearly report where work was left off and what remains
  before proposing or starting implementation.
- User instructions and newer explicit decisions remain authoritative.
- Existing work must be preserved and related before/after paths updated together.
- Plans must be submitted before implementation.
- Independent parallel work is allowed only with clear boundaries and a final
  reconciliation.
- A completion or pause/blocked handoff summary and updated handoff are required
  before closing.

## Best startup command for the next Agent

> **START HERE — do not edit anything yet.** Read `AGENTS.md`,
> `AGENT_HANDOFF.md`, and `replit.md` first. Then inspect the current project
> state and respond with these headings: **Completed**, **Last stopping point**,
> **Remaining work**, **Blockers**, **Plan**, **Existing behavior to preserve**,
> **Verification**, and **Safe parallel work**. Submit the plan before editing.
> Preserve all working features, update related before/after paths together,
> keep the handoff current while working, reconcile and verify parallel work,
> and finish with the exact **Status**, **Last completed**, **Stopped at**,
> **Files/areas changed**, **Remaining work**, **Blocker**, **Next safe action**,
> and **Verification** in `AGENT_HANDOFF.md`. If work stops early, provide the
> same handoff instead of leaving the next Agent to infer anything from chat.
