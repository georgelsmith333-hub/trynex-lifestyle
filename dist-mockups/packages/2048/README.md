# TryNex 2048 smart-object masters (shipped)

All **188** canonical surfaces for the 6 products, each as:

- `.psd` — Photoshop Document (`8BPS` version 1), 2048×2048, real smart object
- `.psb` — Large Document (`8BPS` version 2), same layers
- `-DISPLACEMENT.psd` — sidecar for `Filter > Distort > Displace`

GitHub rejects files ≥ 100 MB, so the set is split into **29 zip parts**,
each stored (not deflated) and **under 90 MiB**.

## Unpack

```bash
mkdir -p dist-mockups/masters
for z in dist-mockups/packages/2048/trynex-*-2048-smartobject-part*.zip; do
  unzip -n "$z" -d dist-mockups/masters
done
```

Each zip already prefixes files with the family folder
(`tshirt/`, `hoodie/`, …).

## Parts

| Family | Surfaces | Zip parts |
|---|---:|---:|
| tshirt | 40 | 07 |
| longsleeve | 50 | 07 |
| hoodie | 50 | 07 |
| mug | 30 | 04 |
| cap | 16 | 03 |
| waterbottle | 2 | 01 |
| **Total** | **188** | **29** |

`index.json` lists every zip, its byte size, and the member files.

Water bottle is **white only** (sublimation aluminium blank). Extra kit
colours are not shipped.

## Photoshop

1. Open any `.psd` or `.psb`.
2. Double-click `ARTWORK — double-click to edit your design`.
3. Paste artwork, Save, close.
4. Optional drape: Filter > Distort > Displace → the matching
   `-DISPLACEMENT.psd`, scale 10 / 10.

## Rebuild from source (if you do not want the zips)

```bash
python3 tools/extract_base_pngs.py
python3 tools/build_complete_mockup_system.py
python3 tools/make-displacement-maps.py dist-mockups/_work/base dist-mockups/_work/displace
cd tools && npm install && cd ..
node tools/build-smartobject-mockups.mjs
python3 tools/pack_masters_under_100mb.py --all
```
