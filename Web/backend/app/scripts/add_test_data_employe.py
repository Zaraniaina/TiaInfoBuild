from app.database import engine
from sqlalchemy import text
import asyncio

async def add_test_data():
    async with engine.begin() as conn:
        result = await conn.execute(text('SELECT id FROM utilisateurs WHERE email = :email'), {'email': 'ouvrier@btppro.mg'})
        user_id = result.scalar_one_or_none()
        if not user_id:
            print('Utilisateur non trouve')
            return
        
        result = await conn.execute(text('SELECT id FROM employes WHERE email = :email'), {'email': 'ouvrier@btppro.mg'})
        employe_id = result.scalar_one_or_none()
        if not employe_id:
            await conn.execute(text('INSERT INTO employes (entreprise_id, nom, prenom, email, poste, statut, is_deleted) VALUES (1, :nom, :prenom, :email, :poste, :statut, 0)'), {'nom': 'Ouvrier', 'prenom': 'Jean', 'email': 'ouvrier@btppro.mg', 'poste': 'Ouvrier', 'statut': 'actif'})
            result = await conn.execute(text('SELECT LAST_INSERT_ID()'))
            employe_id = result.scalar_one_or_none()
            print('Employe cree:', employe_id)
        
        result = await conn.execute(text('SELECT id FROM chantiers WHERE entreprise_id = 1 LIMIT 1'))
        chantier_id = result.scalar_one_or_none()
        if not chantier_id:
            print('Aucun chantier trouve')
            return
        
        await conn.execute(text('INSERT INTO pointages (entreprise_id, employe_id, chantier_id, date_jour, heure_debut, heure_fin, type, methode_pointage, statut_validation, is_deleted) VALUES (1, :employe_id, :chantier_id, CURDATE(), :debut, :fin, :type, :methode, :statut, 0)'), {'employe_id': employe_id, 'chantier_id': chantier_id, 'debut': '08:00', 'fin': '17:00', 'type': 'present', 'methode': 'qr', 'statut': 'valide'})
        print('Pointage de test ajoute')
        
        result = await conn.execute(text('SELECT id FROM materiaux WHERE entreprise_id = 1 LIMIT 1'))
        materiel_id = result.scalar_one_or_none()
        if materiel_id:
            await conn.execute(text('INSERT INTO affectations_materiaux (entreprise_id, materiel_id, employe_id, chantier_id, date_debut, date_fin, is_deleted) VALUES (1, :materiel_id, :employe_id, :chantier_id, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 7 DAY), 0)'), {'materiel_id': materiel_id, 'employe_id': employe_id, 'chantier_id': chantier_id})
            print('Materiel affecte ajoute')
        
        print('Donnees de test ajoutees')

asyncio.run(add_test_data())
