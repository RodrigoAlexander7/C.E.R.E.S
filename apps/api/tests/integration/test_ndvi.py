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
    assert a.post(f"/api/v1/parcels/{p['id']}/ndvi/refresh").status_code == 429


def test_public_demo_contains_real_cached_hls_with_provenance(make_client):
    from ceres.infrastructure.seed import run_seed
    c=make_client()
    run_seed(c.container.settings)
    for zone in ("majes","chilina"):
        r=c.get("/api/v1/public/ndvi",params={"zone":zone})
        assert r.status_code==200
        data=r.json();assert len(data["monthly"])>=3
        assert all(len(i["sample_sha256"])==64 and i["source_url"].startswith("https://planetarycomputer.microsoft.com/") for i in data["items"])
