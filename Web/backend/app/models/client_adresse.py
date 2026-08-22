from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Boolean, DateTime, Date, ForeignKey, UniqueConstraint, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ClientAdresse(Base):
    __tablename__ = "client_adresses"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    defaut: Mapped[bool] = mapped_column(Boolean, server_default="0")
    ligne1: Mapped[str] = mapped_column(String(255), nullable=False)
    ligne2: Mapped[str | None] = mapped_column(String(255))
    code_postal: Mapped[str | None] = mapped_column(String(20))
    ville: Mapped[str | None] = mapped_column(String(100))
    pays: Mapped[str] = mapped_column(String(100), server_default="Madagascar")
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("client_id", "type", name="uq_client_adresses_client_type"),
        Index("idx_client_adresses_client_id", "client_id"),
    )

    client: Mapped["Client"] = relationship("Client", back_populates="adresses", lazy="selectin")
