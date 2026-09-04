"""Test end-to-end du cycle commercial : Demande -> Projet -> Metre -> Situation -> Lignes."""
import json
import urllib.request

BASE = "http://localhost:8001/api"
EMAIL = "admin@tia.mg"
PASSWORD = "Admin123!"
RESULTS_FILE = r"D:\Tia_info_projet\projet 2\TiaInfoBuild\Web\backend\e2e_results.txt"

results = []
output = []


def log(msg):
    output.append(msg)
    print(msg)


def call(method, path, body=None, token=None):
    url = f"{BASE}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req) as resp:
            body = resp.read()
            return resp.status, json.loads(body) if body else None
    except urllib.error.HTTPError as e:
        err_body = e.read()
        try:
            return e.code, json.loads(err_body) if err_body else None
        except json.JSONDecodeError:
            return e.code, {"error": err_body.decode("utf-8", errors="replace") if err_body else "unknown"}


def check(label, status, expected, extra=""):
    ok = status == expected
    results.append((label, ok))
    log(f"{'[OK]' if ok else '[KO]'} {label} -> HTTP {status} (attendu {expected}) {extra}")


# 1. Login commercial
status, data = call("POST", "/auth/login", {"email": EMAIL, "password": PASSWORD})
check("Login commercial", status, 200)
token = data["access_token"]
log(f"    role: {data['user'].get('role_code')}")

# 2. Liste demandes
status, data = call("GET", "/commercial/demandes", token=token)
check("GET /demandes", status, 200, f"({len(data) if isinstance(data, list) else '?'} items)")

# 3. Creer une demande
status, demande = call("POST", "/commercial/demandes", {
    "objet": "Test E2E - Construction hangar",
    "type_projet": "construction",
    "description": "Demande creee par le test E2E",
    "localisation": "Antananarivo, Test",
    "statut": "nouvelle",
}, token=token)
check("POST /demandes", status, 201, f"numero={demande.get('numero')}")
dem_id = demande["id"]

# 4. Modifier la demande
status, upd = call("PUT", f"/commercial/demandes/{dem_id}", {"statut": "en_etude"}, token=token)
check("PUT /demandes/{id}", status, 200, f"statut={upd.get('statut')}")

# 5. Creer un projet lie a la demande
status, projet = call("POST", "/commercial/projets", {
    "nom": "Test E2E - Projet Hangar",
    "demande_id": dem_id,
    "type_projet": "construction",
    "localisation": "Antananarivo, Test",
    "surface": 250,
    "nombre_niveaux": 1,
}, token=token)
check("POST /projets", status, 201, f"ref={projet.get('reference')}")
prj_id = projet["id"]

# 6. Creer des metres pour le projet
status, metre1 = call("POST", "/commercial/metres", {
    "projet_id": prj_id, "ouvrage": "Terrassement", "unite": "m3", "quantite": 120, "ordre": 1,
}, token=token)
check("POST /metres (1)", status, 201)
status, metre2 = call("POST", "/commercial/metres", {
    "projet_id": prj_id, "ouvrage": "Beton fondation", "unite": "m3", "quantite": 30, "ordre": 2,
}, token=token)
check("POST /metres (2)", status, 201)
metre_id = metre1["id"]

# 7. Modifier un metre
status, mupd = call("PUT", f"/commercial/metres/{metre_id}", {"quantite": 135}, token=token)
check("PUT /metres/{id}", status, 200, f"quantite={mupd.get('quantite')}")

# 8. Creer une situation de travaux
status, situation = call("POST", "/commercial/situations", {
    "periode": "Test E2E - Periode 1",
    "avancement": 25.5,
    "montant": 5000000,
    "statut": "brouillon",
}, token=token)
check("POST /situations", status, 201, f"numero={situation.get('numero')}")
sit_id = situation["id"]

# 9. Ajouter des lignes a la situation
status, ligne1 = call("POST", f"/commercial/situations/{sit_id}/lignes", {
    "ouvrage": "Terrassement realise", "quantite_periode": 50, "quantite_cumulee": 50,
    "unite": "m3", "prix_unitaire": 25000, "montant": 1250000,
}, token=token)
check("POST /situations/{id}/lignes (1)", status, 201, f"montant={ligne1.get('montant')}")
status, ligne2 = call("POST", f"/commercial/situations/{sit_id}/lignes", {
    "ouvrage": "Beton realise", "quantite_periode": 12, "quantite_cumulee": 12,
    "unite": "m3", "prix_unitaire": 850000, "montant": 10200000,
}, token=token)
check("POST /situations/{id}/lignes (2)", status, 201)
ligne_id = ligne1["id"]

# 10. Lister les lignes
status, lignes = call("GET", f"/commercial/situations/{sit_id}/lignes", token=token)
check("GET /situations/{id}/lignes", status, 200, f"({len(lignes) if isinstance(lignes, list) else '?'} lignes)")

# 11. Supprimer la 2e ligne
status, _ = call("DELETE", f"/commercial/situations/{sit_id}/lignes/{ligne2['id']}", token=token)
check("DELETE /situations/{id}/lignes/{ligne_id}", status, 204)

# 12. Recuperations unitaires
status, _ = call("GET", f"/commercial/demandes/{dem_id}", token=token)
check("GET /demandes/{id}", status, 200)
status, _ = call("GET", f"/commercial/projets/{prj_id}", token=token)
check("GET /projets/{id}", status, 200)
status, _ = call("GET", f"/commercial/metres/{metre_id}", token=token)
check("GET /metres/{id}", status, 200)
status, _ = call("GET", f"/commercial/situations/{sit_id}", token=token)
check("GET /situations/{id}", status, 200)

# 13. Listes finales
status, d = call("GET", "/commercial/demandes", token=token)
check("GET /demandes final", status, 200, f"({len(d)} demandes)")
status, p = call("GET", "/commercial/projets", token=token)
check("GET /projets final", status, 200, f"({len(p)} projets)")
status, m = call("GET", "/commercial/metres", token=token)
check("GET /metres final", status, 200, f"({len(m)} metres)")
status, s = call("GET", "/commercial/situations", token=token)
check("GET /situations final", status, 200, f"({len(s)} situations)")

# 14. Nettoyage : suppression (situation, metre, projet, demande)
for method, path, label in [
    ("DELETE", f"/commercial/situations/{sit_id}", "DELETE situation"),
    ("DELETE", f"/commercial/metres/{metre2['id']}", "DELETE metre 2"),
    ("DELETE", f"/commercial/metres/{metre_id}", "DELETE metre 1"),
    ("DELETE", f"/commercial/projets/{prj_id}", "DELETE projet"),
    ("DELETE", f"/commercial/demandes/{dem_id}", "DELETE demande"),
]:
    status, _ = call(method, path, token=token)
    check(label, status, 204)

log("")
ok_count = sum(1 for _, ok in results if ok)
log(f"RESULTAT: {ok_count}/{len(results)} tests OK")
if ok_count == len(results):
    log("VALIDATION E2E CYCLE COMMERCIAL: TOUT OK")
else:
    for label, ok in results:
        if not ok:
            log(f"  ECHEC: {label}")
    log("VALIDATION E2E: ECHECS DETECTES")

with open(RESULTS_FILE, "w", encoding="utf-8") as f:
    f.write("\n".join(output))