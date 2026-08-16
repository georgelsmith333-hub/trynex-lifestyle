import json
import subprocess

BASE = "https://trynex-lifestyle-shop.pages.dev/api/products"

def fetch(query: str) -> dict:
    raw = subprocess.check_output(
        ["curl", "-sS", "-H", "Origin: https://trynex-lifestyle-shop.pages.dev", f"{BASE}{query}"],
        text=True,
    )
    return json.loads(raw)

all_data = fetch("?limit=100")
long_data = fetch("?category=long-sleeves&limit=100")
bottle_data = fetch("?category=water-bottles&limit=100")
all_products = all_data.get("products", [])
long_products = long_data.get("products", [])
bottle_products = bottle_data.get("products", [])
print(json.dumps({
    "all": {"count": len(all_products), "total": all_data.get("total"), "totalPages": all_data.get("totalPages"), "sampleKeys": sorted(all_products[0].keys()) if all_products else []},
    "longSleeves": {"count": len(long_products), "total": long_data.get("total"), "sample": long_products[:2]},
    "waterBottles": {"count": len(bottle_products), "total": bottle_data.get("total"), "sample": bottle_products[:2]},
}, indent=2, ensure_ascii=False))
