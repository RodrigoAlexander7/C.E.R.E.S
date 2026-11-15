from tests.conftest import register, create_parcel


def test_ndvi_requires_owner_and_real_polygon(make_client, monkeypatch):
    a, b = make_client(), make_client()
    register(a); register(b, "otra-hls@example.com")
    p = create_parcel(a)
    assert b.get(f"/api/v1/parcels/{p['id']}/ndvi").status_code == 404
    assert b.post(f"/api/v1/parcels/{p['id']}/ndvi/refresh").status_code == 404
    assert a.get(f"/api/v1/parcels/{p['id']}/ndvi").json()["items"] == []
    calls = []
    monkeypatch.setattr("ceres.presentation.ndvi.refresh", lambda *args: calls.append(args))
    assert a.post(f"/api/v1/parcels/{p['id']}/ndvi/refresh").status_code == 202
    assert len(calls) == 1
    assert a.post(f"/api/v1/parcels/{p['id']}/ndvi/refresh").status_code == 409


def test_failed_refresh_can_retry_without_waiting_thirty_minutes(make_client, monkeypatch):
    from datetime import UTC, datetime, timedelta
    from sqlalchemy import select
    from ceres.infrastructure.db import models as m
    c=make_client();register(c);pid=create_parcel(c)["id"]
    monkeypatch.setattr("ceres.presentation.ndvi.refresh", lambda *args: None)
    path=f"/api/v1/parcels/{pid}/ndvi"
    assert c.post(path+"/refresh").status_code==202
    with c.container.sessions() as db:
        j=db.scalar(select(m.NdviJob).where(m.NdviJob.parcel_id==pid))
        j.status="error";j.created_at=datetime.now(UTC)-timedelta(seconds=31);db.commit()
    assert c.get(path).json()["refresh"]["allowed"]
    assert c.post(path+"/refresh").status_code==202
    with c.container.sessions() as db:
        j=db.scalar(select(m.NdviJob).where(m.NdviJob.parcel_id==pid).order_by(m.NdviJob.created_at.desc()))
        j.status="completo";db.commit()
    gate=c.get(path).json()["refresh"]
    assert not gate["allowed"] and 0 < gate["retry_after_seconds"] <= 300
    assert c.post(path+"/refresh").status_code==429


def test_series_explains_no_pixel_centers_and_stale_job_can_retry(make_client):
    from datetime import UTC, date, datetime, timedelta
    from ceres.infrastructure.db import models as m
    from ceres.infrastructure.hls import geometry_hash
    c=make_client();register(c);p=create_parcel(c)
    with c.container.sessions() as db:
        parcel=db.get(m.Parcel,p["id"])
        db.add(m.NdviObservation(owner_id=parcel.owner_id,parcel_id=parcel.id,scene_id="test-no-centers",
            observed_on=date(2026,11,1),geometry_hash=geometry_hash(parcel.geometry),
            data={"ndvi":None,"parcel_pixels":0,"valid_pixels":0,"valid_pct":None}))
        db.add(m.NdviJob(owner_id=parcel.owner_id,parcel_id=parcel.id,status="procesando",created_at=datetime.now(UTC)-timedelta(minutes=31)))
        db.commit()
    d=c.get(f"/api/v1/parcels/{p['id']}/ndvi").json()
    assert d["monthly"]==[] and d["coverage"]=="no_pixel_centers"
    assert d["refresh"]["allowed"] and d["job"]["status"]=="error"


def test_worker_retries_network_failures_and_preserves_other_scenes(make_client, monkeypatch, caplog):
    from datetime import date
    import httpx
    from sqlalchemy import select
    from ceres.infrastructure.db import models as m
    from ceres.presentation.ndvi import refresh
    c=make_client();register(c);p=create_parcel(c)
    with c.container.sessions() as db:
        parcel=db.get(m.Parcel,p["id"])
        job=m.NdviJob(owner_id=parcel.owner_id,parcel_id=parcel.id)
        db.add(job);db.commit();jid=job.id
    calls={"first":0,"second":0}
    def read(item,geometry):
        key=item["id"];calls[key]+=1
        if key=="first" and calls[key]==1: raise httpx.ReadTimeout("url-con-token-privado")
        if key=="second": raise ValueError("url-con-token-privado")
        return {"observed_on":"2026-11-01","ndvi":None,"parcel_pixels":0,"valid_pixels":0,"valid_pct":None}
    monkeypatch.setattr("ceres.presentation.ndvi.scenes",lambda *a:[{"id":"first"},{"id":"second"}])
    monkeypatch.setattr("ceres.presentation.ndvi.observe",read)
    monkeypatch.setattr("ceres.presentation.ndvi.time.sleep",lambda *a:None)
    refresh(c.container,jid,p["geometry"],date(2026,11,1),date(2026,11,15))
    assert calls=={"first":2,"second":1} and "token-privado" not in caplog.text
    with c.container.sessions() as db:
        assert db.get(m.NdviJob,jid).status=="error"
        assert len(list(db.scalars(select(m.NdviObservation).where(m.NdviObservation.parcel_id==p["id"]))))==1


def test_public_demo_contains_real_cached_hls_with_provenance(make_client):
    from ceres.infrastructure.seed import run_seed
    c=make_client()
    run_seed(c.container.settings)
    for zone in ("majes","chilina"):
        r=c.get("/api/v1/public/ndvi",params={"zone":zone})
        assert r.status_code==200
        data=r.json();assert len(data["monthly"])>=3
        assert all(len(i["sample_sha256"])==64 and i["source_url"].startswith("https://planetarycomputer.microsoft.com/") for i in data["items"])
        # Los ejemplos están sobre lotes con cultivo (verificados con HLS), no sobre suelo pelado.
        assert sum(1 for mth in data["monthly"] if mth["ndvi"] > 0.3) >= 3


def test_seed_moves_existing_demo_to_new_outline(make_client):
    """En producción el lote demo ya existe: si el contorno de zona.json cambia, el seed lo actualiza."""
    from ceres.infrastructure.db import models as m
    from ceres.infrastructure.seed import run_seed
    c=make_client()
    run_seed(c.container.settings)
    with c.container.sessions() as db:
        demo=db.query(m.Parcel).filter(m.Parcel.is_public_demo.is_(True), m.Parcel.zone_id=="majes").one()
        good=demo.geometry
        demo.geometry={"type":"Polygon","coordinates":[[[-72.1911,-16.3510],[-72.1890,-16.3510],[-72.1890,-16.3490],[-72.1911,-16.3490],[-72.1911,-16.3510]]]}
        db.commit()
    report=run_seed(c.container.settings)
    assert report["zones"]["majes"].get("demo_geometry_updated") is True
    with c.container.sessions() as db:
        demo=db.query(m.Parcel).filter(m.Parcel.is_public_demo.is_(True), m.Parcel.zone_id=="majes").one()
        assert demo.geometry==good
    data=c.get("/api/v1/public/ndvi",params={"zone":"majes"}).json()
    assert min(mth["ndvi"] for mth in data["monthly"]) > 0.3
