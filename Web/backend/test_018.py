import httpx, warnings
warnings.filterwarnings('ignore')
BASE = 'http://127.0.0.1:8000'

EMAILS = {
    'chefprojet': 'chefprojet@btppro.mg',
    'employe': 'ouvrier@btppro.mg',
}
for label, email in EMAILS.items():
    r = httpx.post(BASE + '/api/auth/login', json={'email': email, 'password': 'Admin123!'}, timeout=10)
    if r.status_code != 200:
        print(label, 'LOGIN', r.status_code, r.text[:120])
        continue
    h = {'Authorization': 'Bearer ' + r.json()['access_token']}
    for ep in ['/api/chantiers/projets-transformables', '/api/chantiers/from-projet/999999']:
        resp = httpx.get(BASE + ep, headers=h, timeout=10) if 'transformables' in ep else httpx.post(BASE + ep, headers=h, timeout=10)
        print(f'{label} {ep} -> {resp.status_code}', (resp.text[:140] if resp.status_code >= 400 else ''))
    if label == 'chefprojet':
        resp = httpx.get(BASE + '/api/chantiers/projets-transformables', headers=h, timeout=10)
        items = resp.json().get('items', []) if resp.status_code == 200 else []
        print('   projets transformables:', len(items), [(i['projet_id'], i['reference'], round(i['montant_contrat'], 2)) for i in items[:3]])
        if items:
            pid = items[0]['projet_id']
            r2 = httpx.post(BASE + f'/api/chantiers/from-projet/{pid}', headers=h, timeout=10)
            print(f'   from-projet {pid} -> {r2.status_code}', r2.json().get('numero', r2.text[:140]) if r2.status_code == 201 else r2.text[:140])
print('FINI')