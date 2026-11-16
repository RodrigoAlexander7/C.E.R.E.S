"""Cuaderno y agenda tipados. Cálculos deterministas; valores ausentes siguen ausentes."""
from datetime import date
from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class RecordFields(Strict):
    evidence: Literal["declarado", "simulado_demo"] = "declarado"


class Campaign(RecordFields):
    kind: Literal["campana"] = "campana"
    crop_id: str = Field(min_length=2, max_length=40)
    variety: str = Field("", max_length=120)
    area_ha: float | None = Field(None, gt=0, le=10000)
    sowing_date: date | None = None
    expected_harvest: date | None = None
    harvest_date: date | None = None
    yield_kg: float | None = Field(None, ge=0, le=1e9)
    costs_complete: bool = False
    note: str = Field("", max_length=500)

    @model_validator(mode="after")
    def dates(self):
        if self.sowing_date and any(d and d < self.sowing_date for d in (self.harvest_date, self.expected_harvest)):
            raise ValueError("La cosecha no puede ser anterior a la siembra")
        return self


class Sale(RecordFields):
    kind: Literal["venta"] = "venta"
    campaign_id: str | None = Field(None, max_length=32)
    date: date
    quantity_kg: float | None = Field(None, ge=0, le=1e9)
    price_soles_kg: float | None = Field(None, ge=0, le=100000)
    buyer: str = Field("", max_length=120)
    note: str = Field("", max_length=500)


class Cost(RecordFields):
    kind: Literal["costo"] = "costo"
    campaign_id: str | None = Field(None, max_length=32)
    date: date
    concept: str = Field(min_length=2, max_length=200)
    amount_soles: float = Field(ge=0, le=1e9)
    note: str = Field("", max_length=500)


class Profit(RecordFields):
    kind: Literal["ganancia"] = "ganancia"
    campaign_id: str | None = Field(None, max_length=32)
    date: date
    amount_soles: float = Field(ge=-1e9, le=1e9)
    note: str = Field("", max_length=500)


class Agenda(RecordFields):
    kind: Literal["agenda"] = "agenda"
    due_on: date
    title: str = Field(min_length=2, max_length=200)
    done: bool = False
    note: str = Field("", max_length=500)


RecordData = Annotated[Union[Campaign, Sale, Cost, Profit, Agenda], Field(discriminator="kind")]


class RecordInput(Strict):
    data: RecordData
    revision: int | None = Field(None, ge=1)


class ProposedChange(Strict):
    operation: Literal["crear", "actualizar"]
    record_id: str | None = Field(None, max_length=32)
    revision: int | None = Field(None, ge=1)
    data: RecordData


class ProposalData(Strict):
    transcript: str = Field(max_length=6000)
    changes: list[ProposedChange] = Field(min_length=1, max_length=20)


RECORD_TYPES = {"campana": Campaign, "venta": Sale, "costo": Cost, "ganancia": Profit, "agenda": Agenda}


def consecutive_crop_history(records: list[dict], current_crop_id: str, today: date) -> dict:
    """Racha mínima comprobable por fechas de siembra; sin sumar duplicados o simulaciones.

    No se equiparan campañas sin fecha con cero ni se infiere que la última campaña
    reemplaza al cultivo declarado. El perfil y el historial se congelan en el run.
    """
    campaigns = [r for r in records if r["data"].get("kind") == "campana"
                 and r["data"].get("evidence", "declarado") != "simulado_demo"
                 and r["data"].get("sowing_date") and r["data"]["sowing_date"] <= today.isoformat()]
    by_date: dict[str, list[dict]] = {}
    for record in campaigns:
        by_date.setdefault(record["data"]["sowing_date"], []).append(record)
    used: list[str] = []
    streak = 0
    for day in sorted(by_date, reverse=True):
        group = by_date[day]
        if {r["data"]["crop_id"] for r in group} != {current_crop_id}:
            break
        streak += 1
        used.extend(r["id"] for r in group)
        if streak == 2:
            break
    return {"streak": streak or None, "record_ids": used, "source_ids": ["CUADERNO"] if used else [],
            "method": "Fechas de siembra distintas de campañas propias confirmadas; simulaciones y fechas futuras excluidas"}


def extraction_schema() -> dict:
    """Contrato de transporte plano para evitar una gramática combinatoria en el LLM.

    El servidor reconstruye el tipo discriminado y valida todos sus rangos después.
    """
    numbers = {"area_ha", "yield_kg", "quantity_kg", "price_soles_kg", "amount_soles"}
    booleans = {"costs_complete", "done"}
    names = sorted({key for model in RECORD_TYPES.values() for key in model.model_fields} - {"kind"})
    fields = {key: {"type": ["number" if key in numbers else "boolean" if key in booleans else "string", "null"]} for key in names}
    fields["kind"] = {"type": "string", "enum": list(RECORD_TYPES)}
    return {"type":"object","additionalProperties":False,"properties":{
        "transcript":{"type":"string"}, "changes":{"type":"array","items":{"type":"object","additionalProperties":False,"properties":{
            "operation":{"type":"string","enum":["crear","actualizar"]},"record_id":{"type":["string","null"]},
            "revision":{"type":["integer","null"]},"data":{"type":"object","additionalProperties":False,"properties":fields,"required":list(fields)}},
            "required":["operation","record_id","revision","data"]}}},"required":["transcript","changes"]}


