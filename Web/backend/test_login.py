import httpx, warnings
warnings.filterwarnings("ignore")
BASE = "http://127.0.0.1:8001"
r = httpx.post(f"{BASE}/api/auth/login", json={"email":"ouvrier@btppro.mg","password":"Admin123!"}, verify=False)
print("status:", r.status_code)
print("body:", r.text[:500])
