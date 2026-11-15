"""Comandos de mantenimiento: `uv run python -m ceres.cli <comando>`.

- fetch-nasa: descarga la serie real NASA POWER del piloto (una vez; luego se reutiliza la copia).
- fetch-regions: descarga límites administrativos referenciales (SERFOR/INEI) para la demo.
- seed: carga catálogo, fuentes, fichas y el caso público de demostración en PostgreSQL.
- check-llm: comprueba la configuración del asistente sin imprimir la clave.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date

from ceres.config import get_settings

MAJES_I_POINT = {"lat": -16.35, "lon": -72.19}  # Pampa de Majes (Majes I), cerca de El Pedregal


def cmd_fetch_nasa(args: argparse.Namespace) -> int:
    from ceres.infrastructure.nasa_power import NasaPowerError, fetch_and_store, load_snapshot

    settings = get_settings()
    out = settings.data_dir / settings.nasa_snapshot_file
    try:
        fetch_and_store(
            MAJES_I_POINT["lat"],
            MAJES_I_POINT["lon"],
            date.fromisoformat(args.start),
            date.fromisoformat(args.end),
            out,
        )
        snap = load_snapshot(out)
    except NasaPowerError as exc:
        print(f"ERROR NASA POWER: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(snap.public_summary(), indent=2, ensure_ascii=False))
    return 0


def cmd_fetch_regions(args: argparse.Namespace) -> int:
    from ceres.infrastructure.regions import download_demo_package

    report = download_demo_package(get_settings())
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0


def cmd_seed(args: argparse.Namespace) -> int:
    from ceres.infrastructure.seed import run_seed

    print(json.dumps(run_seed(get_settings()), indent=2, ensure_ascii=False))
    return 0


def cmd_check_llm(args: argparse.Namespace) -> int:
    from ceres.infrastructure.llm.openai_responses import check_connection

    result = check_connection(get_settings())
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0 if result.get("status") == "conectado" else 2


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="ceres")
    sub = parser.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("fetch-nasa")
    p.add_argument("--start", default="2015-01-01")
    p.add_argument("--end", default="2025-12-31")
    p.set_defaults(func=cmd_fetch_nasa)
    sub.add_parser("fetch-regions").set_defaults(func=cmd_fetch_regions)
    sub.add_parser("seed").set_defaults(func=cmd_seed)
    sub.add_parser("check-llm").set_defaults(func=cmd_check_llm)
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
