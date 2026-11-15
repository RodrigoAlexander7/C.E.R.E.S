"""API HTTP de CERES (FastAPI). Presentación: autorización, validación y serialización; sin reglas agronómicas."""

from __future__ import annotations

import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session as DbSession

from ceres.application.assistant import answer_question, build_context
from ceres.application.recommendations import apply_scenario, evaluate_frozen, frozen_inputs
from ceres.bootstrap import Container, build_container
from ceres.domain.engine import ENGINE_VERSION
from ceres.domain.model import InvalidInput
from ceres.infrastructure.db import models as m
from ceres.infrastructure.db.repositories import ParcelRepo, PublicRepo, SessionRepo, UserRepo
from ceres.infrastructure.geometry import GeometryError, centroid, geodesic_area_ha, validate_polygon
from ceres.infrastructure.regions import PILOT_DISTRICT, PILOT_NOTE, RegionsUnavailable
from ceres.infrastructure.security import hash_password, new_token, token_hash, verify_password
from ceres.presentation import serializers as ser
from ceres.presentation.deps import (
    ApiError,
    Auth,
    check_origin,
    container,
    get_db,
    not_found,
    optional_auth,
    parcel_repo,
    require_auth,
)
from ceres.presentation.schemas import (
    AreaRequest,
    ConversationCreate,
    CropEventCreate,
    Credentials,
    ManagementCreate,
    MessageCreate,
    ParcelCreate,
    ParcelPatch,
    QuickCompare,
    RevisionCreate,
    RunCreate,
    SoilCreate,
)

log = logging.getLogger("ceres")
LIMA = ZoneInfo("America/Lima")


def lima_today():
    return datetime.now(LIMA).date()


def _today(c: Container):
    return c.extra.get("today", lima_today)()


public = APIRouter(prefix="/api/v1")
private = APIRouter(prefix="/api/v1")


# ------------------------------------------------------------------ públicos


