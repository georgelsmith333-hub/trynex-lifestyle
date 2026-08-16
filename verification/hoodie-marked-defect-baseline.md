# Hoodie Marked Defect Baseline

**Source references:** User-supplied marked hoodie matrix and unmarked hoodie matrix in the current task. The supplied images are not reopened through the file viewer.

## Acceptance target

The unmarked matrix is the target for a blank product source: every color must represent the same hoodie construction, with consistent hood proportions, shoulder line, sleeve length, cuffs, kangaroo pocket, hem, drawstring placement, camera framing, and front/back scale. A back view may have different construction visibility, but it must not be a flat placeholder that changes the apparent product shape or color logic. Customer artwork must be composited separately and clipped to the printable surface without changing the garment silhouette.

## Defect taxonomy visible in the marked matrix

| Family area | Marked symptom to eliminate | Likely class of root cause |
|---|---|---|
| Black front/back | Pale or dark horizontal/side intrusion around the lower body and side edges; front and back do not share the same edge behavior | Border-connected alpha contamination, inconsistent source bounds, or duplicate tint layer |
| Burgundy front | Large irregular yellow-highlighted region around the hood/shoulder/side and lower garment | Extraneous matte pixels or mismatched front source with a second silhouette/tint |
| Forest front | Diagonal banding/patches across the torso and shoulder, with visible non-garment regions | Opaque extraction pixels, compositing mask mismatch, or photographic background retained inside the cutout |
| Grey front | Strong yellow-highlighted ghosting around hood, chest, lower hem, and sleeve | Duplicate garment layer or incorrect alpha/keying of the light source image |
| Navy front | Large diagonal side/torso wedge and underarm intrusion | Coordinate-mismatched silhouette clip or source asset with an incorrect transparent boundary |
| Maroon front | Broad irregular halo around torso and lower side edges | Alpha halo, matte contamination, or inconsistent image framing |
| Olive front | Large shoulder/torso overlay and side contamination | Duplicate layer, opaque background, or incorrectly recolored source |
| Red front | Visible strong body/side highlight that does not match the clean product construction | Over-aggressive luminance/tint treatment or retained background/shadow layer |
| Sky-blue front | Diagonal broad overlay through torso and lower side | Incorrect alpha extraction or source/clip coordinate mismatch |
| White front/back | Low-contrast construction and edge visibility must remain intact without adding gray/colored artifacts | Light garment alpha threshold must preserve fabric detail while removing only background |

## Cross-family rules

The same audit must be applied to T-shirt, Long Sleeve, Mug, Cap, and Water Bottle. Every product source must pass five checks: silhouette completeness, alpha cleanliness, front/back construction consistency, protected product details, and stable framing. The product image must remain a single canonical source surface; artwork, shading, texture, masks, and protected details must not create a visible duplicate product layer.

For apparel, sleeves, cuffs, shoulder edges, hood cords, kangaroo pocket, and hem must remain complete. For mugs, handle and rim geometry must be preserved and the left/right sides must not be mirrored incorrectly. For Caps, crown and brim must remain one continuous product. For Water Bottles, the cylindrical body, ring-cap/carabiner, neck, and exclusion areas must remain unchanged. All front/back paths must be represented in the manifest and must resolve to the same category/color matrix at runtime.

## Rejection criteria

Reject any asset if it has a border-connected opaque matte, a pale wedge, diagonal background band, duplicate garment contour, missing sleeve or hem, flattened back that changes the product identity, inconsistent scale, visible crop, or a source-specific artifact that appears only after color switching. Do not accept a generated or recolored asset merely because its filename and alpha channel exist; visual matrix acceptance is required.

## First visual matrix findings

The current hoodie sheet confirms the marked defects are not imagined: photographic fronts contain hood, cords, pocket, folds, and cuffs, while most colored backs are simplified silhouettes with different proportions and weaker construction detail. The most obvious risks are forest/grey/olive/sky-blue front edge contamination and inconsistent front/back geometry; burgundy, maroon, navy, and red also need a strict source/alpha comparison rather than blind recoloring. White remains especially sensitive because detail is low contrast.

The current T-shirt sheet shows a related pattern: black, maroon, olive, red, sky-blue, and white fronts/backs do not all share the same photographic detail level, framing, or edge behavior. Black and red retain strong front folds while backs are simpler; maroon and olive show visible light side/background wedges on some fronts; white has low-contrast edges that require a conservative alpha rule. The hoodie defect class therefore cannot be fixed only in the hoodie file; a shared source normalization and face-consistency audit is required across all families.

## Second visual matrix findings

The Long Sleeve sheet confirms complete front sleeves and cuffs, but several colored fronts retain pale/white side gaps at the underarms while backs are broad simplified silhouettes with weaker fabric detail. The source contract must preserve those negative spaces only where they are truly outside the garment and must not allow artwork or matte pixels to occupy them.

The Mug sheet has consistent left/right handle reversal and a stable cylindrical silhouette, but most colored mugs are overly flat: rim highlights, body luminance, and subtle curvature are weak compared with the black and white photographic sources. The mug compositor therefore needs protected rim/handle shading and a curved print surface rather than a flat recolored rectangle.

## Third visual matrix findings

The Cap sheet shows a construction mismatch between flat front caps and photographic back caps. Back caps have stronger highlights, shadows, and sometimes a visible cast-shadow footprint, while fronts are flat recolors; white back is especially tinted and does not match the white front. This is a source/lighting consistency defect, not merely a color choice.

The Water Bottle sheet confirms the requested ring-cap/carabiner shape is present, but rear faces have severe bright/white vertical halos and edge loss on black, forest, navy, pink, red, sky-blue, teal, and white. The ring and neck are especially vulnerable to alpha erosion. Water Bottle backs must be reconstructed from a protected-detail source with border cleanup that never removes the ring, neck, or body highlight.

