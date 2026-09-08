import httpx
import warnings
warnings.filterwarnings("ignore")
BASE = "http://127.0.0.1:8000"
r = httpx.post(f"{BASE}/api/auth/login", json={"email":"chefprojet@btppro.mg","password":"Admin123!"}, verify=False)
tok = r.json().get("access_token","")
h = {"Authorization":f"Bearer {tok}"}
r2 = httpx.get(f"{BASE}/api/chantiers/projets-transformables", headers=h, verify=False)
print("projets-transformables:", r2.status_code, "->", r2.json())
r3 = httpx.get(f"{BASE}/api/chantiers", headers=h, verify=False)
data = r3.json()
items = data.get("items", data) if isinstance(data, dict) else data
print("chantiers:", r3.status_code, "->", len(items), "items")
if items:
    print("  first:", items[0].get("numero"), "projet_id=", items[0].get("projet_id"))
r4 = httpx.get(f"{BASE}/api/commercial/devis", headers=h, verify=False)
print("devis:", r4.status_code)
if r4.status_code == 200:
    d = r4.json()
    devis_items = d.get("items", d) if isinstance(d, dict) else d
    for dv in devis_items[:3]:
        print("  ", dv.get("numero"), "projet_id=", dv.get("projet_id"), "statut=", dv.get("statut"))
