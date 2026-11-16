"""Audita la extracción regional mediante ZIP/XML. Solo lee y escribe en stdout.

Uso desde la raíz: python data/nutricion/reproduce.py --check
No usa openpyxl y no lee ninguna otra carpeta de datos.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import posixpath
import xml.etree.ElementTree as ET
from zipfile import ZipFile

_NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
_REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"


def extract(path: Path, context: dict) -> dict:
    """Reextrae únicamente celdas declaradas y filas etiquetadas AREQUIPA.

    La selección no usa la posición de una región ni incluye totales MINSA.
    Una fórmula solo se lee a través de su valor guardado; no se recalcula Excel.
    """
    raw = path.read_bytes()
    with ZipFile(path) as archive:
        strings = [
            "".join(node.itertext())
            for node in ET.fromstring(archive.read("xl/sharedStrings.xml")).findall("m:si", _NS)
        ]
        targets = {
            node.attrib["Id"]: posixpath.normpath("xl/" + node.attrib["Target"])
            for node in ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        }
        sheets = {
            node.attrib["name"]: targets[node.attrib[_REL]]
            for node in ET.fromstring(archive.read("xl/workbook.xml")).findall("m:sheets/m:sheet", _NS)
        }

        def read_cells(name: str) -> dict[str, str]:
            result = {}
            for cell in ET.fromstring(archive.read(sheets[name])).findall("m:sheetData/m:row/m:c", _NS):
                value = cell.find("m:v", _NS)
                inline = cell.find("m:is", _NS)
                if value is not None:
                    text = strings[int(value.text)] if cell.attrib.get("t") == "s" else value.text
                elif inline is not None:
                    text = "".join(inline.itertext())
                else:
                    continue
                result[cell.attrib["r"]] = text
            return result

        cover = read_cells("INICIO")
        result = {
            "source": {
                "sha256": hashlib.sha256(raw).hexdigest(),
                "bytes": len(raw),
                "cover_cells": {ref: cover[ref.split("!", 1)[1]] for ref in context["source"]["cover_cells"]},
            },
            "sheets": [],
        }
        for declared in context["sheets"]:
            if declared["name"] not in {"EN 12-17a x REGION", "Anemia 12-17a x REGION"}:
                raise ValueError("Solo se auditan las hojas REGION")
            cells = read_cells(declared["name"])
            matches = [ref for ref, value in cells.items() if value == "AREQUIPA" and ref.startswith("B")]
            if matches != [declared["region_cell"]]:
                raise ValueError("La fila no corresponde inequívocamente a AREQUIPA")
            result["sheets"].append({
                "name": declared["name"],
                "region_cell": declared["region_cell"],
                "period_cell": declared["period_cell"],
                "period_raw": cells[declared["period_cell"]],
                "headers": {ref: cells[ref] for ref in declared["headers"]},
                "cells": {ref: cells[ref] for ref in declared["cells"]},
                "notes": {ref: cells[ref] for ref in declared["notes"]},
            })
        return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Compara la extracción con el JSON versionado")
    args = parser.parse_args()
    folder = Path(__file__).resolve().parent
    context = json.loads((folder / "arequipa_context.json").read_text(encoding="utf-8"))
    actual = extract(folder / context["source"]["filename"], context)
    if args.check:
        expected = {
            "source": {key: context["source"][key] for key in ("sha256", "bytes", "cover_cells")},
            "sheets": context["sheets"],
        }
        if actual != expected:
            raise SystemExit("ERROR: la extracción no coincide con el XLSX")
        print("OK: hash, tamaño, portada, filas de Arequipa, periodos, encabezados y notas coinciden")
    else:
        print(json.dumps(actual, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
