"""Pruebas locales de nutrición: sin DB, red ni proveedores LLM."""

from copy import deepcopy
import hashlib
import json
from pathlib import Path
import posixpath
import subprocess
import sys
import xml.etree.ElementTree as ET
from zipfile import ZipFile

import pytest

from ceres.domain.nutrition import (
    FAO_PULSES_SOURCE_ID,
    HIS_SOURCE_ID,
    INS_FOOD_SOURCE_ID,
    nutrition_impact,
)
from ceres.infrastructure.nutrition import NutritionDataError, load_nutrition

FOLDER = Path(__file__).resolve().parents[4] / "data" / "nutricion"
CONTEXT = FOLDER / "arequipa_context.json"


def _context() -> dict:
    return json.loads(CONTEXT.read_bytes())


def _replace_json(monkeypatch, data) -> None:
    original = Path.read_bytes
    monkeypatch.setattr(Path, "read_bytes", lambda p: json.dumps(data).encode() if p == CONTEXT else original(p))


def _workbook_cells(path: Path, names: set[str]) -> dict:
    """Lee únicamente hojas seleccionadas; valores XML guardados, sin Excel."""
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    with ZipFile(path) as archive:
        strings = [
            "".join(node.itertext())
            for node in ET.fromstring(archive.read("xl/sharedStrings.xml")).findall("m:si", ns)
        ] if "xl/sharedStrings.xml" in archive.namelist() else []
        targets = {
            node.attrib["Id"]: posixpath.normpath("/xl/" + node.attrib["Target"]).lstrip("/")
            if not node.attrib["Target"].startswith("/") else node.attrib["Target"].lstrip("/")
            for node in ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        }
        result = {}
        for sheet in ET.fromstring(archive.read("xl/workbook.xml")).findall("m:sheets/m:sheet", ns):
            name = sheet.attrib["name"]
            if name not in names:
                continue
            target = targets[sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]]
            cells = {}
            for cell in ET.fromstring(archive.read(target)).findall("m:sheetData/m:row/m:c", ns):
                value, inline = cell.find("m:v", ns), cell.find("m:is", ns)
                if value is not None:
                    cells[cell.attrib["r"]] = strings[int(value.text)] if cell.attrib.get("t") == "s" else value.text
                elif inline is not None:
                    cells[cell.attrib["r"]] = "".join(inline.itertext())
            result[name] = cells
        assert set(result) == names
        return result


def test_local_context_has_exact_workbook_hash_and_independent_denominators():
    context = load_nutrition(CONTEXT)
    assert context["integrity"]["workbook_sha256_verified"] is True
    assert context["integrity"]["json_sha256"] == hashlib.sha256(CONTEXT.read_bytes()).hexdigest()
    by_id = {i["id"]: i for i in context["indicators"]}
    assert by_id["anemia_total"]["count"] == 5146
    assert by_id["anemia_total"]["denominator"] == 23538
    assert by_id["anemia_total"]["percent"] == pytest.approx(21.86252018013425)
    assert by_id["talla_baja"]["denominator"] == 34328
    assert by_id["sobrepeso"]["count"] == 9530
    assert by_id["anemia_total"]["denominator"] != by_id["talla_baja"]["denominator"]


def test_every_exported_cell_matches_xlsx_including_headers_units_period_and_notes():
    context = _context()
    names = {"INICIO", "EN 12-17a x REGION", "Anemia 12-17a x REGION"}
    actual = _workbook_cells(FOLDER / context["source"]["filename"], names)
    for ref, value in context["source"]["cover_cells"].items():
        sheet, cell = ref.split("!")
        assert actual[sheet][cell] == value
    for sheet in context["sheets"]:
        cells = actual[sheet["name"]]
        assert [ref for ref, value in cells.items() if ref.startswith("B") and value == "AREQUIPA"] == [sheet["region_cell"]]
        assert cells[sheet["period_cell"]] == sheet["period_raw"]
        for field in ("cells", "headers", "notes"):
            assert {ref: cells[ref] for ref in sheet[field]} == sheet[field]


@pytest.mark.parametrize("case", ["region", "total", "denominator", "percent_fraction", "nan", "missing", "duplicate", "hash", "source", "path", "unit", "period", "extra_sheet"])
def test_loader_rejects_mixed_regions_unknowns_and_invalid_provenance(monkeypatch, case):
    data = _context()
    if case == "region":
        data["region"] = "Perú"
    elif case == "total":
        data["sheets"][0]["cells"]["B11"] = "MINSA"
    elif case == "denominator":
        data["indicators"][7]["denominator"] = 34328
    elif case == "percent_fraction":
        data["indicators"][7]["percent"] /= 100
    elif case == "nan":
        data["indicators"][7]["percent"] = float("nan")
    elif case == "missing":
        data["indicators"][7]["count"] = None
    elif case == "duplicate":
        data["indicators"][0] = deepcopy(data["indicators"][1])
    elif case == "hash":
        data["source"]["sha256"] = "0" * 64
    elif case == "source":
        data["source_ids"] = ["INVENTADA"]
    elif case == "path":
        data["source"]["filename"] = "../unrelated.xlsx"
    elif case == "unit":
        data["indicators"][7]["percent_unit"] = "% de evaluados para talla/edad"
    elif case == "period":
        data["period"]["start"] = "2026-08-01"
    elif case == "extra_sheet":
        data["sheets"].append(deepcopy(data["sheets"][0]))
    _replace_json(monkeypatch, data)
    with pytest.raises(NutritionDataError):
        load_nutrition(CONTEXT)


