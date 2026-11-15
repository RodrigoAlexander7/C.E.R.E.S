"""Validación explícita de extracción, confirmación, memoria y herramienta con Gemini real.

Se ejecuta manualmente; nunca desde pytest/CI. Usa PostgreSQL de desarrollo y no imprime claves.
"""
import secrets
from fastapi.testclient import TestClient
from ceres.bootstrap import build_container
from ceres.config import get_settings
from ceres.presentation.app import create_app


def main():
    origin="http://testserver"
    c=build_container(get_settings().model_copy(update={"app_origin":origin,"dev_insecure_cookies":True}))
    if not c.llm.configured: raise SystemExit("IA no conectada")
    client=TestClient(create_app(c),base_url=origin,headers={"Origin":origin})
    r=client.post("/api/v1/auth/register",json={"email":f"ceres-real-{secrets.token_hex(5)}@ceres.test","password":secrets.token_urlsafe(20)})
    assert r.status_code==201,r.text
    client.headers["X-CSRF-Token"]=r.json()["csrf_token"]
    p=client.post("/api/v1/parcels",json={"name":"Validación Ceres real","point":{"lat":-16.35,"lon":-72.19},"area_ha":1,"profile":{"current_crop_id":"maiz_grano","current_status":"cosechado","water":{"mode":"no_se"},"soil":{},"priority":"equilibrada"}})
    assert p.status_code==201,p.text
    pid=p.json()["id"]
    proposal=client.post(f"/api/v1/parcels/{pid}/proposals",json={"text":"Vendí 1000 kilos de maíz a 1.2 soles por kilo el 15 de noviembre de 2026."})
    print("extracción",proposal.status_code)
    assert proposal.status_code==201,proposal.text
    d=proposal.json();print(d["proposal"])
    assert client.get(f"/api/v1/parcels/{pid}/notebook").json()["items"]==[]
    saved=client.post(f"/api/v1/parcels/{pid}/proposals/{d['id']}/confirm",json=d["proposal"])
    assert saved.status_code==200,saved.text
    for question in ("¿Qué cantidad vendí y a qué precio?","Simula con 1000 m3 de agua mensual"):
        answer=client.post(f"/api/v1/parcels/{pid}/ceres",json={"text":question})
        print("Ceres",answer.status_code,answer.json().get("status"),answer.json().get("answer"),answer.json().get("tool"))
        assert answer.status_code==200,answer.text
        assert answer.json()["status"]=="ok",answer.text
        if "Simula" in question: assert answer.json()["tool"]["name"]=="simular_escenario"
    print("Validación real de Ceres completada")


if __name__=="__main__": main()