def parse_extraction(raw: dict) -> ProposalData:
    # Proyección del contrato plano al tipo elegido. Campos de otros tipos no
    # tienen significado aquí (p.ej. amount_soles en venta); nunca se guardan.
    import copy
    if not isinstance(raw, dict) or not isinstance(raw.get("changes"), list):
        raise ValueError("Formato de propuesta incompatible")
    raw = copy.deepcopy(raw)
    for change in raw.get("changes", []):
        if not isinstance(change, dict) or not isinstance(change.get("data"), dict):
            raise ValueError("Cambio incompatible")
        data = change.get("data", {})
        cls = RECORD_TYPES.get(data.get("kind"))
        if cls:
            known = {key for model in RECORD_TYPES.values() for key in model.model_fields}
            change["data"] = {k:v for k,v in data.items() if k in cls.model_fields or k not in known}
            for k,field in cls.model_fields.items():
                if change["data"].get(k, "missing") is None and not field.is_required() and field.default is not None:
                    change["data"].pop(k, None)
    return ProposalData.model_validate(raw)


def summary(records: list[dict], today: date) -> dict:
    campaigns, monthly, review = [], {}, []
    for r in records:
        d = r["data"]
        if d["kind"] == "campana":
            related = [x["data"] for x in records if x["data"].get("campaign_id") == r["id"]]
            sales = [x for x in related if x["kind"] == "venta"]
            costs = [x for x in related if x["kind"] == "costo"]
            revenue = sum(x["quantity_kg"] * x["price_soles_kg"] for x in sales) if sales and all(x["quantity_kg"] is not None and x["price_soles_kg"] is not None for x in sales) else None
            total_cost = sum(x["amount_soles"] for x in costs) if d["costs_complete"] else None
            campaigns.append({"id": r["id"], "crop_id": d["crop_id"], "revenue_soles": revenue,
                "cost_soles": total_cost, "margin_soles": revenue - total_cost if revenue is not None and total_cost is not None else None,
                "declared_profit": [x["amount_soles"] for x in related if x["kind"] == "ganancia"]})
            if d["expected_harvest"] and not d["harvest_date"] and d["expected_harvest"] <= today.isoformat():
                review.append({"record_id": r["id"], "question": "¿Ya cosechaste esta campaña? Registra fecha y cantidad."})
            if not d["costs_complete"]:
                review.append({"record_id": r["id"], "question": "¿Falta registrar algún gasto de esta campaña?"})
        if d["kind"] == "venta" and (d["quantity_kg"] is None or d["price_soles_kg"] is None):
            review.append({"record_id": r["id"], "question": "Falta cantidad o precio de esta venta. ¿Lo recuerdas?"})
        if d.get("date"):
            month = d["date"][:7]
            totals = monthly.setdefault(month, {"month": month, "sales_soles": None, "costs_soles": None, "declared_profit_soles": None})
            key, value = None, None
            if d["kind"] == "costo": key, value = "costs_soles", d["amount_soles"]
            if d["kind"] == "ganancia": key, value = "declared_profit_soles", d["amount_soles"]
            if d["kind"] == "venta" and d["quantity_kg"] is not None and d["price_soles_kg"] is not None:
                key, value = "sales_soles", d["quantity_kg"] * d["price_soles_kg"]
            if key: totals[key] = (totals[key] or 0) + value
    if not any(r["data"]["kind"] == "costo" and r["data"].get("date", "").startswith(today.isoformat()[:7]) for r in records):
        review.append({"record_id": None, "question": "Este mes no registraste gastos. ¿Hubo alguno o aún falta completarlos?"})
    agenda = sorted([r for r in records if r["data"]["kind"] == "agenda" and not r["data"]["done"]], key=lambda r:r["data"]["due_on"])
    past = f"{today.year - 1}-{today.month:02d}"
    return {"contains_simulated": any(r["data"].get("evidence") == "simulado_demo" for r in records), "campaigns": campaigns, "monthly": sorted(monthly.values(), key=lambda x:x["month"], reverse=True),
        "last_year_this_month": monthly.get(past), "review": review, "agenda": agenda}


def economics(records: list[dict], catalog_ids) -> list[dict]:
    records = [r for r in records if r["data"].get("evidence", "declarado") != "simulado_demo"]
    out = {}
    for r in sorted(records, key=lambda r: r["data"].get("harvest_date") or "", reverse=True):
        d = r["data"]
        if d["kind"] != "campana" or not d["harvest_date"] or not d["area_ha"] or d["crop_id"] not in catalog_ids or d["crop_id"] in out:
            continue
        linked = [x["data"] for x in records if x["data"].get("campaign_id") == r["id"]]
        sales = [x for x in linked if x["kind"] == "venta"]
        good_sales = sales and all(x["quantity_kg"] is not None and x["price_soles_kg"] is not None for x in sales)
        kg = sum(x["quantity_kg"] for x in sales) if good_sales else 0
        price = sum(x["quantity_kg"] * x["price_soles_kg"] for x in sales) / kg if kg > 0 else None
        costs = sum(x["amount_soles"] for x in linked if x["kind"] == "costo") if d["costs_complete"] else None
        out[d["crop_id"]] = {"crop_id": d["crop_id"], "yield_t_ha": d["yield_kg"] / 1000 / d["area_ha"] if d["yield_kg"] is not None else None,
            "price_soles_kg": price, "variable_cost_soles_ha": costs / d["area_ha"] if costs is not None else None}
    return list(out.values())
