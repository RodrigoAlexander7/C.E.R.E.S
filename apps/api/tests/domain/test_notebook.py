from datetime import date
import pytest
from pydantic import ValidationError
from ceres.domain.notebook import RecordInput, summary, economics, parse_extraction, extraction_schema
from ceres.application.ports import provider_schema


def test_provider_schema_preserves_record_title_and_strict_payload_validation():
    schema=provider_schema(extraction_schema())
    fields=schema["properties"]["changes"]["items"]["properties"]["data"]["properties"]
    assert "title" in fields and "title" in schema["properties"]["changes"]["items"]["properties"]["data"]["required"]
    raw={"transcript":"vendí","changes":[{"operation":"crear","record_id":None,"revision":None,"data":{"kind":"venta","date":"2026-11-15","quantity_kg":1000,"price_soles_kg":1.2,"amount_soles":1200,"note":None,"buyer":None}}]}
    value=parse_extraction(raw)
    assert value.changes[0].data.quantity_kg==1000 and not hasattr(value.changes[0].data,"amount_soles")
    raw["changes"][0]["data"]["quantity_kg"]=-1
    with pytest.raises(ValidationError): parse_extraction(raw)


def test_dates_finite_amounts_and_unknowns():
    with pytest.raises(ValidationError): RecordInput(data={"kind":"campana","crop_id":"papa","area_ha":1,"sowing_date":"2026-11-15","harvest_date":"2026-01-01"})
    with pytest.raises(ValidationError): RecordInput(data={"kind":"costo","date":"2026-11-15","concept":"Gasto","amount_soles":float("nan")})
    result=summary([],date(2026,11,15))
    assert result["last_year_this_month"] is None and result["review"]


def test_unknown_area_and_simulated_evidence_never_become_own_economics():
    campaign=RecordInput(data={"kind":"campana","crop_id":"papa","variety":"Ejemplo","harvest_date":"2026-10-01","yield_kg":400,"costs_complete":True}).data.model_dump(mode="json")
    rows=[{"id":"campana","data":campaign}]
    assert economics(rows,{"papa"})==[]
    rows[0]["data"].update(area_ha=1,evidence="simulado_demo")
    assert summary(rows,date(2026,11,15))["contains_simulated"]
    assert economics(rows,{"papa"})==[]
    rows[0]["data"]["evidence"]="declarado"
    rows.append({"id":"venta","data":RecordInput(data={"kind":"venta","campaign_id":"campana","date":"2026-10-02","quantity_kg":400,"price_soles_kg":3,"evidence":"simulado_demo"}).data.model_dump(mode="json")})
    assert economics(rows,{"papa"})[0]["price_soles_kg"] is None
