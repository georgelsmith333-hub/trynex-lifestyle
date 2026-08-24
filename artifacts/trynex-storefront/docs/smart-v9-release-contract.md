# Smart-v9 Design Studio Release Contract

Smart-v9 is a **future, dormant** visual release for the actual `/design-studio` route. It does not activate merely because files exist. The current site continues on its accepted release until the following contract is satisfied.

| Requirement | Enforced by |
|---|---|
| Exactly 188 unique canonical product/color/view surfaces | `acceptSmartV9Release` and `scripts/prepare-smart-v9-release.mjs` |
| Every surface is visually accepted | Candidate manifest field `visualReviewStatus: "accepted"` |
| Every surface is a 1024×1024 8-bit RGBA PNG with a matching SHA-256 | `scripts/prepare-smart-v9-release.mjs` |
| Asset URLs are local `/mockups/smart-v9/*.png` paths and cannot be traversal, query, or smart-v7 paths | `acceptSmartV9Release` |
| Generated/derived provenance is recorded | Candidate manifest and runtime contract |
| Water Bottle front and back remain the authenticated original files | Exact hash checks in `smart-v9-release.ts` |
| Product-picker cards use accepted v9 assets after activation and do not fall back to an older release | `getProductPickerPreviewSrc` / `getProductPickerFallbackSrc` |

## Required release sequence

1. Create or legally source-faithfully edit every non-bottle master. Do not copy third-party product imagery or branding.
2. Validate the master files, derive only material-credible color variants, and record each artifact’s provenance and SHA-256.
3. Review every canonical surface. Only after an explicit acceptance decision may the candidate manifest use `visualReviewStatus: "accepted"`.
4. Run:

   ```bash
   pnpm smart-v9:prepare <candidate-root> <output-ts-path>
   ```

   The command must finish successfully and produce the runtime candidate module. A failure is a release block, not a warning.
5. Import that generated candidate only in the release activation path and call `activateSmartV9Release`. Then run the full test suite, TypeScript check, capability verifier, build, and visual route review.

No fallback to a partial, legacy, or retired release is permitted. In particular, do not reactivate smart-v7.
