"""Carga reproducible en una cuenta propia. Los archivos de entrada deben permanecer fuera de Git.

Uso: python scripts/cargar_demo_privada.py --url https://... --credentials ../../demo-private/credentials.json --data ../../demo-private/caso.json
No imprime coordenadas, contraseñas ni el contenido del cuaderno.
"""
import argparse
import json
from pathlib import Path
import httpx


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--url",required=True)
    parser.add_argument("--credentials",type=Path,required=True)
    parser.add_argument("--data",type=Path,required=True)
    args=parser.parse_args()
    credentials=json.loads(args.credentials.read_text()); case=json.loads(args.data.read_text())
    with httpx.Client(base_url=args.url.rstrip("/")+"/api/v1/",headers={"Origin":args.url.rstrip("/")},timeout=60) as client:
        r=client.post("auth/register",json=credentials)
        if r.status_code==409: r=client.post("auth/login",json=credentials)
        r.raise_for_status();client.headers["X-CSRF-Token"]=r.json()["csrf_token"]
        existing=client.get("parcels").json()["items"]
        for entry in case["parcels"]:
            parcel=next((p for p in existing if p["name"]==entry["parcel"]["name"]),None)
            if parcel is None:
                r=client.post("parcels",json=entry["parcel"]);r.raise_for_status();parcel=r.json()
            pid=parcel["id"]
            stored=client.get(f"parcels/{pid}/notebook").json()["items"]
            aliases={}
            for rec in entry["records"]:
                payload=dict(rec["data"])
                if payload.get("campaign_id") in aliases:payload["campaign_id"]=aliases[payload["campaign_id"]]
                marker=f"[demo:{rec['key']}]"
                old=next((r for r in stored if marker in r["data"].get("note","")),None)
                if old:
                    aliases[rec["key"]]=old["id"];continue
                payload["note"]=(payload.get("note","")+" "+marker).strip()
                r=client.post(f"parcels/{pid}/notebook",json={"data":payload});r.raise_for_status();aliases[rec["key"]]=r.json()["id"]
            r=client.post(f"parcels/{pid}/recommendations",json={});r.raise_for_status()
            print("Parcela privada preparada:",pid,"registros:",len(client.get(f"parcels/{pid}/notebook").json()["items"]))
        print("Cuenta demo privada lista. Credenciales conservadas en el archivo indicado, sin publicarlas.")


if __name__=="__main__":main()
