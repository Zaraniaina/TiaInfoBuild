import asyncio, aiohttp, json

async def test():
    async with aiohttp.ClientSession() as session:
        # Login
        async with session.post('http://localhost:8000/api/auth/login', json={'email': 'demo@btppro.mg', 'password': 'Admin123!'}) as resp:
            data = await resp.json()
            if 'access_token' in data:
                token = data['access_token']
                print(f'LOGIN OK, token (first 50 chars): {token[:50]}')
                print(f'Token type: {data.get("token_type")}')
                print(f'User role_code: {data.get("user", {}).get("role_code")}')
                print(f'User entreprise_id: {data.get("user", {}).get("entreprise_id")}')
                
                # Test /me
                async with session.get('http://localhost:8000/api/auth/me', headers={'Authorization': f'Bearer {token}'}) as me_resp:
                    me_data = await me_resp.json()
                    print(f'\n/auth/me status: {me_resp.status}')
                    print(json.dumps(me_data, indent=2, default=str)[:500])
                
                # Test /utilisateurs
                async with session.get('http://localhost:8000/api/utilisateurs/', headers={'Authorization': f'Bearer {token}'}) as users_resp:
                    users_data = await users_resp.json()
                    print(f'\n/api/utilisateurs/ status: {users_resp.status}')
                    print(json.dumps(users_data, indent=2, default=str)[:300])
            else:
                print(f'LOGIN FAILED:', json.dumps(data))

asyncio.run(test())
