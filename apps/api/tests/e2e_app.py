"""Servidor exclusivo Playwright. Proveedor simulado, sin claves ni llamadas LLM reales.

No se importa en producción; CI arranca explícitamente tests.e2e_app:app.
"""
import json
from ceres.bootstrap import build_container
from ceres.config import get_settings
from ceres.infrastructure.llm.fake import FakeLanguageModel
from ceres.presentation.app import create_app


def responder(req):
    if req.schema and "action" in req.schema.get("properties", {}):
        if "simula" in req.question.lower():
            return {"action":"simular_escenario","scenario":{"allocation_m3":1000}}
        return {"action":"consultar_cuaderno","scenario":None}
    if req.schema and "changes" in req.schema.get("properties", {}):
        return {"transcript":req.question,"changes":[
            {"operation":"crear","record_id":None,"revision":None,"data":{"kind":"campana","crop_id":"maiz_grano","area_ha":1,"harvest_date":"2026-11-15","yield_kg":4000}},
            {"operation":"crear","record_id":None,"revision":None,"data":{"kind":"venta","campaign_id":"nuevo:0","date":"2026-11-15","quantity_kg":1000,"price_soles_kg":1.2}}]}
    ctx=json.loads(req.context_json)
    rows=ctx.get("cuaderno_autorizado",{}).get("registros",[])
    sale=next((r for r in rows if r["data"]["kind"]=="venta"),None)
    if sale:
        d=sale["data"]
        answer=f"Recuerdo tu venta confirmada: {d['quantity_kg']:g} kg a {d['price_soles_kg']:g} soles por kg."
        source="CUADERNO"
    else:
        answer,source="Revisa el agua de tu chacra.","MOTOR"
    return {"answer":answer,"detail":"","metric_ids":[],"source_ids":[source],"assumptions":[],"missing_data":[]}


settings=get_settings().model_copy(update={"gemini_api_key":None,"gemini_model":None,"openai_api_key":None,"openai_model":None})
app=create_app(build_container(settings,llm=FakeLanguageModel(responder)))
