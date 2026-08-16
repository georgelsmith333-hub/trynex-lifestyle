import json
from pathlib import Path
p = Path('/home/ubuntu/trynex-release/verification/six-family-v3-metrics.json')
data = json.loads(p.read_text())
rows = []
for row in data['rows']:
    f, b = row['faces']['front'], row['faces']['back']
    if 'alpha_area' not in f or 'alpha_area' not in b:
        continue
    ratio = row['faces'].get('area_ratio_back_to_front')
    rows.append({
        'family': row['family'], 'color': row['color'], 'ratio': ratio,
        'frontBounds': f['alpha_bounds'], 'backBounds': b['alpha_bounds'],
        'frontArea': f['alpha_area'], 'backArea': b['alpha_area'],
        'frontMean': f['mean_rgb_on_alpha'], 'backMean': b['mean_rgb_on_alpha'],
        'frontCorners': f['corner_alpha'], 'backCorners': b['corner_alpha'],
    })
rows.sort(key=lambda r: abs((r['ratio'] or 1) - 1), reverse=True)
print('TOP FRONT/BACK AREA DIVERGENCE')
for r in rows[:24]:
    print(f"{r['family']}/{r['color']}: ratio={r['ratio']}, front={r['frontBounds']}, back={r['backBounds']}")
print('\nWHITE/BRIGHT FACE MEAN RISKS')
for r in rows:
    if max(r['backMean']) - min(r['backMean']) < 10 or sum(r['backMean']) > 650:
        print(f"{r['family']}/{r['color']}: backMean={r['backMean']}, frontMean={r['frontMean']}")
