"""Carga validada de la instantánea JSON SIEN-HIS; solo biblioteca estándar.

El XLSX se usa para auditoría fuera del servidor. Si acompaña al JSON se
verifican sus bytes; si falta, se declara explícitamente que no se verificó.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from pathlib import Path

from ceres.domain.nutrition import HIS_SOURCE_ID


class NutritionDataError(ValueError):
    """Instantánea incompleta, incoherente o con procedencia inválida."""


# Contrato v1: cada indicador conserva exactamente su hoja y celdas de Arequipa.
_EN = "EN 12-17a x REGION"
_ANEMIA = "Anemia 12-17a x REGION"
_CELLS = {
    "talla_edad_normal": (_EN, "D11", "C11", "E11"),
    "talla_baja": (_EN, "F11", "C11", "G11"),
    "talla_alta": (_EN, "H11", "C11", "I11"),
    "peso_talla_normal": (_EN, "K11", "J11", "L11"),
    "delgadez": (_EN, "M11", "J11", "N11"),
    "sobrepeso": (_EN, "O11", "J11", "P11"),
    "obesidad": (_EN, "Q11", "J11", "R11"),
    "anemia_total": (_ANEMIA, "D10", "C10", "E10"),
    "sin_anemia": (_ANEMIA, "F10", "C10", "G10"),
    "anemia_leve": (_ANEMIA, "H10", "C10", "I10"),
    "anemia_moderada": (_ANEMIA, "J10", "C10", "K10"),
    "anemia_severa": (_ANEMIA, "L10", "C10", "M10"),
}
_METADATA_CELLS = {
    _EN: {
        "headers": {"C5", "J5", "C6", "J6", "D6", "F6", "H6", "K6", "M6", "O6", "Q6", "D7", "E7"},
        "notes": {"B35", "B37"},
    },
    _ANEMIA: {
        "headers": {"B5", "C5", "D5", "F5", "H5", "J5", "L5", "D6", "E6"},
        "notes": {"B34", "B35"},
    },
}


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise NutritionDataError(message)


def _fields(value: object, expected: set[str]) -> None:
    _require(isinstance(value, dict) and set(value) == expected, "Campos incompletos o ajenos al contexto agregado v1")


def _text(value: object) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _unique_object(pairs: list[tuple[str, object]]) -> dict:
    result = {}
    for key, value in pairs:
        _require(key not in result, "El JSON contiene claves duplicadas")
        result[key] = value
    return result


def _invalid_constant(value: str) -> None:
    raise NutritionDataError("El JSON contiene un número no finito")


def _validate(data: dict) -> None:
    _fields(data, {
        "schema_version", "region", "region_code", "geography_basis", "period", "population",
        "kind", "source_ids", "source", "sheets", "indicators", "limitations",
    })
    _require(type(data["schema_version"]) is int and data["schema_version"] == 1, "Versión nutricional no soportada")
    _require(data["region"] == "Arequipa" and data["region_code"] == "04", "Solo se admite Arequipa (04)")
    _require(data["kind"] == "contexto_vigilancia_humana", "El contexto debe ser vigilancia humana")
    _require(data["source_ids"] == [HIS_SOURCE_ID] and data["source"]["id"] == HIS_SOURCE_ID, "Fuente HIS no válida")
    source = data["source"]
    _fields(source, {
        "id", "institution", "title", "filename", "sha256", "bytes", "url", "url_status",
        "reviewed_on", "cover_cells",
    })
    _require(bool(re.fullmatch(r"[0-9a-f]{64}", source["sha256"])), "SHA256 del XLSX no válido")
    filename = source["filename"]
    _require(
        filename == Path(filename).name and "/" not in filename and "\\" not in filename
        and filename.endswith(".xlsx"), "El XLSX debe ser un nombre local sin directorios",
    )
    _require(type(source["bytes"]) is int and source["bytes"] > 0, "Tamaño del XLSX no válido")
    _require(all(_text(source[k]) for k in ("institution", "title", "reviewed_on", "url_status")), "Faltan metadatos de fuente")
    _fields(source["cover_cells"], {"INICIO!C6", "INICIO!C8"})
    _require(all(_text(v) for v in source["cover_cells"].values()), "Portada inválida")
    _require(source["url"] is None or source["url"].startswith("https://"), "URL de fuente no válida")
    _require(data["period"] == {
        "start": "2026-01-01", "end": "2026-08-31", "label": "ENERO A AGOSTO - 2026",
    }, "El periodo v1 debe ser enero-agosto de 2026")
    _require(
        _text(data["population"]) and _text(data["geography_basis"])
        and isinstance(data["limitations"], list) and bool(data["limitations"])
        and all(_text(v) for v in data["limitations"]), "Faltan población o límites HIS",
    )
    _require(isinstance(data["sheets"], list), "Las hojas deben ser una lista")
    for sheet in data["sheets"]:
        _fields(sheet, {"name", "region_cell", "period_cell", "period_raw", "headers", "cells", "notes"})
    sheets = {s["name"]: s for s in data["sheets"]}
    _require(len(data["sheets"]) == 2 and set(sheets) == {_EN, _ANEMIA}, "Solo se admiten las dos hojas REGION")
    for name, row in ((_EN, 11), (_ANEMIA, 10)):
        sheet = sheets[name]
        _require(sheet["region_cell"] == f"B{row}" and sheet["cells"][f"B{row}"] == "AREQUIPA", "Fila ajena a Arequipa")
        _require(sheet["period_cell"] == "B3" and sheet["period_raw"] == "PERIODO: ENERO A AGOSTO - 2026", "Periodo de hoja incorrecto")
        for field, expected in _METADATA_CELLS[name].items():
            _fields(sheet[field], expected)
            _require(all(_text(v) for v in sheet[field].values()), "Metadatos de hoja inválidos")
        allowed = {f"B{row}"} | {cell for spec in _CELLS.values() if spec[0] == name for cell in spec[1:]}
        _fields(sheet["cells"], allowed)
        _require(all(_text(v) for v in sheet["cells"].values()), "Celdas originales inválidas")

    indicators = data["indicators"]
    _require(isinstance(indicators, list), "Los indicadores deben ser una lista")
    for indicator in indicators:
        _fields(indicator, {
            "id", "label", "sheet", "count", "count_cell", "denominator", "denominator_cell",
            "percent", "percent_cell", "count_unit", "percent_unit",
        })
    _require(len(indicators) == len(_CELLS) and {i["id"] for i in indicators} == set(_CELLS), "Indicadores incompletos o duplicados")
    for indicator in indicators:
        name, count_cell, denominator_cell, percent_cell = _CELLS[indicator["id"]]
        _require(
            (indicator["sheet"], indicator["count_cell"], indicator["denominator_cell"], indicator["percent_cell"])
            == (name, count_cell, denominator_cell, percent_cell), "Procedencia de indicador incorrecta",
        )
        count, denominator, percent = (indicator[k] for k in ("count", "denominator", "percent"))
        _require(type(count) is int and type(denominator) is int and 0 <= count <= denominator and denominator > 0, "Recuento o denominador no válido; desconocido no equivale a cero")
        _require(type(percent) in (int, float) and math.isfinite(percent) and 0 <= percent <= 100, "Porcentaje no válido")
        cells = sheets[name]["cells"]
        _require(
            str(count) == cells[count_cell] and str(denominator) == cells[denominator_cell]
            and math.isclose(percent, float(cells[percent_cell]), abs_tol=1e-12, rel_tol=0),
            "Los valores no coinciden con las celdas originales",
        )
        _require(math.isclose(percent, count / denominator * 100, abs_tol=1e-10, rel_tol=0), "Porcentaje incompatible con su denominador")
        percent_unit = (
            "% de evaluados para anemia" if name == _ANEMIA else
            "% de evaluados para talla/edad" if denominator_cell == "C11" else
            "% de evaluados para peso/talla según rótulo del libro"
        )
        _require(indicator["count_unit"] == "evaluados" and indicator["percent_unit"] == percent_unit, "Unidades incorrectas para el denominador")
        _require(_text(indicator["label"]), "Indicador sin etiqueta")
    by_id = {i["id"]: i for i in indicators}
    for members in (
        ("talla_edad_normal", "talla_baja", "talla_alta"),
        ("peso_talla_normal", "delgadez", "sobrepeso", "obesidad"),
        ("anemia_total", "sin_anemia"),
    ):
        _require(sum(by_id[i]["count"] for i in members) == by_id[members[0]]["denominator"], "Las categorías no reconcilian con los evaluados")
    _require(sum(by_id[i]["count"] for i in ("anemia_leve", "anemia_moderada", "anemia_severa")) == by_id["anemia_total"]["count"], "Las severidades no reconcilian con anemia total")


def load_nutrition(path: Path) -> dict:
    """Carga sin red ni openpyxl; falla ante datos inválidos, nunca fabrica ceros.

    Devuelve el JSON más integrity={json_sha256, workbook_sha256_verified}.
    El SHA del JSON identifica sus bytes para congelarlos en el run; no es una
    firma ni acredita autenticidad. La verificación XLSX requiere la copia local.
    No hay caché mutable compartida entre llamadas.
    """
    try:
        raw = path.read_bytes()
        data = json.loads(raw, object_pairs_hook=_unique_object, parse_constant=_invalid_constant)
        _require(isinstance(data, dict), "La instantánea debe ser un objeto JSON")
        _validate(data)
        workbook = path.parent / data["source"]["filename"]
        verified = False
        if workbook.exists():
            workbook_bytes = workbook.read_bytes()
            _require(
                hashlib.sha256(workbook_bytes).hexdigest() == data["source"]["sha256"]
                and len(workbook_bytes) == data["source"]["bytes"], "El hash o tamaño del XLSX no coincide",
            )
            verified = True
        data["integrity"] = {"json_sha256": hashlib.sha256(raw).hexdigest(), "workbook_sha256_verified": verified}
        return data
    except NutritionDataError:
        raise
    except (OSError, ValueError, KeyError, TypeError, AttributeError, OverflowError) as exc:
        raise NutritionDataError("No se pudo cargar el contexto nutricional: archivo o estructura inválidos") from exc
