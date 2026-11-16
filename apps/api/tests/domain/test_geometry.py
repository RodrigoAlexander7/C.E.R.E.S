"""El área usada en dinero y agua no depende de la orientación del contorno."""

from copy import deepcopy

import pytest

from ceres.infrastructure.geometry import GeometryError, geodesic_area_ha


def test_holes_are_subtracted_even_when_drawn_in_the_same_direction():
    outer = [[-72.192, -16.352], [-72.188, -16.352], [-72.188, -16.348], [-72.192, -16.348], [-72.192, -16.352]]
    hole = [[-72.191, -16.351], [-72.189, -16.351], [-72.189, -16.349], [-72.191, -16.349], [-72.191, -16.351]]
    polygon = {"type": "Polygon", "coordinates": [outer, hole]}
    expected = geodesic_area_ha({"type": "Polygon", "coordinates": [outer]}) - geodesic_area_ha({"type": "Polygon", "coordinates": [hole]})
    original = deepcopy(polygon)
    assert geodesic_area_ha(polygon) == pytest.approx(expected)
    assert polygon == original
    polygon["coordinates"] = [ring[::-1] for ring in polygon["coordinates"]]
    assert geodesic_area_ha(polygon) == pytest.approx(expected)


@pytest.mark.parametrize("ring", [None, [0, 1, 2, 3], [[0, 0], [1, 0], [1, 1], [True, 0]], [[0, 0], [1, 0], [1, 1], [0, 1]]])
def test_bad_coordinate_shapes_never_reach_area_calculation(ring):
    with pytest.raises(GeometryError):
        geodesic_area_ha({"type": "Polygon", "coordinates": [ring]})
