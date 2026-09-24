from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SyncApplied(Base):
    """Table de déduplication de la synchronisation desktop (POST /api/sync/push).

    Chaque changement poussé par un poste porte un couple (device_id, seq) ;
    s'il est déjà présent ici, il est ignoré (compté dans `skipped`) afin de
    rendre le push idempotent (reprise après coupure réseau, double envoi).

    Note : device_id est VARCHAR(128) et non TEXT — MySQL/MariaDB refusent une
    colonne TEXT en clé primaire sans longueur de préfixe (erreur 1170).
    """

    __tablename__ = "sync_applied"

    device_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    seq: Mapped[int] = mapped_column(Integer, primary_key=True)
    applied_at: Mapped[str] = mapped_column(Text, nullable=False)
