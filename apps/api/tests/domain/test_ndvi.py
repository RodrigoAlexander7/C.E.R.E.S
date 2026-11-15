"""Matrices sintéticas solo para verificar máscara/fórmula; nunca evidencia satelital."""
import numpy as np
from ceres.infrastructure.hls import ndvi_stats


def test_ndvi_masks_cloud_shadow_adjacent_snow_water_aerosol_and_fill():
    red = np.array([1000] * 9)
    nir = np.array([3000] * 9)
    quality = np.array([0, 2, 4, 8, 16, 32, 192, 255, 0], dtype="uint8")
    inside = np.array([True] * 8 + [False])
    d = ndvi_stats(red, nir, quality, inside)
    assert d["ndvi"] == .5 and d["valid_pixels"] == 1 and d["parcel_pixels"] == 8


def test_no_clear_pixels_and_zero_denominator_remain_unknown():
    for quality in (np.array([2]), np.array([0])):
        d = ndvi_stats(np.array([0]), np.array([0]), quality, np.array([True]))
        assert d["ndvi"] is None and d["valid_pixels"] == 0
