from datetime import UTC, datetime, timedelta
import json
from sqlalchemy import select
from ceres.infrastructure.db import models as m
from ceres.infrastructure.llm.fake import FakeLanguageModel
from tests.conftest import register, create_parcel


def add(c, pid, data):
    r = c.post(f"/api/v1/parcels/{pid}/notebook", json={"data": data})
    assert r.status_code == 201, r.text
    return r.json()


def test_campaign_economics_revisions_agenda_and_owner(make_client):
    a,b=make_client(),make_client(); register(a);register(b,"otro-cuaderno@example.com")
    p=create_parcel(a);pid=p["id"]
    campaign=add(a,pid,{"kind":"campana","crop_id":"maiz_grano","area_ha":2,"sowing_date":"2025-01-01","harvest_date":"2025-06-01","yield_kg":16000,"costs_complete":False})
    sale=add(a,pid,{"kind":"venta","date":"2025-06-02","campaign_id":campaign["id"],"quantity_kg":16000,"price_soles_kg":1.5})
    add(a,pid,{"kind":"costo","date":"2025-01-01","campaign_id":campaign["id"],"concept":"Semillas y labores","amount_soles":8000})
    book=a.get(f"/api/v1/parcels/{pid}/notebook").json()
    assert book["campaigns"][0]["margin_soles"] is None # gastos todavía incompletos
    updated={**campaign["data"],"costs_complete":True}
    r=a.put(f"/api/v1/parcels/{pid}/notebook/{campaign['id']}",json={"data":updated,"revision":1})
    assert r.status_code==200
    assert a.put(f"/api/v1/parcels/{pid}/notebook/{campaign['id']}",json={"data":updated,"revision":1}).status_code==409
    history=a.get(f"/api/v1/parcels/{pid}/notebook/{campaign['id']}/history").json()
    assert len(history["items"])==2 and history["items"][0]["data"]["costs_complete"] is False
    run=a.post(f"/api/v1/parcels/{pid}/recommendations",json={}).json()
    assert run["inputs"]["own_economics"]==[{"crop_id":"maiz_grano","yield_t_ha":8.0,"price_soles_kg":1.5,"variable_cost_soles_ha":4000.0}]
    assert "CUADERNO" in json.dumps(run["result"])
    task=add(a,pid,{"kind":"agenda","title":"Revisar turno de riego","due_on":"2026-11-15"})
    assert a.get(f"/api/v1/parcels/{pid}/notebook").json()["agenda"][0]["id"]==task["id"]
    assert b.get(f"/api/v1/parcels/{pid}/notebook").status_code==404
    assert b.put(f"/api/v1/parcels/{pid}/notebook/{sale['id']}",json={"data":sale["data"],"revision":1}).status_code==404
    assert b.get(f"/api/v1/parcels/{pid}/notebook/{sale['id']}/history").status_code==404
    other=create_parcel(b)
    assert b.post(f"/api/v1/parcels/{other['id']}/notebook",json={"data":{"kind":"costo","campaign_id":campaign["id"],"date":"2026-11-15","concept":"Ajeno","amount_soles":1}}).status_code==404


def proposed():
    return {"transcript":"Vendí 1000 kilos a 1.2 soles", "changes":[{"operation":"crear","record_id":None,"revision":None,"data":{"kind":"venta","date":"2026-11-15","quantity_kg":1000,"price_soles_kg":1.2}}]}


def test_text_audio_confirmation_idempotency_and_expiry(make_client):
    llm=FakeLanguageModel(lambda req: proposed())
    c=make_client(llm=llm);register(c);pid=create_parcel(c)["id"]
    response=c.post(f"/api/v1/parcels/{pid}/proposals",json={"text":"Vendí 1000 kg a 1.2"})
    assert response.status_code==201,response.text
    p=response.json(); assert c.get(f"/api/v1/parcels/{pid}/notebook").json()["items"]==[]
    with c.container.sessions() as db:
        assert db.get(m.RecordProposal,p["id"]).data["transcript"]==""
    result=c.post(f"/api/v1/parcels/{pid}/proposals/{p['id']}/confirm",json=p["proposal"])
    assert result.status_code==200,result.text
    assert c.post(f"/api/v1/parcels/{pid}/proposals/{p['id']}/confirm",json=p["proposal"]).json()["already_confirmed"]
    book=c.get(f"/api/v1/parcels/{pid}/notebook").json();assert len(book["items"])==1 and book["items"][0]["origin"]=="declarado_chat_confirmado"
    p=c.post(f"/api/v1/parcels/{pid}/proposals",json={"audio_base64":"dGVzdA==","audio_mime":"audio/webm","duration_seconds":2}).json()
    assert llm.requests[-1].audio==b"test"
    with c.container.sessions() as db:
        row=db.get(m.RecordProposal,p["id"]); row.expires_at=datetime.now(UTC)-timedelta(seconds=1);db.commit()
    assert c.post(f"/api/v1/parcels/{pid}/proposals/{p['id']}/confirm",json=p["proposal"]).status_code==410
    with c.container.sessions() as db: assert db.get(m.RecordProposal,p["id"]).data=={}


