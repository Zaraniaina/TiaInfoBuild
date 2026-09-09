
import httpx, time, warnings
warnings.filterwarnings('ignore')
base = 'http://127.0.0.1:8000'
c = httpx.Client(base_url=base, timeout=30)
r = c.post('/api/auth/login', json={'email': 'demo@btppro.mg', 'password': 'Admin123!'})
tok = r.json()['access_token']
h = {'Authorization': f'Bearer {tok}'}
endpoints = ['/api/dashboard/stats', '/api/dashboard/charts', '/api/chantiers', '/api/clients', '/api/employes', '/api/materiels', '/api/stocks/articles', '/api/alertes', '/api/utilisateurs', '/api/parametres/entreprise']
for ep in endpoints:
    t0 = time.perf_counter()
    try:
        rr = c.get(ep, headers=h)
        dt = (time.perf_counter() - t0) * 1000
        print(f'{ep:40s} {dt:8.0f} ms  HTTP {rr.status_code}  {len(rr.content)} octets')
    except Exception as e:
        print(f'{ep:40s} ERREUR {e}')

