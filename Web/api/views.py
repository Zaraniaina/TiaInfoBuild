import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth import authenticate

@csrf_exempt
@require_http_methods(["POST"])
def api_login(request):
    try:
        data = json.loads(request.body)
        email = data.get('email')
        password = data.get('password')

        if not email or not password:
            return JsonResponse({'success': False, 'message': 'Email et mot de passe requis'}, status=400)

        # authenticate will use the custom UserModel which has USERNAME_FIELD='email'
        user = authenticate(request, email=email, password=password)

        if user is not None:
            if user.is_active:
                return JsonResponse({
                    'success': True,
                    'user': {
                        'id': user.id,
                        'email': user.email,
                        'nom': user.last_name,
                        'prenom': user.first_name,
                        'roleId': user.role_id,
                        'entrepriseId': user.entreprise_id
                    }
                })
            else:
                return JsonResponse({'success': False, 'message': 'Compte désactivé'}, status=403)
        else:
            return JsonResponse({'success': False, 'message': 'Identifiants invalides'}, status=401)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Format JSON invalide'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)
