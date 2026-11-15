"""zonas piloto: la parcela guarda su zona (data/zonas/)

Revision ID: b7c1d2e3f405
Revises: 8446e4a6cfa1
Create Date: 2026-11-15 12:00:00

Aditiva: la versión anterior de la API ignora la columna (compatible con rollback de imágenes).
Las parcelas ya marcadas como zona piloto pertenecían a Majes I, la única zona hasta ahora.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "b7c1d2e3f405"
down_revision: Union[str, Sequence[str], None] = "8446e4a6cfa1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("parcels", sa.Column("zone_id", sa.String(length=30), nullable=True))
    op.execute("UPDATE parcels SET zone_id = 'majes' WHERE in_pilot_zone")


def downgrade() -> None:
    op.drop_column("parcels", "zone_id")
