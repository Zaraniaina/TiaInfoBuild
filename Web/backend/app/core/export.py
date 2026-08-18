"""Core: export CSV helper."""
import csv
import io
from datetime import date, datetime
from decimal import Decimal
from typing import Any


__all__ = ["export_csv"]


def _serialize(value: Any) -> str:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if value is None:
        return ""
    return str(value)


def export_csv(headers: list[str], rows: list[dict[str, Any]]) -> bytes:
    """Génère un fichier CSV encodé en UTF-8 BOM."""
    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=headers,
        quoting=csv.QUOTE_MINIMAL,
    )
    writer.writeheader()
    for row in rows:
        writer.writerow({h: _serialize(row.get(h)) for h in headers})
    return ("\ufeff" + output.getvalue()).encode("utf-8-sig")
