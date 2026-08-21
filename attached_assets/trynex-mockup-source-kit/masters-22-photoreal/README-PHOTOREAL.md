# TryNex Photoreal POD Mockups — all 6 products

Photorealistic print-on-demand style mockups built from studio product
photography bases, aligned to the live smart-v4 geometry, delivered as
transparent 1024x1024 RGBA exports + editable PSD/PSB masters with genuine
embedded Photoshop Smart Objects.

## Deliverables (6 zips)
- trynex-mockup-tshirt-photoreal.zip       8 colors x 5 views = 40
- trynex-mockup-longsleeve-photoreal.zip  10 colors x 5 views = 50
- trynex-mockup-hoodie-photoreal.zip      10 colors x 5 views = 50
- trynex-mockup-mug-photoreal.zip         10 colors x 3 views = 30
- trynex-mockup-cap-photoreal.zip          8 colors x 2 views = 16
- trynex-mockup-waterbottle-photoreal.zip  8 colors x 2 views = 16
Total: 54 colorways, 202 surfaces, 22 masters.

Each zip: exports/{family}/{color}/{view}.png, masters/{Family}/{view}.psd|psb,
proof/ (front-colors, white-views, artwork-applied), white/ bases, README.

## Views
- Apparel: front, back, left-sleeve, right-sleeve, neck-label.
  (sleeves are real flat-lay sleeve crops; hoodie has dedicated sleeve photos;
   neck-label = collar close-up crop, hoodie = dedicated inside-collar photo)
- Mug: front photo, wrap photo (3/4 angle), back = mirrored front (180 deg).
- Cap: front + back photos (strap/buckle on back).
- Water Bottle: front + back photos (black cap + loop + carabiner preserved;
  protected regions stay photo-colored in every colorway).

## Masters (PSD/PSB layer stack)
PHOTO_BASE / PRODUCT_ALPHA / COLOR_CONTROL / SHADOW_MAP / HIGHLIGHT_MAP /
DISPLACEMENT_MAP / PRINT_ART_SMART_OBJECT (real SO, embedded file) /
PRINT_MASK / FABRIC_OR_MATERIAL_TEXTURE / PROTECTED_DETAILS / BACKGROUND_GUIDE.

## Runtime
/mockups/smart-v4/{family}/{color}/{view}.png — print zones per specs/
(smart-v4 contract; no legacy paths referenced).

## QA (photoreal build)
202/202 exports 1024x1024 RGBA; margins >= 32px; zone-center coverage
verified per view (photo-geometry aware); 22/22 true Smart Objects; 0
duplicate surfaces; colorways keep protected details (bottle cap/carabiner,
mug handle/rim).
