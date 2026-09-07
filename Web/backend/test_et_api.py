import httpx, warnings
warnings.filterwarnings("ignore")
BASE = "http://127.0.0.1:8001"
r = httpx.post(f"{BASE}/api/auth/login", json={"email":"ouvrier@btppro.mg","password":"Admin123!"}, verify=False)
print("login:", r.status_code)
token = r.json().get("access_token","")
h = {"Authorization": f"Bearer {token}"}
endpoints = [
    ("/api/employe-terrain/dashboard", "GET"),
    ("/api/employe-terrain/chantiers", "GET"),
    ("/api/employe-terrain/taches", "GET"),
    ("/api/employe-terrain/travaux-realises", "GET"),
    ("/api/employe-terrain/rapports", "GET"),
    ("/api/employe-terrain/photos", "GET"),
    ("/api/employe-terrain/signalements", "GET"),
    ("/api/employe-terrain/notifications", "GET"),
    ("/api/employe-terrain/profil", "GET"),
    ("/api/employe-terrain/documents", "GET"),
    ("/api/employe-terrain/mon-badge", "GET"),
    ("/api/employe-terrain/planning", "GET"),
    ("/api/employe-terrain/presence", "GET"),
    ("/api/employe-terrain/pointages", "GET"),
]
for ep, m in endpoints:
    r = httpx.request(m, f"{BASE}{ep}", headers=h, verify=False)
    print(f"{m} {ep}: {r.status_code}")