def test_confirm_updates_with_revision_and_reject_does_not_write(make_client):
    output=proposed(); llm=FakeLanguageModel(lambda req: output)
    c=make_client(llm=llm);register(c);pid=create_parcel(c)["id"]
    record=add(c,pid,{"kind":"venta","date":"2026-11-15","quantity_kg":500})
    output["changes"]=[{"operation":"actualizar","record_id":record["id"],"revision":1,"data":{**record["data"],"price_soles_kg":2}}]
    p=c.post(f"/api/v1/parcels/{pid}/proposals",json={"text":"corrige el precio a 2"}).json()
    assert c.get(f"/api/v1/parcels/{pid}/notebook").json()["items"][0]["data"]["price_soles_kg"] is None
    assert c.post(f"/api/v1/parcels/{pid}/proposals/{p['id']}/confirm",json=p["proposal"]).status_code==200
    assert c.get(f"/api/v1/parcels/{pid}/notebook").json()["items"][0]["revision"]==2
    p=c.post(f"/api/v1/parcels/{pid}/proposals",json={"text":"otra corrección"}).json()
    assert c.post(f"/api/v1/parcels/{pid}/proposals/{p['id']}/reject").status_code==200
    assert c.post(f"/api/v1/parcels/{pid}/proposals/{p['id']}/confirm",json=p["proposal"]).status_code==409


def test_ceres_memory_and_simulation_use_engine_and_validate_numbers(make_client):
    def responder(req):
        if req.schema and "action" in req.schema["properties"]:
            return {"action":"simular_escenario","scenario":{"allocation_m3":1000}} if "simula" in req.question else {"action":"consultar_cuaderno","scenario":None}
        return {"answer":"Tu venta confirmada fue de 1000 kg a 1.2 soles por kg.","detail":"","metric_ids":[],"source_ids":["CUADERNO"],"assumptions":[],"missing_data":[]}
    llm=FakeLanguageModel(responder);c=make_client(llm=llm);register(c);pid=create_parcel(c)["id"]
    add(c,pid,{"kind":"venta","date":"2026-11-15","quantity_kg":1000,"price_soles_kg":1.2})
    r=c.post(f"/api/v1/parcels/{pid}/ceres",json={"text":"¿Qué vendí?"})
    assert r.status_code==200,r.text
    assert r.json()["status"]=="ok"
    assert "cuaderno_autorizado" in json.loads(llm.requests[-1].context_json)
    r=c.post(f"/api/v1/parcels/{pid}/ceres",json={"text":"simula con 1000 m3 de agua mensual"})
    assert r.status_code==200,r.text
    assert r.json()["tool"]["name"]=="simular_escenario"
    assert r.json()["run"]["inputs"]["profile"]["water"]["allocation_m3"]==1000
    assert c.post(f"/api/v1/parcels/{pid}/ceres",json={"text":"simula menos agua"}).status_code==422


def test_proposal_owner_and_atomic_rollback(make_client):
    output=proposed();a=make_client(llm=FakeLanguageModel(lambda req:output));b=make_client()
    register(a);register(b,"otra-propuesta@example.com")
    pid=create_parcel(a)["id"]
    output["changes"].append({"operation":"crear","record_id":None,"revision":None,"data":{"kind":"costo","date":"2026-11-15","concept":"Gasto ajeno","campaign_id":"f"*32,"amount_soles":10}})
    p=a.post(f"/api/v1/parcels/{pid}/proposals",json={"text":"crear venta y costo"}).json()
    assert b.get(f"/api/v1/parcels/{pid}/proposals").status_code==404
    assert b.post(f"/api/v1/parcels/{pid}/proposals/{p['id']}/confirm",json=p["proposal"]).status_code==404
    assert b.post(f"/api/v1/parcels/{pid}/proposals/{p['id']}/reject").status_code==404
    assert b.post(f"/api/v1/parcels/{pid}/ceres",json={"text":"lee sus registros"}).status_code==404
    assert a.post(f"/api/v1/parcels/{pid}/proposals/{p['id']}/confirm",json=p["proposal"]).status_code==404
    assert a.get(f"/api/v1/parcels/{pid}/notebook").json()["items"]==[]


def test_outside_pilot_keeps_private_history_without_borrowing_zone_assumptions(make_client):
    from tests.conftest import profile
    c=make_client();register(c)
    r=c.post("/api/v1/parcels",json={"name":"Caso privado fuera del piloto","point":{"lat":-12.05,"lon":-77.04},"area_ha":0.04,"area_origin":"supuesto_demo","profile":profile(current_crop_id="papa",current_status="cosechado",expected_harvest=None,data_origin="supuesto_demo",use_zone_defaults=False)})
    assert r.status_code==201,r.text
    p=r.json();assert p["zone_id"] is None and p["area_origin"]=="supuesto_demo"
    real=add(c,p["id"],{"kind":"campana","crop_id":"papa","variety":"Huayro","sowing_date":"2025-08-01","expected_harvest":"2026-03-01"})
    assert real["data"]["area_ha"] is None and real["data"]["harvest_date"] is None
    simulated=add(c,p["id"],{"kind":"agenda","title":"Confirmar estado actual","due_on":"2026-11-16","evidence":"simulado_demo"})
    assert simulated["origin"]=="supuesto_demo"
    book=c.get(f"/api/v1/parcels/{p['id']}/notebook").json()
    assert book["contains_simulated"] and len(book["items"])==2
    run=c.post(f"/api/v1/parcels/{p['id']}/recommendations",json={})
    assert run.status_code==201,run.text
    assert run.json()["inputs"]["zone_id"] is None
    assert run.json()["result"]["climate_snapshot_id"] is None
    assert run.json()["result"]["strategies"]==[]
    assert run.json()["inputs"]["assumed"]==[]
    assert c.get(f"/api/v1/recommendations/{run.json()['id']}/reproduce").json()=={"same_versions":True,"identical":True}
