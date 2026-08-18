"""Core: import CSV helper."""
import csv
import io
from typing import Any


__all__ = ["parse_csv"]


def parse_csv(content: bytes, delimiter: str = ";") -> list[dict[str, str]]:
    """Parse un fichier CSV en liste de dictionnaires."""
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    return [dict(row) for row in reader if any(v.strip() for v in row.values())]
