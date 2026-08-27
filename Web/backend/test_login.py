import asyncio, json
import urllib.request

def make_request(url, method='GET', data=None, headers=None):
    if headers is None:
        headers = {}
    if data is not None:
        data = json.dumps(data).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            return e.code, json.loads(body)
        except:
            return e.code, body

# Login
status, data = make_request('http://localhost:8000/api/auth/login', 'POST', 
    {'email': 'demo@btppro.mg', 'password': 'Admin123!'})

if status == 200 and 'access_token' in data:
    token = data['access_token']
    print(f'LOGIN OK, token: {token[:50]}...')
    print(f'role_code: {data.get("user", {}).get("role_code")}')
    print(f'entreprise_id: {data.get("user", {}).get("entreprise_id")}')
    
    headers = {'Authorization': 'Bearer ' + token}
    
    # Test /me
    status, me_data = make_request('http://localhost:8000/api/auth/me', 'GET', headers=headers)
    print(f'\n/auth/me status: {status}')
    print(json.dumps(me_data, indent=2, default=str)[:500])
    
    # Test /utilisateurs
    status, users_data = make_request('http://localhost:8000/api/utilisateurs/', 'GET', headers=headers)
    print(f'\n/api/utilisateurs/ status: {status}')
    if status == 200:
        print(json.dumps(users_data, indent=2, default=str)[:400])
    else:
        print(users_data)
else:
    print(f'LOGIN FAILED (status {status}):', json.dumps(data))
