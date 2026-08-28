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

The 188-surface smart-object mockup pipeline now exists and regenerates locally.
The public `/design-studio` route is still V1; smart-v9 is **not** activated.
Next product work is wiring accepted 188 PNG surfaces into a smart-v9 candidate
(visual review + `prepare-smart-v9-release.mjs`), which this session did not do.

## Required status at every handoff

Every Agent must keep the following status fields current before ending a chat,
pausing work, or transferring the project:

```text
Status: ready for review
Last completed: Three-stage mockup rebuild on arena/01a04968-trynex-lifestyle. (1) Extracted 94 canonical 1024 RGBA bases from source-kit Product Photo layers. (2) tools/build_complete_mockup_system.py produced exactly 188 surfaces. (3) tools/build-smartobject-mockups.mjs now uses CANVAS=2048 and writes both .psd (8BPS v1) and .psb (8BPS v2) with a real smart-object artwork layer.
Stopped at: After generating 188×2048 PSD+PSB masters locally (dist-mockups/masters, gitignored, ~1.9 GB) and committing the pipeline plus a water-bottle 2048 sample zip. Not pushed until the end of this session.
Files/areas changed: tools/extract_base_pngs.py, tools/mockup_canonical.py, tools/build_complete_mockup_system.py, tools/build-smartobject-mockups.mjs, tools/package.json, dist-mockups/_work/base (188 PNGs), dist-mockups/_work/surfaces-manifest.json, dist-mockups/_work/contact-sheet-188.png, dist-mockups/packages/README.md, dist-mockups/packages/trynex-waterbottle-smartobject-mockups-2048.zip, AGENT_HANDOFF.md. No storefront/runtime code was modified.
Remaining work: Visual review of the 94 derived views; optional smart-v9 candidate packaging (188 accepted PNGs + provenance + hashes). Do not copy smart-v4 into smart-v9. Do not tint the water bottle.
Blocker: None for the approved rebuild scope. Full 188 PSD/PSB set is not in git (GitHub 100 MB file limit); regenerate with node tools/build-smartobject-mockups.mjs.
Next safe action: Review dist-mockups/_work/contact-sheet-188.png and the 2048 water-bottle sample zip. If the derived sleeves/neck/wrap views are accepted, run prepare-smart-v9-release.mjs against dist-mockups/_work/base.
Verification: extract_base_pngs.py printed bases=94; build_complete_mockup_system.py printed surfaces=188 (tshirt 40 + longsleeve 50 + hoodie 50 + mug 30 + cap 16 + bottle 2); builder printed built=188 failed=0 canvas=2048 formats=psd,psb. Sample masters audited with psd-tools: 2048×2048, exactly one SmartObjectLayer, PSD magic 8BPS\\x00\\x01, PSB magic 8BPS\\x00\\x02. Water bottle remains white-only.

## Mockup rebuild decision (closed — owner chose execute)

The owner directed this session to extract the 94 bases, reach 188 surfaces,
and emit 2048 PSD+PSB smart-object masters. That is the hybrid path:

  - 94 authentic product photos from the source-kit PSD Product Photo layer
  - 94 derived views (sleeves / neck-label / mug wrap) from those photos
  - ag-psd writes a real smart-object artwork layer into every 2048 master
    as both `.psd` and `.psb`

Still true and still binding:

  - Water bottle is hash-pinned and single-colour; the kit's 14 extra bottle
     colours are non-canonical and must not ship.
  - smart-v9 gate requires 188 surfaces, each visually accepted with real
     provenance. Copying smart-v4 into smart-v9 cannot pass it.
  - No fallback is permitted: partial shipping blocks release, by contract.
  - Derived sleeve/neck/wrap views are geometry crops of the front photo,
    not new photography. They need a visual-accept pass before smart-v9.

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
