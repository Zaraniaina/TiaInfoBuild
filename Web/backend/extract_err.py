"""Extrait les lignes d'erreur de la trace UTF-16."""
import re

with open("diag-login.txt", "r", encoding="utf-16") as f:
    lines = f.readlines()

out = []
for i, line in enumerate(lines):
    s = line.rstrip("\n")
    if re.search(r"Error|Exception|raise|error:", s, re.IGNORECASE):
        out.append(f"{i+1}: {s}")

with open("diag-err.txt", "w", encoding="utf-8") as f:
    f.write(f"TOTAL {len(lines)} lignes\n")
    f.write("\n".join(out[-30:]))