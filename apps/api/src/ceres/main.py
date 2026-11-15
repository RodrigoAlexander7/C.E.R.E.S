"""Entrada ASGI: `uv run uvicorn ceres.main:app`."""

import logging

from ceres.presentation.app import create_app

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
app = create_app()
