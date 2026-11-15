"""Precios mayoristas MIDAGRI-SISAP: lectura del CSV real y paso a precio en chacra."""

from datetime import date

from ceres.infrastructure.prices import load_prices, parse_rows


def test_real_sisap_csv_parses_with_bom_and_semicolons(base_settings):
    p = load_prices(base_settings.data_dir / "precios")
    onion = p[("Arequipa", "Cebolla cabeza roja")]
    assert onion.days == 6 and onion.first == date(2026, 11, 2) and onion.last == date(2026, 11, 13)
    assert onion.median == 1.85 and onion.low <= onion.median <= onion.high
    assert p[("Arequipa", "Frijol canario")].median == 7.725
    # SISAP no publica maíz amarillo duro en estas dos semanas.
    assert not any("amarillo duro" in prod.lower() for _, prod in p)


def test_daily_median_and_weekly_trend():
    rows = [
        {"Fecha": f"0{d}/11/2026", "Mercado_Region": "X", "Producto": "P", "Precio_Unitario_Kg_Lt_Soles": str(v)}
        for d, v in [(1, 1.0), (2, 1.1), (3, 1.2), (4, 1.3)]
    ] + [{"Fecha": "04/11/2026", "Mercado_Region": "X", "Producto": "P", "Precio_Unitario_Kg_Lt_Soles": "1.5"}]
    st = parse_rows(rows)[("X", "P")]
    assert st.days == 4 and st.last == date(2026, 11, 4)
    assert abs(st.series[-1][1] - 1.4) < 1e-9  # mediana de 1,3 y 1,5 el mismo día
    assert st.slope_week is not None and st.slope_week > 0


def test_catalog_farmgate_price_comes_from_sisap(catalog):
    onion = catalog.crop("cebolla_roja").economics
    assert onion.market and onion.market["market"] == "Arequipa" and onion.market["median_soles_kg"] == 1.85
    assert onion.price_soles_kg == 0.70  # 1,85 × 0,378: el factor conserva el valor previo de la demo
    assert "MIDAGRI-SISAP" in onion.source_ids and onion.status == "supuesto_demo"
    assert catalog.crop("frejol_grano").economics.price_soles_kg == 5.50
    maize = catalog.crop("maiz_grano").economics
    assert maize.market is None and maize.price_soles_kg == 1.20