def test_missing_workbook_is_explicit_and_does_not_prevent_json_only_production(monkeypatch):
    workbook = FOLDER / _context()["source"]["filename"]
    original = Path.exists
    monkeypatch.setattr(Path, "exists", lambda p: False if p == workbook else original(p))
    result = load_nutrition(CONTEXT)
    assert result["integrity"]["workbook_sha256_verified"] is False
    assert result["source"]["sha256"] == _context()["source"]["sha256"]


def test_json_only_loading_and_domain_work_without_installed_packages():
    code = "\n".join([
        "import sys",
        "from pathlib import Path",
        "from unittest.mock import patch",
        "sys.path.insert(0, sys.argv[1])",
        "from ceres.infrastructure.nutrition import load_nutrition",
        "from ceres.domain.nutrition import nutrition_impact",
        "with patch.object(Path, 'exists', return_value=False):",
        "    context = load_nutrition(Path(sys.argv[2]))",
        "result = nutrition_impact(['maiz_choclo', 'frejol_grano', 'alfalfa'], context)",
        "assert context['integrity']['workbook_sha256_verified'] is False",
        "assert len(result['foods']) == 3",
        "assert result['foods'][-1]['nutrients'] is None",
    ])
    # -I/-S excluyen PYTHONPATH, user site y todos los paquetes instalados.
    result = subprocess.run(
        [sys.executable, "-B", "-I", "-S", "-c", code, str(Path(__file__).resolve().parents[2] / "src"), str(CONTEXT)],
        capture_output=True, text=True, check=False,
    )
    assert result.returncode == 0, result.stderr


def test_loader_does_not_share_mutable_snapshot():
    result = load_nutrition(CONTEXT)
    result["indicators"][0]["count"] = -1
    assert load_nutrition(CONTEXT)["indicators"][0]["count"] == 31424


@pytest.mark.parametrize("location", ["root", "source", "indicator", "sheet", "headers", "cover"])
def test_loader_rejects_extra_fields_in_aggregate_snapshot(monkeypatch, location):
    data = _context()
    target = {
        "root": data, "source": data["source"], "indicator": data["indicators"][0],
        "sheet": data["sheets"][0], "headers": data["sheets"][0]["headers"],
        "cover": data["source"]["cover_cells"],
    }[location]
    target["campo_ajeno"] = "dato no autorizado"
    _replace_json(monkeypatch, data)
    with pytest.raises(NutritionDataError):
        load_nutrition(CONTEXT)


@pytest.mark.parametrize("field,value", [
    ("limitations", "sin límites"), ("population", ["adolescentes"]),
    ("sheets", {}), ("indicators", {}), ("source", None),
])
def test_loader_rejects_wrong_container_types(monkeypatch, field, value):
    data = _context()
    data[field] = value
    _replace_json(monkeypatch, data)
    with pytest.raises(NutritionDataError):
        load_nutrition(CONTEXT)


@pytest.mark.parametrize("raw", [b"{", b"[]", b"null", b"\xff", b'{"x":1,"x":2}', b'{"x":Infinity}'])
def test_loader_rejects_malformed_nonstandard_or_ambiguous_json(monkeypatch, raw):
    monkeypatch.setattr(Path, "read_bytes", lambda p: raw)
    with pytest.raises(NutritionDataError):
        load_nutrition(CONTEXT)


def test_loader_missing_file_is_explicit():
    with pytest.raises(NutritionDataError):
        load_nutrition(FOLDER / "archivo_inexistente.json")


def test_zero_cases_remain_valid_and_distinct_from_missing(monkeypatch):
    data = _context()
    cells = data["sheets"][1]["cells"]
    for indicator in data["indicators"]:
        if indicator["id"] not in {"anemia_moderada", "anemia_severa"}:
            continue
        indicator["count"] = 1366 if indicator["id"] == "anemia_moderada" else 0
        indicator["percent"] = indicator["count"] / indicator["denominator"] * 100
        cells[indicator["count_cell"]] = str(indicator["count"])
        cells[indicator["percent_cell"]] = str(indicator["percent"])
    _replace_json(monkeypatch, data)
    result = load_nutrition(CONTEXT)
    assert result["indicators"][-1]["count"] == 0
    assert result["indicators"][-1]["percent"] == 0


