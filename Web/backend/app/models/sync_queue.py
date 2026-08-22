from datetime import datetime

from sqlalchemy import BigInteger, String, Text, Boolean, DateTime, ForeignKey, Index, func, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SyncQueue(Base):
    __tablename__ = "sync_queue"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    table_name: Mapped[str] = mapped_column(String(100), nullable=False)
    record_id: Mapped[int] = mapped_column(Integer, nullable=False)
    server_id: Mapped[int | None] = mapped_column(Integer)
    operation: Mapped[str] = mapped_column(String(20), nullable=False)
    payload: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), server_default="pending")
    retry_count: Mapped[int] = mapped_column(Integer, server_default="0")
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("idx_sync_queue_status", "status"),
    )
