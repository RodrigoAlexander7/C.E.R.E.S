"""Comandos de mantenimiento: `uv run python -m ceres.cli <comando>`.

- fetch-nasa --zone <zona>: descarga la serie real NASA POWER de una zona piloto (una vez; luego se reutiliza la copia).
- fetch-oni: descarga el índice ONI de NOAA CPC (fases El Niño/La Niña) con hash.
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

def cmd_fetch_nasa(args: argparse.Namespace) -> int:
    """Descarga la serie de la zona indicada en el punto `center` de su zona.json."""
    from ceres.infrastructure.nasa_power import NasaPowerError, fetch_and_store, load_snapshot

    settings = get_settings()
    zdir = settings.data_dir / "zonas" / args.zone
    zone = json.loads((zdir / "zona.json").read_text())
    out = zdir / zone["nasa"]["file"]
    try:
        fetch_and_store(
            zone["center"]["lat"],
            zone["center"]["lon"],
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


def cmd_fetch_oni(args: argparse.Namespace) -> int:
    from ceres.infrastructure.noaa_oni import OniError, fetch_and_store, load_oni

    out = get_settings().data_dir / "noaa" / "oni.ascii.txt"
    try:
        fetch_and_store(out)
        snap = load_oni(out)
    except OniError as exc:
        print(f"ERROR NOAA ONI: {exc}", file=sys.stderr)
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
    from ceres.infrastructure.llm.factory import check_connection

    result = check_connection(get_settings())
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0 if result.get("status") == "conectado" else 2


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="ceres")
    sub = parser.add_subparsers(dest="cmd", required=True)
    nd = sub.add_parser("ndvi")
    nd.add_argument("--parcel", required=True)
    nd.add_argument("--start", default="2025-01-01")
    nd.add_argument("--end", default="2025-12-31")
    nd.set_defaults(func=cmd_ndvi)
    p = sub.add_parser("fetch-nasa")
    p.add_argument("--start", default="2015-01-01")
    p.add_argument("--end", default="2025-12-31")
    p.add_argument("--zone", default="majes", help="zona de data/zonas/ (usa su punto center)")
    p.set_defaults(func=cmd_fetch_nasa)
    sub.add_parser("fetch-regions").set_defaults(func=cmd_fetch_regions)
    sub.add_parser("fetch-oni").set_defaults(func=cmd_fetch_oni)
    sub.add_parser("seed").set_defaults(func=cmd_seed)
    sub.add_parser("check-llm").set_defaults(func=cmd_check_llm)
    args = parser.parse_args(argv)
    return args.func(args)


def cmd_ndvi(args):
    from ceres.bootstrap import build_container
    from ceres.infrastructure.db import models as m
    from ceres.presentation.ndvi import refresh
    c = build_container()
    with c.sessions() as db:
        p = db.get(m.Parcel, args.parcel)
        if not p or not p.geometry:
            print("La parcela necesita un contorno")
            return 1
        job = m.NdviJob(owner_id=p.owner_id, parcel_id=p.id)
        db.add(job)
        db.commit()
        jid, geom = job.id, p.geometry
    refresh(c, jid, geom, date.fromisoformat(args.start), date.fromisoformat(args.end))
    with c.sessions() as db:
        j = db.get(m.NdviJob, jid)
        print(json.dumps({"status": j.status, "detail": j.detail}))
        return 0 if j.status == "completo" else 1


if __name__ == "__main__":
    raise SystemExit(main())