At this point all six families have been visually inspected. The defects are cross-family: flat or mismatched backs, inconsistent luminance, background halos, and protected-detail erosion. A final patch limited to hoodie would be unsafe; the next implementation pass must normalize each family with product-specific detail masks and face-aware alpha rules.

## Repair-pass findings

The first repair attempt exposed an important failure: recoloring from a dark black master collapsed every colored back toward black. That pass was rejected and corrected. The white-master luminance pass now restores burgundy, forest, grey, maroon, navy, olive, red, and sky-blue back color with visible folds and construction detail. The backs are no longer flat silhouettes, but they are more photographic/glossy than the corresponding flat fronts, so the live editor must be checked before acceptance.

Water Bottle backs restored from the original protected-detail sources retain the ring-cap/carabiner and body geometry, but bright vertical rear halos remain visible in the matrix, especially on black, forest, navy, pink, red, sky-blue, teal, and white. This is still a blocking source-alpha issue for Water Bottle acceptance and must be corrected without eroding the ring or neck.

## Targeted repair findings

Mirroring each clean Water Bottle front into its rear face removes the bright vertical rear halos and preserves the body highlight, cylindrical silhouette, and ring-cap/carabiner. The rear ring is correctly mirrored rather than deleted. This repair is suitable for the cylindrical product and must still be validated with an uploaded design and print-zone mask.

Cap remains a separate unresolved class: its fronts are clean flat silhouettes while backs are detailed photographic views with cast-shadow footprints, different apparent scale, and inconsistent white/colored lighting. The cap cannot inherit the apparel or bottle repair. It needs either a consistent front/back photographic pair or a single controlled crown/brim source with a separate protected rear adjustment, with any cast shadow removed from the printable surface.

## Cap and bottle repair acceptance

The refined Cap rear reconstruction now uses a clean mirrored front silhouette with only a central rear-adjuster patch. This removes the previous cast-shadow footprint, inconsistent rear scale, and photographic side halo. It is visually more stable and suitable for a clean blank mockup, although it intentionally does not preserve the old photographic rear texture.

The Water Bottle mirror repair remains accepted at the source-matrix level: rear halos are gone, body shading is continuous, and the ring-cap/carabiner remains visible on both faces. Both repairs must still be exercised in the live editor with artwork before they are called final.

## Live b71ea37 acceptance findings

The public b71ea37 Design Studio is serving the repaired source bundle. Black Hoodie front is visually clean with one garment layer, complete hood, cords, sleeves, pocket, and hem. Switching the live Hoodie to Grey exposes a pale/white underarm wedge and light side pixels on both sleeves, matching the marked-matrix complaint. This proves the source-kit repair is not complete: the colored back rebuild improved the matrix contact sheet but the active front source still contains product/background pixels that must be removed with a bounded apparel silhouette mask or corrected source alpha. The issue is now narrowed to live colored front alpha/source pixels rather than routing or deployment.

## Bounded front-alpha matrix result

The hoodie contact sheet after the bounded front-alpha repair shows clean colored front envelopes: the Grey, Forest, Navy, Olive, Red, Sky Blue, Maroon, and Burgundy fronts no longer carry the broad pale side wedges seen in the marked matrix, and sleeves/hood/pocket/hem remain complete. The colored backs retain reconstructed folds and color. The front/back lighting style is still not identical—fronts are cleaner studio cutouts while backs carry stronger photographic folds—but the prior matte spill and duplicate-layer class is removed at the source-matrix level.

## Live d55ce1b verification

The public d55ce1b Design Studio now serves the bounded front-alpha assets. Grey Hoodie renders as a single complete garment with clean side edges and no extra opaque light strip; the white triangular areas between torso and sleeves are consistent transparent underarm negative space and remain stable across Sky Blue. Sky Blue also renders a complete hood, sleeves, pocket, cuffs, and hem with no diagonal yellow-like intrusion. The remaining visible difference is lighting style between clean colored fronts and more photographic reconstructed backs, not the previously observed source wedge.

## Live apparel and mug checks

The public d55ce1b Long Sleeve route resolves to `product=longsleeve` and renders the correct Unisex Long Sleeve 240GSM Cotton template. The Sky Blue front shows complete sleeves, cuffs, hem, and clean underarm negative space without the prior route fallback or visible cutoff.

The public d55ce1b Mug route resolves to Coffee Mug 11oz Ceramic. Left Side, Right Side, and Wrap controls are visible, and the Sky Blue mug renders one cylindrical body with the correct handle geometry. No duplicate mug layer is visible in the live canvas. Curved uploaded-artwork behavior remains a separate stateful test.

## Live bottle and cap checks

The public d55ce1b Water Bottle route resolves to Water Bottle 600ml Aluminium and renders the required blue cylindrical body with ring-cap/carabiner. The clean mirrored source removed the previous bright rear halo class from the deployed front surface; the editor has the expected upload, layer, and export controls.

The public d55ce1b Cap route resolves to Structured Cap Cotton Twill and renders a stable single white cap silhouette with continuous crown and brim. No cast-shadow rectangle or duplicate rear product layer is visible in the live front view. Rear-adjuster and artwork behavior still require a face-specific uploaded-design test.

## T-shirt live route finding

The d55ce1b public browser session continues to retain Structured Cap when navigating to both `product=tshirt` and `product=t-shirts`. This is the same harness/application-state anomaly seen in the prior wave. Because the live route does not visibly select T-shirt in this session, the T-shirt family is not marked live-pass even though its v3 source matrix and bounded alpha files are internally validated. A separate fresh browser context or route-level automated test is required to determine whether this is browser-session retention or an active V2 alias/state bug.