def test_association_and_components_produce_same_unique_foods_without_yield_claims():
    association = nutrition_impact(["maiz_frejol_asociado", "maiz_grano"], None)
    components = nutrition_impact(["maiz_grano", "frejol_grano", "frejol_grano"], None)
    assert association == components
    assert [f["crop_id"] for f in association["foods"]] == ["maiz_grano", "frejol_grano"]
    assert association["foods"][0]["status"] == "potencial_condicionado"
    assert "hierro" in association["foods"][1]["nutrients"]
    assert set(association["source_ids"]) == {INS_FOOD_SOURCE_ID, FAO_PULSES_SOURCE_ID}
    assert "aminoácidos" in association["explanation"]
    assert "No se estiman raciones ni reducciones" in association["explanation"]
    assert set(association) == {"foods", "explanation", "source_ids", "regional_context"}


def test_unknown_and_forage_are_explicit_with_no_invented_nutrients():
    result = nutrition_impact(["desconocido", "alfalfa"], None)
    assert [f["status"] for f in result["foods"]] == ["sin_evidencia", "forraje"]
    assert all(f["nutrients"] is None and f["food"] is None and f["source_ids"] == [] for f in result["foods"])
    assert result["source_ids"] == [] and result["regional_context"] is None
    assert nutrition_impact([], None)["foods"] == []


def test_all_current_edible_crop_ids_have_traceable_distinct_food_references():
    ids = ["maiz_grano", "frejol_grano", "cebolla", "cebolla_roja", "papa", "ajo", "arveja_verde", "haba_verde", "tomate", "zanahoria", "trigo"]
    result = nutrition_impact(ids, None)
    assert len(result["foods"]) == len(ids)
    assert all(f["nutrients"] and f["reference"]["food_code"] and f["source_ids"] == [INS_FOOD_SOURCE_ID] for f in result["foods"])
    assert next(f for f in result["foods"] if f["crop_id"] == "haba_verde")["reference"]["food_code"] == "T47"
    assert next(f for f in result["foods"] if f["crop_id"] == "zanahoria")["reference"]["food_code"] == "B85"


def test_master_workbook_proposals_have_distinct_primary_food_references():
    ids = ["maiz_choclo", "zapallo_macre", "aji_amarillo"]
    result = nutrition_impact(ids, None)
    assert [f["reference"]["food_code"] for f in result["foods"]] == ["A34", "B89", "B3"]
    assert "fibra dietaria" not in result["foods"][2]["nutrients"]
    assert result["foods"][0] != nutrition_impact(["maiz_grano"], None)["foods"][0]
    master = FOLDER / "CERES_base_maestra_cultivos_policultivos_nutricion_2026.xlsx"
    assert hashlib.sha256(master.read_bytes()).hexdigest() == "f1b6a91de61f835771547b90371b7f80cc2f25c68f728a23b037ae2f88ddc068"
    cells = _workbook_cells(master, {"10 NUTRICION", "04 POLICULTIVOS"})
    for row, code in ((11, "A34"), (12, "B89"), (14, "B3")):
        assert cells["10 NUTRICION"][f"D{row}"] == code
    assert cells["04 POLICULTIVOS"]["C4"] == "C008"  # choclo, no amarillo duro
    assert cells["04 POLICULTIVOS"]["L4"] == "Por evaluar en Majes"
    assert nutrition_impact(["P001", "P002", "P003", "P004"], None)["source_ids"] == []


@pytest.mark.parametrize("ids,complements", [
    (["trigo", "frejol_grano"], True), (["maiz_choclo", "frejol_grano"], True),
    (["trigo", "arveja_verde"], False), (["haba_verde", "alfalfa"], False),
])
def test_complementarity_only_uses_documented_combinations(ids, complements):
    assert (FAO_PULSES_SOURCE_ID in nutrition_impact(ids, None)["source_ids"]) is complements


def test_context_is_separate_copied_and_cannot_modify_future_calls():
    context = load_nutrition(CONTEXT)
    original = deepcopy(context)
    result = nutrition_impact(["papa"], context)
    assert context == original
    assert HIS_SOURCE_ID in result["source_ids"]
    result["regional_context"]["indicators"][0]["count"] = -1
    result["foods"][0]["nutrients"].clear()
    assert context == original
    fresh = nutrition_impact(["papa"], context)
    assert fresh["regional_context"] == original and fresh["foods"][0]["nutrients"]
    assert nutrition_impact(["papa"], None)["foods"] == fresh["foods"]
    assert isinstance(fresh["regional_context"]["population"], str)
    assert all(isinstance(v, str) for v in fresh["regional_context"]["limitations"])
    assert "puntuación económica ni de salud individual" in fresh["explanation"]


@pytest.mark.parametrize("ids,context", [
    ("papa", None), ([""], None), ([7], None), (["papa"], {}),
    (["papa"], {"region": "Lima", "region_code": "15"}),
    (["papa"], {"region": "Arequipa", "region_code": "04", "source_ids": "INVENTADA"}),
    (["papa"], {"region": "Arequipa", "region_code": "04", "source_ids": [None]}),
])
def test_invalid_inputs_fail_explicitly(ids, context):
    with pytest.raises(ValueError):
        nutrition_impact(ids, context)
