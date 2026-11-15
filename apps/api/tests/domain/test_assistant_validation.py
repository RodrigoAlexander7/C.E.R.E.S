from ceres.application.assistant import AssistantContext, extract_numbers, validate_answer


def test_number_formats():
    assert extract_numbers("S/ 27,000 y 0,85 y 1.234,5 y 12 000 m³") == [27000, 0.85, 1234.5, 12000]


def ctx():
    return AssistantContext(payload={}, metric_values={"A.eco.margen": 27000.0}, source_ids={"NASA-POWER"}, allowed_numbers={27000.0, 27.0})


def answer(**kw):
    d = {"answer": "Margen de S/ 27 000.", "detail": "", "metric_ids": ["A.eco.margen"], "source_ids": ["NASA-POWER"], "assumptions": [], "missing_data": []}
    d.update(kw)
    return d


def test_valid():
    assert validate_answer(answer(), ctx()).ok


def test_rejects_links_unknown_ids_and_numbers():
    assert not validate_answer(answer(answer="ver https://x.org"), ctx()).ok
    assert not validate_answer(answer(source_ids=["X"]), ctx()).ok
    assert not validate_answer(answer(metric_ids=["B.x"]), ctx()).ok
    assert not validate_answer(answer(answer="Ahorrarás 4 500 m³"), ctx()).ok


def test_requires_citation_or_missing():
    assert not validate_answer(answer(source_ids=[], metric_ids=[]), ctx()).ok
    assert validate_answer(answer(answer="Falta la dotación.", source_ids=[], metric_ids=[], missing_data=["dotación"]), ctx()).ok
