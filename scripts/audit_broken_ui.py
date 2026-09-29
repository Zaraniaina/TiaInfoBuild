"""Audit « code logique + interfaces non fonctionnelles », guidé par le graphe graphify.

graphify-out/graph.json = source de vérité sur ce qui EXISTE (composants, fonctions).
Les fichiers sont ensuite vérifiés directement : ce que le code affiche mais qui
n'est pas câblé = interface non fonctionnelle.

Vérifications :
 1. Routes React vers un composant inexistant (graphe + imports).
 2. useParams lisant des paramètres non déclarés dans les <Route>.
 3. <option> dont la valeur ne passe pas l'ENUM backend (422 à l'enregistrement).
 4. Boutons « type="button" » sans onClick — inertes par intention.
 5. Filtres texte (placeholder rechercher/filtrer) sans state → morts.
 6. .filter() frontend sur un champ absent du schéma/routeur backend.
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FE = ROOT / "Web" / "frontend" / "src"
BE = ROOT / "Web" / "backend"
OUT = ROOT / "graphify-out"
sys.stdout.reconfigure(encoding="utf-8")

G = json.loads((OUT / "graph.json").read_text(encoding="utf-8"))
EDGES = G.get("edges", G.get("links", []))
BY_LABEL = {}
for n in G["nodes"]:
    BY_LABEL.setdefault(n["norm_label"], []).append(n)

def read(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""

TSX_FILES = sorted(FE.rglob("*.tsx"))
SRC = {str(f.relative_to(ROOT)).replace("\\", "/"): read(f) for f in TSX_FILES}

findings = []
def add(check, file, detail, severity="MAJEUR"):
    findings.append((severity, check, file, detail))

# ------- résolution des composants : imports du frontend + nœuds du graphe
IMPORTS = {}  # Composant -> chemin source déclaré
for sf, src in SRC.items():
    for m in re.finditer(r"import\s+(?:type\s+)?(?:\w+\s*,\s*)?\{([^}]*)\}\s+from\s+['\"]([^'\"]+)['\"]", src):
        for name in re.findall(r"\w+", m.group(1)):
            IMPORTS.setdefault(name.strip(), []).append((sf, m.group(2)))
    for m in re.finditer(r"import\s+(\w+)\s+from\s+['\"]([^'\"]+)['\"]", src):
        IMPORTS.setdefault(m.group(1), []).append((sf, m.group(2)))

def resolve_module(mod: str) -> str:
    base = mod.split("?")[0]
    prefix_dir = ""
    if base.startswith("@/"):
        base = str((FE / base[2:]).relative_to(ROOT))
    elif base.startswith("./"):
        return ""
    else:
        prefix_dir = "Web/frontend"
    for suffix in ("", ".tsx", ".ts", "/index.ts"):
        if (ROOT / prefix_dir / (base + suffix)).exists():
            return (prefix_dir + "/" if prefix_dir else "") + base + suffix
    return ""

def component_exists(name: str) -> bool:
    for _, mod in IMPORTS.get(name, []):
        base = resolve_module(mod)
        if base and (ROOT / base).exists():
            return True
    return bool(BY_LABEL.get(name.lower()))

# ------------------------------------------------ 1. routes mortes
ROUTE_RE = re.compile(r'<Route\b[^>]*?path="([^"]+)"[^>]*?>(.*?)</Route>|<Route\b[^>]*?path="([^"]+)"[^>]*?/>', re.S)
for sf, src in SRC.items():
    for m in ROUTE_RE.finditer(src):
        path_attr = m.group(1) or m.group(3)
        inner = m.group(2) or ""
        if path_attr == "*":
            continue
        tags = re.findall(r"<(\w+)[\s/>]", inner)
        comps = [t for t in tags if t not in ("Suspense", "Route", "Navigate")]
        if not comps:
            continue
        comp = comps[0]
        if not component_exists(comp):
            add("Route morte", sf, f'path="{path_attr}" → <{comp}> : composant introuvable (ni import valide, ni nœud graphe)')

# ------------------------------------------ 2. useParams non déclarés
declared_params = set()
for sf, src in SRC.items():
    for m in re.finditer(r'<Route\b[^>]*?path="[^"]*:([^"/:]+)[^"]*"', src):
        declared_params.add(m.group(1))
for sf, src in SRC.items():
    if "useParams" not in src:
        continue
    used = set(re.findall(r"useParams<[^>]*>\(\)\.(\w+)", src)) | set(re.findall(r"useParams\(\)\.(\w+)", src)) \
        | {a or b for a, b in re.findall(r"useParams<[^>]*>\(\)\[(.)(\w+)\]", src)}
    # destructure : const { id, slug } = useParams()
    for m in re.finditer(r"const\s*\{([^}]+)\}\s*=\s*useParams", src):
        used |= {p.strip() for p in m.group(1).split(",") if p.strip()}
    missing = {p for p in used if p not in declared_params and p != "*"}
    if missing:
        add("useParams non déclaré", sf, f"lit {sorted(missing)} — aucune <Route> du frontend ne déclare ces paramètres")

# ------------------------------------- 3. <option> vs ENUM backend
BE_ENUMS = {
    "priorite": ("basse", "moyenne", "haute", "critique"),
    "statut": ("planifie", "en_cours", "suspendu", "termine", "annule", "en_attente", "brouillon",
               "confirmee", "partiellement_recue", "recue", "partiellement_payee", "payee",
               "a_payer", "litige", "envoyee", "accepte", "refuse", "annulee", "active",
               "expiree", "resiliee", "valide", "rejete", "paye", "impaye", "nouveau", "en_revue"),
    "type_incident": ("retard_approvisionnement", "materiel", "securite", "qualite",
                      "climatique", "administratif", "autre"),
    "mode_paiement": ("mvola", "orange_money", "airtel_money", "virement", "cheque", "especes"),
}
def enum_key(field: str):
    if field in BE_ENUMS:
        return field
    if field in BE_ENUMS or field == "statuts":
        return "statut"
    for suf in ("_statut", "_priorite", "_type", "_mode"):
        if field.endswith(suf):
            cand = field[: -len(suf)]
            if cand in BE_ENUMS:
                return cand
            if suf == "_statut":
                return "statut"
    return None

OPTION_RE = re.compile(r'<option[^>]*?value="([\w-]+)"')
for sf, src in SRC.items():
    for sel in re.finditer(r"<select\b[^>]*>", src):
        tag = sel.group(0)
        nm = re.search(r'name="(\w+)"', tag)
        if not nm:
            continue
        key = enum_key(nm.group(1).lower())
        if not key:
            continue
        window = src[sel.start(): sel.start() + 4000]
        for om in OPTION_RE.finditer(window):
            v = om.group(1).lower().replace("-", "_")
            if om.group(1) == "" or v in BE_ENUMS[key]:
                continue
            add("Option hors ENUM", sf, f'<select name="{nm.group(1)}"> propose « {om.group(1)} » → 422 à l\'enregistrement')

# ------------------------------- 4. boutons inertes / 5. filtres morts
HANDLER = re.compile(r"on(?:Click|Change|Submit|Input|KeyDown|PointerDown|MouseDown|TouchStart)\s*=", re.I)
for sf, src in SRC.items():
    for bm in re.finditer(r'<button\b[^>]*type="button"[^>]*>|<button\b[^>]*>', src):
        tag = bm.group(0)
        if 'type="submit"' in tag or "{..." in tag:
            continue
        if "type=" not in tag:
            continue  # <button> nu dans un <form> = submit implicite, légitime
        if not HANDLER.search(tag):
            line = src[: bm.start()].count("\n") + 1
            add("Bouton inerte", sf, f"L{line} : <button type=\"button\"> sans aucun handler", "MINEUR")
    if re.search(r'placeholder="[^"]*(recherch|filtr|search)[^"]*"', src, re.I):
        if not re.search(r"useState\(|useSearchParams\(|value=\{", src):
            add("Filtre sans état", sf, "placeholder « rechercher/filtrer » mais aucun state ni value contrôlé")

# --------------------------- 6. filtrage client sur champ absent API
# Fiable : une page est liée au schéma backend par le SERVICE qu'elle importe
# (x.service.ts → schémas x.py). Pas de devinette sur le nom du fichier.
def schema_fields(schema_file: str) -> set:
    p = BE / "app" / "schemas" / schema_file
    if not p.exists():
        return set()
    return set(re.findall(r"^\s{4}(\w+)\s*:", p.read_text(encoding="utf-8", errors="replace"), re.M))

SERVICE_IMPORT = re.compile(r"import\s*\{[^}]*?(\w+)Service[^}]*\}\s*from\s*['\"]@/services/(\w+)\.service['\"]")
FILTER_FIELD = re.compile(r"\.filter\([^)]*?\.(\w+)\.toLowerCase", re.S)
for sf, src in SRC.items():
    schema_nouns = set()
    for _, mod in SERVICE_IMPORT.findall(src):
        schema_nouns.add(mod)  # ex: 'chantiers' → schemas/chantier.py
    if not schema_nouns:
        continue
    for fm in FILTER_FIELD.finditer(src):
        fld = fm.group(1)
        known = False
        checked = []
        for noun in schema_nouns:
            singular = noun[:-1] if noun.endswith("s") else noun
            for cand in (noun, singular):
                fields = schema_fields(cand + ".py")
                if fields:
                    checked.append(cand + ".py")
                    if fld in fields:
                        known = True
        if checked and not known:
            add("Filtre sur champ absent API", sf, f".filter sur « {fld} » absent du/des schémas {', '.join(sorted(checked))}")

# ------------------- 7. méthodes de service appelées mais inexistantes
SVC_CALL = re.compile(r"\b(\w*[Ss]ervice)\.(\w+)\(")
for sf, src in SRC.items():
    for m in SVC_CALL.finditer(src):
        svc, meth = m.group(1), m.group(2)
        for _, mod in IMPORTS.get(svc, []):
            base = resolve_module(mod)
            if not base:
                continue
            stext = read(ROOT / base)
            if stext and not re.search(rf"\b{meth}\s*[:(=]", stext):
                add("Méthode de service inexistante", sf, f"{svc}.{meth}() introuvable dans {mod} → crash runtime")

# ----------------- 8. endpoints frontend sans route backend (404 garantis)
# Frontend : api.get('/chantiers/...') — URLs relatives au baseURL /api.
def norm_url(u: str) -> str:
    u = u.split("?")[0]
    u = re.sub(r"\$\{[^}]*\}", "{}", u)
    u = re.sub(r"\{[^}]*\}", "{}", u)
    if u.startswith("/api"):
        u = u[4:]
    return u.rstrip("/")

be_routes = set()
# 1) prefixes définis dans le fichier du router (rare ici)
FILE_PREFIX = {}
for rf in (BE / "app" / "routers").glob("*.py"):
    rsrc = read(rf)
    pm = re.search(r'APIRouter\(\s*prefix="([^"]+)"', rsrc)
    if pm:
        FILE_PREFIX[rf.stem] = pm.group(1)
# 2) prefixes réels : include_router(x_router, prefix="/auth") dans main.py
main_src = read(BE / "app" / "main.py")
MAIN_PREFIX = {}
# prefix=f"{api_prefix}/auth"  et  prefix="/auth"
for var, pref in re.findall(r'include_router\((\w+)\.router,\s*prefix=f?"(?:\{api_prefix\})?/?([^"]+)"', main_src):
    MAIN_PREFIX[var.replace("_router", "").replace("router", "")] = "/" + pref.lstrip("/")

for rf in (BE / "app" / "routers").glob("*.py"):
    rsrc = read(rf)
    prefix = FILE_PREFIX.get(rf.stem, "")
    stem = rf.stem
    for var, pref in MAIN_PREFIX.items():
        if stem.startswith(var) or var and var in stem:
            prefix = pref
            break
    for m in re.finditer(r'@router\.(?:get|post|put|patch|delete)\(\s*"([^"]*)"', rsrc):
        be_routes.add(norm_url(prefix + m.group(1)))

FE_CALL = re.compile(r"\bapi\.(?:get|post|put|patch|delete)\(\s*[`'\"]([^`'\"]+)", re.S)
SCAN_TS = {str(f.relative_to(ROOT)).replace("\\", "/"): read(f) for f in (FE / "services").glob("*.ts")}
fe_urls = 0
for sf, src in {**SRC, **SCAN_TS}.items():
    # résoudre les constantes locales : const BASE = '/employe-terrain'
    consts = dict(re.findall(r"const\s+(\w+)\s*=\s*[`'\"](/[^`'\"]*)[`'\"]", src))
    for m in FE_CALL.finditer(src):
        fe_urls += 1
        raw = m.group(1)
        for k, v in consts.items():
            raw = raw.replace("${" + k + "}", v)
        url = norm_url(raw)
        if url not in be_routes:
            add("Endpoint inexistant", sf, f"appel api « {raw} » — aucune route backend ne correspond", "CRITIQUE")
print(f"Check 8 : {fe_urls} appels api.() comparés à {len(be_routes)} routes backend")

# --------------------------------------------------------- rapport
crit = [f for f in findings if f[0] == "CRITIQUE"]
maj = [f for f in findings if f[0] == "MAJEUR"]
mino = [f for f in findings if f[0] == "MINEUR"]
print(f"Grille : {len(G['nodes'])} nœuds, {len(EDGES)} arêtes · {len(TSX_FILES)} fichiers .tsx scannés")
print(f"Constats : {len(crit)} critiques, {len(maj)} majeurs, {len(mino)} mineurs\n")
for sev, group in (("CRITIQUE", crit), ("MAJEUR", maj), ("MINEUR", mino)):
    if not group:
        continue
    print(f"== {sev} ==")
    for _, check, file, detail in group:
        print(f"[{check}] {file} — {detail}")
    print()
