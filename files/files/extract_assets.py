"""
extract_assets.py
-----------------
Extrae los shapes de los archivos DSL de Diagram Studio
y los guarda en public/assets/lib/ del proyecto Vite.

Uso:
  pip install Pillow
  python extract_assets.py

Colocá este archivo en la raíz del proyecto (junto a package.json).
Los archivos DSL deben estar en la carpeta Lib/ (relativa a este script).
"""

import os, io, re
from pathlib import Path
from PIL import Image

# ── Configuración ──────────────────────────────────────────────────────────────
LIB_DIR = Path("Lib")          # carpeta con los .dsl
OUT_DIR = Path("public/assets/lib")  # destino de las PNGs
OUT_SIZE = 128                  # px de salida (upscale de 32x32)

OUT_DIR.mkdir(parents=True, exist_ok=True)

# ── Parser ─────────────────────────────────────────────────────────────────────
def parse_dsl(filepath):
    with open(filepath, "rb") as f:
        data = f.read()
    results = []
    png_sig  = b"\x89PNG\r\n\x1a\n"
    iend_sig = b"IEND\xaeB`\x82"
    pos = 0
    idx_n = 0
    while pos < len(data):
        idx = data.find(png_sig, pos)
        if idx == -1:
            break
        iend = data.find(iend_sig, idx)
        if iend == -1:
            pos = idx + 1
            continue
        png_data = data[idx : iend + len(iend_sig)]
        lb = data[max(0, idx - 300) : idx]
        name = f"shape_{idx_n}"
        for m in reversed(re.findall(rb"[\x20-\x7e]{3,50}", lb)):
            s = m.decode("ascii", errors="ignore").strip()
            if s and not any(x in s for x in ["c26","IDAT","PNG","sRGB","gAMA","cHRM","IHDR","pHYs","XG","IEND"]):
                name = s
                break
        try:
            img = Image.open(io.BytesIO(png_data))
            img.load()
            results.append({"name": name, "img": img, "size": len(png_data)})
        except Exception:
            pass
        pos = iend + len(iend_sig)
        idx_n += 1
    return results


# ── Shapes a extraer ───────────────────────────────────────────────────────────
WANTED = {
    "Vehicles.dsl": [
        ("AUTO MEDIO",         "auto_medio"),
        ("AUTO CHICO",         "auto_chico"),
        ("PERSONA",            "persona"),
        ("VOLCADO",            "volcado"),
        ("CAMION 1/2 VUELCO",  "camion_vuelco"),
        ("TRAILER",            "trailer"),
        ("MOTO ARRIBA",        "moto_arriba"),
        ("GRUA",               "grua"),
        ("Mid-size car1",      "car_mid"),
        ("Full-size van",      "van"),
        ("Minivan",            "minivan"),
        ("Compact pickup",     "pickup"),
    ],
    "Road Shapes.dsl": [
        ("Four Lane Road (Vert.)",           "road_4lane_v"),
        ("Two Lane Cross Road",              "road_cross_2"),
        ("Two Lane T-intersection (top)",    "road_t_top"),
        ("Two Lane T-intersection (bottom)", "road_t_bot"),
        ("Curved Two Lane Road (left)",      "road_curve_2l"),
        ("Curved Two Lane Road (right)",     "road_curve_2r"),
        ("Curved Four Lane Road (right)",    "road_curve_4r"),
        ("Two Lane Y-intersection",          "road_y"),
        ("3-Junction",                       "road_3junc"),
        ("Junction (left)",                  "road_junc_l"),
        ("Junction (right)",                 "road_junc_r"),
        ("Railroad Crossing",                "railroad_cross"),
    ],
    "Traffic Signs.dsl": [
        ("Traffic Signal",    "sign_traffic_light"),
        ("Stop Sign",         "sign_stop"),
        ("All Way",           "sign_all_way"),
        ("Wrong Way",         "sign_wrong_way"),
        ("Left Turn",         "sign_left"),
        ("Right Turn",        "sign_right"),
        ("Pedestrians Ahead", "sign_ped_ahead"),
        ("School Sign",       "sign_school"),
        ("Curve Ahead",       "sign_curve"),
        ("Two Way Traffic",   "sign_two_way"),
    ],
    "Landmark Shapes.dsl": [
        ("Tree",        "tree"),
        ("Fir",         "fir"),
        ("House",       "house"),
        ("Gas station", "gas_station"),
        ("Compass",     "compass"),
        ("Park",        "park"),
    ],
    "veh.dsl": [
        ("Image211",           "car_veh2"),
        ("Straight body truck1","truck_veh"),
        ("Compact car1",       "car_compact"),
    ],
}

# ── Extracción ─────────────────────────────────────────────────────────────────
ok = 0
missing = []

for fname, wants in WANTED.items():
    path = LIB_DIR / fname
    if not path.exists():
        print(f"⚠  Archivo no encontrado: {path}")
        continue

    items = parse_dsl(path)
    by_name = {}
    for item in items:
        by_name.setdefault(item["name"], []).append(item)

    for want_name, slug in wants:
        candidates = by_name.get(want_name, [])
        if not candidates:
            missing.append(f"{want_name} ({fname})")
            continue
        best = max(candidates, key=lambda x: x["size"])
        img = best["img"].convert("RGBA")
        img_up = img.resize((OUT_SIZE, OUT_SIZE), Image.LANCZOS)
        img_up.save(OUT_DIR / f"{slug}.png", "PNG")
        print(f"  ✓ {slug}.png  ← '{want_name}'")
        ok += 1

print(f"\n✓ {ok} shapes extraídos en {OUT_DIR}/")
if missing:
    print(f"⚠ Faltantes ({len(missing)}):")
    for m in missing:
        print(f"   - {m}")
