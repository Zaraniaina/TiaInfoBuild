"""Core: génération PDF (ReportLab)."""
from io import BytesIO
from typing import Any

from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet

__all__ = ["generate_pdf"]


def generate_pdf(title: str, headers: list[str], rows: list[dict[str, Any]]) -> bytes:
    """Génère un PDF simple avec un tableau."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    elements = [Paragraph(title, styles["Title"])]

    data = [headers]
    for row in rows:
        data.append([str(row.get(h, "")) for h in headers])

    table = Table(data)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#003366")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 12),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 12),
        ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#f2f2f2")),
        ("GRID", (0, 0), (-1, -1), 1, colors.grey),
    ]))
    elements.append(table)
    doc.build(elements)
    return buffer.getvalue()
