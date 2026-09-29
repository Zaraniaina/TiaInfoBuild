/**
 * Export CSV côté client : génère un fichier à partir de lignes d'objets
 * et déclenche le téléchargement. Utilisé par les exports super-admin.
 */
export function downloadCsv(
  filename: string,
  rows: Array<Record<string, unknown>>,
  columns?: string[],
) {
  if (!rows.length) return;
  const cols = columns ?? Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv =
    '\uFEFF' + // BOM : accents corrects dans Excel
    [cols.join(';'), ...rows.map((r) => cols.map((c) => esc(r[c])).join(';'))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