@public.get("/health")
def health(response: Response, c: Container = Depends(container), db: DbSession = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False
        response.status_code = 503  # el healthcheck del contenedor debe fallar sin base de datos
    return {
        "status": "ok" if db_ok else "degradado",
        "revision": c.settings.ceres_revision,
        "database": db_ok,
        "nasa_snapshot": c.snapshot.snapshot_id if c.snapshot else None,
        "llm_configured": c.llm.configured,
        "engine_version": ENGINE_VERSION,
        "catalog_version": c.catalog.version,
    }


@public.get("/regions")
def regions(c: Container = Depends(container)):
    try:
        return {"items": c.regions.departments(), "pilot_note": PILOT_NOTE}
    except RegionsUnavailable as exc:
        raise ApiError(503, "limites_no_disponibles", str(exc))


@public.get("/regions/{region_id}/children")
def region_children(region_id: str, c: Container = Depends(container)):
    try:
        return {"items": c.regions.children(region_id), "pilot_note": PILOT_NOTE}
    except KeyError:
        raise not_found()
    except RegionsUnavailable as exc:
        raise ApiError(503, "limites_no_disponibles", f"{exc}. Puedes seguir delimitando tu terreno en el mapa.")


@public.get("/regions/locate")
def region_locate(lat: float, lon: float, c: Container = Depends(container)):
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise ApiError(422, "coordenadas_invalidas", "Coordenadas fuera de rango")
    d = c.regions.locate_point(lat, lon)
    return {"district": d, "in_pilot_zone": bool(d and d["code"] == PILOT_DISTRICT)}


@public.post("/geometry/area")
def geometry_area(body: AreaRequest, c: Container = Depends(container)):
    try:
        area = geodesic_area_ha(body.geometry)
    except GeometryError as exc:
        raise ApiError(422, "geometria_invalida", str(exc))
    ctr = centroid(body.geometry)
    d = c.regions.locate_point(ctr["lat"], ctr["lon"])
    return {
        "area_ha": round(area, 4),
        "method": "Área geodésica WGS84 (pyproj.Geod) del polígono dibujado",
        "centroid": ctr,
        "district": d,
        "in_pilot_zone": bool(d and d["code"] == PILOT_DISTRICT),
    }


@public.get("/public/context")
def public_context(c: Container = Depends(container)):
    return {
        "pilot_note": PILOT_NOTE,
        "nasa": c.snapshot.public_summary() if c.snapshot else None,
        "nasa_error": c.nasa_error,
        "monthly_climatology": c.climatology,
        "climatology_note": "Promedios 2015–2025 de la celda NASA POWER; ET0 FAO-56 calculada por CERES. Histórico, no pronóstico.",
    }


@public.get("/catalog")
def catalog(c: Container = Depends(container)):
    cat = c.catalog
    return {
        "version": cat.version,
        "crops": [
            {
                "id": cr.id,
                "name": cr.name,
                "family": cr.family,
                "is_legume": cr.is_legume,
                "cycle_days": cr.cycle_days,
                "stage_days": list(cr.stage_days),
                "kc": {"ini": cr.kc_ini, "mid": cr.kc_mid, "end": cr.kc_end},
                "kc_note": cr.kc_note,
                "windows": [w.label() for w in cr.windows],
                "window_status": cr.window_status,
                "salinity": {"threshold": cr.salinity_ece_threshold, "ece_50": cr.salinity_ece_50},
                "economics": {
                    "yield_t_ha": cr.economics.yield_t_ha,
                    "price_soles_kg": cr.economics.price_soles_kg,
                    "variable_cost_soles_ha": cr.economics.variable_cost_soles_ha,
                    "status": cr.economics.status,
                    "price_label": cr.economics.price_label,
                },
            }
            for cr in cat.crops.values()
        ],
        "other_crops": cat.non_catalog_crops,
        "associations": [
            {"id": a.id, "name": a.name, "structure": a.structure, "status": a.status, "known": list(a.known), "missing": list(a.missing), "warning": a.warning, "source_ids": list(a.source_ids)}
            for a in cat.associations
        ],
        "templates": [{"id": t.id, "name": t.name, "rationale": t.rationale, "source_ids": list(t.source_ids)} for t in cat.templates],
    }


@public.get("/sources")
def sources(db: DbSession = Depends(get_db), auth: Auth | None = Depends(optional_auth)):
    items = PublicRepo(db).sources(auth.user_id if auth else None)
    return {"items": sorted(items.values(), key=lambda s: s["id"])}


@public.get("/sources/{source_id}")
def source(source_id: str, db: DbSession = Depends(get_db), auth: Auth | None = Depends(optional_auth)):
    s = PublicRepo(db).source(source_id, auth.user_id if auth else None)
    if s is None:
        raise not_found()
    return s


@public.get("/public/demo")
def public_demo(db: DbSession = Depends(get_db)):
    repo = PublicRepo(db)
    p = repo.demo_parcel()
    if p is None:
        raise ApiError(404, "demo_no_cargada", "El caso de demostración no está cargado (ejecuta el seed)")
    run = repo.latest_run(p.id)
    return {
        "parcel": ser.parcel(p),
        "run": ser.run_full(run, p.active_revision_id) if run else None,
        "note": "Caso público de demostración con supuestos etiquetados; no corresponde a una parcela ni entrevista real.",
    }


@public.get("/public/zone")
def public_zone(c: Container = Depends(container)):
    return c.zone


@public.post("/public/quick-compare")
def quick_compare(body: QuickCompare, request: Request, c: Container = Depends(container)):
    """Comparación del modo sencillo SIN cuenta: no guarda nada (R15). Zona piloto Majes I."""
    if c.quick_limiter and not c.quick_limiter.hit(request.client.host if request.client else "?"):
        raise ApiError(429, "demasiadas_consultas", "Demasiadas consultas seguidas; espera un momento")
    profile = body.profile.model_dump(mode="json")
    inputs = frozen_inputs(profile, body.area_ha, True, _today(c), c.zone)
    try:
        result = evaluate_frozen(inputs, c.catalog, c.climate)
    except InvalidInput as exc:
        raise ApiError(422, "entrada_invalida", str(exc))
    return {
        "inputs": inputs,
        "result": result.to_dict(),
        "dataset_snapshot_id": result.climate_snapshot_id,
        "note": "Consulta no guardada. Inicia sesión para guardar tu parcela, su historial y preguntarle a la IA.",
    }


@public.get("/assistant/status")
def assistant_status(c: Container = Depends(container)):
    return {"configured": c.llm.configured, "model": c.llm.model_name, "label": "IA conectada" if c.llm.configured else "IA no conectada"}


# ------------------------------------------------------------------ autenticación


def _start_session(response: Response, db: DbSession, c: Container, user: m.User) -> dict:
    token, csrf = new_token(), new_token()
    SessionRepo(db).create(user.id, token_hash(token), token_hash(csrf), c.settings.session_ttl_hours)
    secure = not c.settings.dev_insecure_cookies
    max_age = c.settings.session_ttl_hours * 3600
    response.set_cookie(c.settings.session_cookie_name, token, max_age=max_age, httponly=True, secure=secure, samesite="lax", path="/")
    response.set_cookie(c.settings.csrf_cookie_name, csrf, max_age=max_age, httponly=False, secure=secure, samesite="strict", path="/")
    return {"user": {"id": user.id, "email": user.email}, "csrf_token": csrf}


@public.post("/auth/register", status_code=201, dependencies=[Depends(check_origin)])
def register(body: Credentials, response: Response, c: Container = Depends(container), db: DbSession = Depends(get_db)):
    users = UserRepo(db)
    if users.by_email(body.email):
        raise ApiError(409, "email_registrado", "Ese email ya tiene una cuenta; inicia sesión")
    user = users.create(body.email, hash_password(body.password))
    return _start_session(response, db, c, user)


@public.post("/auth/login", dependencies=[Depends(check_origin)])
def login(body: Credentials, request: Request, response: Response, c: Container = Depends(container), db: DbSession = Depends(get_db)):
    key = f"{body.email}|{request.client.host if request.client else '?'}"
    if not c.login_limiter.hit(key):
        raise ApiError(429, "demasiados_intentos", "Demasiados intentos. Espera unos minutos.")
    user = UserRepo(db).by_email(body.email)
    if not verify_password(body.password, user.password_hash if user else None) or user is None:
        raise ApiError(401, "credenciales_invalidas", "Email o contraseña incorrectos")
    c.login_limiter.reset(key)
    return _start_session(response, db, c, user)


@private.post("/auth/logout")
def logout(response: Response, auth: Auth = Depends(require_auth), db: DbSession = Depends(get_db), c: Container = Depends(container)):
    SessionRepo(db).revoke(db.merge(auth.session))
    response.delete_cookie(c.settings.session_cookie_name, path="/")
    response.delete_cookie(c.settings.csrf_cookie_name, path="/")
    return {"ok": True}


@private.get("/me")
def me(auth: Auth = Depends(require_auth)):
    return {"user": {"id": auth.user.id, "email": auth.user.email}, "active_parcel_id": auth.user.active_parcel_id}


# ------------------------------------------------------------------ parcelas


def _get_parcel(repo: ParcelRepo, parcel_id: str) -> m.Parcel:
    p = repo.get(parcel_id)
    if p is None:
        raise not_found()
    return p


@private.get("/parcels")
def list_parcels(repo: ParcelRepo = Depends(parcel_repo), auth: Auth = Depends(require_auth)):
    return {"items": [ser.parcel(p, p.id == auth.user.active_parcel_id) for p in repo.list()], "active_parcel_id": auth.user.active_parcel_id}


@private.post("/parcels", status_code=201)
def create_parcel(body: ParcelCreate, repo: ParcelRepo = Depends(parcel_repo), auth: Auth = Depends(require_auth), c: Container = Depends(container), db: DbSession = Depends(get_db)):
    geometry, point = None, None
    if body.geometry is not None:
        try:
            validate_polygon(body.geometry)
            area = geodesic_area_ha(body.geometry)
        except GeometryError as exc:
            raise ApiError(422, "geometria_invalida", str(exc))
        geometry, origin = body.geometry, "geodesica"
        point = centroid(body.geometry)
        if body.area_ha is not None and abs(body.area_ha - area) / area > 0.2:
            raise ApiError(422, "area_inconsistente", "El área declarada difiere mucho de la del polígono dibujado")
    elif body.point is not None and body.area_ha is not None:
        point, area, origin = body.point.model_dump(), body.area_ha, "declarada"
    else:
        raise ApiError(422, "terreno_incompleto", "Dibuja el terreno o indica su ubicación y área. Un punto GPS no delimita la parcela.")
    district = c.regions.locate_point(point["lat"], point["lon"])
    in_pilot = bool(district and district["code"] == PILOT_DISTRICT)
    region_codes = (
        {"district_code": district["code"], "district_name": district["name"], "provider": district["provenance"]["provider"], "source_update": district["provenance"]["source_update"]}
        if district
        else {"note": "Fuera de los distritos precargados"}
    )
    parcel = repo.add(
        m.Parcel(name=body.name, geometry=geometry, point=point, area_ha=round(area, 4), area_origin=origin, region_codes=region_codes, in_pilot_zone=in_pilot)
    )
    profile = body.profile.model_dump(mode="json")
    repo.add_revision(parcel, profile, "Perfil inicial")
    repo.add_event(
        m.CropEvent(parcel_id=parcel.id, crop_id=profile["current_crop_id"], status=profile["current_status"], expected_harvest=body.profile.expected_harvest, origin="declarado")
    )
    db.merge(auth.user).active_parcel_id = parcel.id
    return ser.parcel(parcel, True)


@private.get("/parcels/{parcel_id}")
def get_parcel(parcel_id: str, repo: ParcelRepo = Depends(parcel_repo), auth: Auth = Depends(require_auth)):
    p = _get_parcel(repo, parcel_id)
    rev = repo.revision(p.active_revision_id) if p.active_revision_id else None
    return {
        **ser.parcel(p, p.id == auth.user.active_parcel_id),
        "profile": ser.revision(rev) if rev else None,
        "crop_events": [ser.crop_event(e) for e in repo.crop_events(p.id)],
        "soil_observations": [ser.soil(o) for o in repo.soil(p.id)],
        "management": [ser.management(r) for r in repo.management(p.id)],
    }


@private.patch("/parcels/{parcel_id}")
def patch_parcel(parcel_id: str, body: ParcelPatch, repo: ParcelRepo = Depends(parcel_repo)):
    p = _get_parcel(repo, parcel_id)
    p.name = body.name
    return ser.parcel(p)


@private.delete("/parcels/{parcel_id}")
def delete_parcel(parcel_id: str, repo: ParcelRepo = Depends(parcel_repo), auth: Auth = Depends(require_auth), db: DbSession = Depends(get_db)):
    p = _get_parcel(repo, parcel_id)
    repo.soft_delete(p)
    user = db.merge(auth.user)
    if user.active_parcel_id == p.id:
        user.active_parcel_id = None
    return {"ok": True, "policy": "Eliminación lógica: la parcela y sus resultados dejan de ser accesibles."}


@private.post("/parcels/{parcel_id}/activate")
def activate_parcel(parcel_id: str, repo: ParcelRepo = Depends(parcel_repo), auth: Auth = Depends(require_auth), db: DbSession = Depends(get_db)):
    p = _get_parcel(repo, parcel_id)
    db.merge(auth.user).active_parcel_id = p.id
    return {"active_parcel_id": p.id}


@private.get("/parcels/{parcel_id}/profile-revisions")
def list_revisions(parcel_id: str, repo: ParcelRepo = Depends(parcel_repo)):
    p = _get_parcel(repo, parcel_id)
    return {"items": [ser.revision(r) for r in repo.revisions(p.id)], "active_revision_id": p.active_revision_id}


@private.post("/parcels/{parcel_id}/profile-revisions", status_code=201)
def add_revision(parcel_id: str, body: RevisionCreate, repo: ParcelRepo = Depends(parcel_repo)):
    p = _get_parcel(repo, parcel_id)
    rev = repo.add_revision(p, body.profile.model_dump(mode="json"), body.note)
    return ser.revision(rev)


@private.get("/parcels/{parcel_id}/crop-events")
def list_events(parcel_id: str, repo: ParcelRepo = Depends(parcel_repo)):
    p = _get_parcel(repo, parcel_id)
    return {"items": [ser.crop_event(e) for e in repo.crop_events(p.id)]}


@private.post("/parcels/{parcel_id}/crop-events", status_code=201)
def add_event(parcel_id: str, body: CropEventCreate, repo: ParcelRepo = Depends(parcel_repo)):
    p = _get_parcel(repo, parcel_id)
    if body.supersedes_id and body.supersedes_id not in {e.id for e in repo.crop_events(p.id)}:
        raise not_found()
    if body.status == "cosechado" and body.actual_harvest is None:
        raise ApiError(422, "fecha_cosecha", "Indica la fecha real de cosecha")
    ev = repo.add_event(m.CropEvent(parcel_id=p.id, origin="declarado", **body.model_dump()))
    rev = repo.revision(p.active_revision_id) if p.active_revision_id else None
    new_rev = None
    if rev:
        prof = dict(rev.data)
        if body.status == "cosechado" and body.crop_id == prof.get("current_crop_id") and prof.get("current_status") == "en_campo":
            prof.update(current_status="cosechado", expected_harvest=None)
            new_rev = repo.add_revision(p, prof, f"Cosecha registrada el {body.actual_harvest.isoformat()}")
        elif body.status == "en_campo":
            prof.update(current_crop_id=body.crop_id, current_status="en_campo", expected_harvest=body.expected_harvest.isoformat() if body.expected_harvest else None, planned_next_crop_id=None)
            new_rev = repo.add_revision(p, prof, "Nuevo cultivo en campo")
    return {"event": ser.crop_event(ev), "new_revision": ser.revision(new_rev) if new_rev else None}


@private.get("/parcels/{parcel_id}/soil-observations")
def list_soil(parcel_id: str, repo: ParcelRepo = Depends(parcel_repo)):
    p = _get_parcel(repo, parcel_id)
    return {"items": [ser.soil(o) for o in repo.soil(p.id)]}


@private.post("/parcels/{parcel_id}/soil-observations", status_code=201)
def add_soil(parcel_id: str, body: SoilCreate, repo: ParcelRepo = Depends(parcel_repo)):
    p = _get_parcel(repo, parcel_id)
    params = {}
    for key, unit in (("ece_ds_m", "dS/m"), ("ph", "pH"), ("organic_matter_pct", "%")):
        v = getattr(body, key)
        if v is not None:
            params[key] = {"value": v, "unit": unit}
    if not params:
        raise ApiError(422, "analisis_vacio", "Registra al menos un parámetro medido")
    obs = repo.add_soil(m.SoilObservation(parcel_id=p.id, sampled_on=body.sampled_on, depth_cm=body.depth_cm, method=body.method, lab=body.lab, parameters=params, origin=body.origin))
    rev = repo.revision(p.active_revision_id)
    prof = dict(rev.data)
    prof["soil"] = {
        **{k: (params[k]["value"] if k in params else None) for k in ("ece_ds_m", "ph", "organic_matter_pct")},
        "analysis_date": body.sampled_on.isoformat(),
        "depth_cm": body.depth_cm,
        "method": body.method,
        "kind": body.origin,
    }
    new_rev = repo.add_revision(p, prof, f"Análisis de suelo del {body.sampled_on.isoformat()}")
    return {"observation": ser.soil(obs), "new_revision": ser.revision(new_rev)}


@private.get("/parcels/{parcel_id}/management")
def list_management(parcel_id: str, repo: ParcelRepo = Depends(parcel_repo)):
    p = _get_parcel(repo, parcel_id)
    return {"items": [ser.management(r) for r in repo.management(p.id)]}


@private.post("/parcels/{parcel_id}/management", status_code=201)
def add_management(parcel_id: str, body: ManagementCreate, repo: ParcelRepo = Depends(parcel_repo)):
    p = _get_parcel(repo, parcel_id)
    rec = repo.add_management(m.ManagementRecord(parcel_id=p.id, origin="declarado", **body.model_dump()))
    return ser.management(rec)


# ------------------------------------------------------------------ resultados


def create_run(c: Container, repo: ParcelRepo, p: m.Parcel, scenario: dict | None) -> m.RecommendationRun:
    rev = repo.revision(p.active_revision_id) if p.active_revision_id else None
    if rev is None:
        raise ApiError(409, "perfil_incompleto", "Completa el perfil de la parcela antes de comparar")
    profile, label = apply_scenario(rev.data, scenario)
    inputs = frozen_inputs(profile, p.area_ha, p.in_pilot_zone, _today(c), c.zone)
    try:
        result = evaluate_frozen(inputs, c.catalog, c.climate)
    except InvalidInput as exc:
        raise ApiError(422, "entrada_invalida", str(exc))
    data = result.to_dict()
    run = m.RecommendationRun(
        parcel_id=p.id,
        revision_id=rev.id,
        inputs=inputs,
        scenario_label=label,
        engine_version=result.engine_version,
        catalog_version=result.catalog_version,
        dataset_snapshot_id=result.climate_snapshot_id,
        dataset_sha256=c.snapshot.sha256 if (c.snapshot and result.climate_snapshot_id) else None,
        result=data,
    )
    run.assessments = [m.StrategyAssessmentRow(strategy_id=s["strategy_id"], status=s["status"], rank=s["rank"], data=s) for s in data["strategies"]]
    return repo.add_run(run)


@private.post("/parcels/{parcel_id}/recommendations", status_code=201)
def new_run(parcel_id: str, body: RunCreate, repo: ParcelRepo = Depends(parcel_repo), c: Container = Depends(container)):
    p = _get_parcel(repo, parcel_id)
    run = create_run(c, repo, p, body.scenario.model_dump(mode="json", exclude_none=True) if body.scenario else None)
    return ser.run_full(run, p.active_revision_id)


@private.get("/parcels/{parcel_id}/recommendations")
def list_runs(parcel_id: str, repo: ParcelRepo = Depends(parcel_repo)):
    p = _get_parcel(repo, parcel_id)
    return {"items": [ser.run_summary(r) for r in repo.runs(p.id)], "active_revision_id": p.active_revision_id}


@private.get("/recommendations/{run_id}")
def get_run(run_id: str, repo: ParcelRepo = Depends(parcel_repo)):
    r = repo.run(run_id)
    if r is None:
        raise not_found()
    p = repo.get(r.parcel_id)
    return ser.run_full(r, p.active_revision_id if p else None)


@private.get("/recommendations/{run_id}/reproduce")
def reproduce_run(run_id: str, repo: ParcelRepo = Depends(parcel_repo), c: Container = Depends(container)):
    r = repo.run(run_id)
    if r is None:
        raise not_found()
    same_versions = r.catalog_version == c.catalog.version and r.dataset_snapshot_id == c.climate.snapshot_id and r.engine_version == ENGINE_VERSION
    again = evaluate_frozen(r.inputs, c.catalog, c.climate).to_dict()
    return {"same_versions": same_versions, "identical": again == r.result}


# ------------------------------------------------------------------ asistente


def _run_dict(r: m.RecommendationRun) -> dict:
    return {"id": r.id, "created_at": ser.iso(r.created_at), "scenario_label": r.scenario_label, "result": r.result, "inputs": r.inputs}


@private.post("/parcels/{parcel_id}/conversations", status_code=201)
def new_conversation(parcel_id: str, body: ConversationCreate, repo: ParcelRepo = Depends(parcel_repo)):
    p = _get_parcel(repo, parcel_id)
    r = repo.run(body.run_id)
    if r is None or r.parcel_id != p.id:
        raise not_found()
    conv = repo.add_conversation(m.Conversation(parcel_id=p.id, run_id=r.id))
    return {"id": conv.id, "parcel_id": p.id, "run_id": r.id, "messages": []}


@private.get("/parcels/{parcel_id}/conversations")
def list_conversations(parcel_id: str, repo: ParcelRepo = Depends(parcel_repo)):
    p = _get_parcel(repo, parcel_id)
    return {"items": [{"id": cv.id, "run_id": cv.run_id, "created_at": ser.iso(cv.created_at)} for cv in repo.conversations(p.id)]}


@private.get("/conversations/{conv_id}")
def get_conversation(conv_id: str, repo: ParcelRepo = Depends(parcel_repo)):
    conv = repo.conversation(conv_id)
    if conv is None:
        raise not_found()
    return {"id": conv.id, "parcel_id": conv.parcel_id, "run_id": conv.run_id, "messages": [ser.message(x) for x in repo.messages(conv.id)]}


@private.post("/conversations/{conv_id}/messages", status_code=201)
def ask(conv_id: str, body: MessageCreate, repo: ParcelRepo = Depends(parcel_repo), auth: Auth = Depends(require_auth), c: Container = Depends(container), db: DbSession = Depends(get_db)):
    conv = repo.conversation(conv_id)
    if conv is None:
        raise not_found()
    run = repo.run(conv.run_id)
    parcel = repo.get(conv.parcel_id)
    if run is None or parcel is None:
        raise not_found()
    if not c.chat_limiter.hit(auth.user_id):
        raise ApiError(429, "demasiadas_preguntas", "Has hecho muchas preguntas seguidas; espera un momento")
    pub = PublicRepo(db)
    fragments = pub.search_fragments(body.question, auth.user_id, limit=5)
    sources = pub.sources(auth.user_id)
    profile = run.inputs["profile"]
    parcel_summary = {
        "area_ha": parcel.area_ha,
        "area_origen": parcel.area_origin,
        "zona_piloto": parcel.in_pilot_zone,
        "distrito": parcel.region_codes.get("district_name"),
        "perfil_usado": {k: profile.get(k) for k in ("current_crop_id", "current_status", "expected_harvest", "planned_next_crop_id", "water", "soil", "priority", "budget_soles", "residue_management")},
    }
    history = [{"role": x.role, "content": x.content} for x in repo.messages(conv.id)][-6:]
    ctx = build_context(_run_dict(run), parcel_summary, fragments, sources, parcel.active_revision_id != run.revision_id)
    ans = answer_question(c.llm, ctx, body.question, history, _run_dict(run), fragments)
    repo.add_message(m.Message(conversation_id=conv.id, role="user", content=body.question, payload={}))
    resolved = [sources[s] for s in ans.source_ids if s in sources]
    msg = repo.add_message(
        m.Message(
            conversation_id=conv.id,
            role="assistant",
            content=ans.content,
            provider_status=ans.status,
            payload={
                "detail": ans.detail,
                "metric_ids": ans.metric_ids,
                "sources": resolved,
                "assumptions": ans.assumptions,
                "missing_data": ans.missing_data,
                "model": ans.model,
                "validation_problems": ans.validation_problems,
                "fragments": [{"id": f["id"], "source_id": f["source_id"], "title": f["title"], "text": f["text"]} for f in ans.fragments],
                "profile_changed": ans.profile_changed,
                "run_id": run.id,
            },
        )
    )
    return ser.message(msg)


# ------------------------------------------------------------------ app


def create_app(c: Container | None = None) -> FastAPI:
    app = FastAPI(title="CERES Majes API", version="0.1.0", docs_url="/api/docs", openapi_url="/api/openapi.json")
    app.state.container = c or build_container()

    @app.exception_handler(ApiError)
    async def api_error(_: Request, exc: ApiError):
        return JSONResponse({"error": {"code": exc.code, "message": exc.message}}, status_code=exc.status)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError):
        details = [{"field": ".".join(str(x) for x in e["loc"][1:]), "message": e["msg"]} for e in exc.errors()]
        return JSONResponse({"error": {"code": "datos_invalidos", "message": "Revisa los datos ingresados", "details": details}}, status_code=422)

    @app.middleware("http")
    async def no_store(request: Request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/api/v1"):
            # Respuestas privadas y dependientes de sesión: nunca en cachés compartidas.
            response.headers.setdefault("Cache-Control", "no-store")
            response.headers.setdefault("Vary", "Cookie")
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        return response

    app.include_router(public)
    app.include_router(private)
    return app
