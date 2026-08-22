from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Boolean, Numeric, DateTime, Date, Time, ForeignKey, UniqueConstraint, Index, func, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    nom: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    code: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    permissions: Mapped[dict | None] = mapped_column(JSON, server_default="{}")
    is_system: Mapped[bool] = mapped_column(Boolean, server_default="0")
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("code", name="uq_roles_code"),
        Index("idx_roles_code", "code"),
    )

    utilisateurs: Mapped[list["Utilisateur"]] = relationship("Utilisateur", back_populates="role", lazy="selectin")
