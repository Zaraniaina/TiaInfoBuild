"""Core: background tasks (alertes, rappels)."""
import asyncio
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alerte import Alerte
from app.core.permissions import Role

__all__ = ["check_overdue_invoices", "check_low_stock", "check_maintenance_due"]


async def check_overdue_invoices(db: AsyncSession, entreprise_id: int) -> None:
    """Crée des alertes pour les factures en retard."""
    pass


async def check_low_stock(db: AsyncSession, entreprise_id: int) -> None:
    """Crée des alertes pour les articles sous seuil."""
    pass


async def check_maintenance_due(db: AsyncSession, entreprise_id: int) -> None:
    """Crée des alertes pour les maintenances à venir."""
    pass


async def run_scheduler_checks(db: AsyncSession, entreprise_id: int) -> None:
    """Exécute toutes les vérifications planifiées."""
    await check_overdue_invoices(db, entreprise_id)
    await check_low_stock(db, entreprise_id)
    await check_maintenance_due(db, entreprise_id)
