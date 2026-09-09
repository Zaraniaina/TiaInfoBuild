# Rapport de test - rôles demo

## 1. Résumé

- Application testée : `https://m8q3fqnk-5173.inc1.devtunnels.ms/`
- Date du test : 2026-09-09 06:25 UTC
- Comptes testés : 12
- Abonnements, paiement et changement de plan : **non utilisés**
- Résultat principal : les connexions API fonctionnent, mais l'interface web reste blanche et ne permet pas de tester les écrans, boutons et formulaires.

**Conclusion :** l'application ne peut pas être déclarée fonctionnelle pour tous les rôles tant que le blocage de rendu frontend n'est pas corrigé.

## 2. Méthode utilisée

1. Ouverture de l'URL fournie et validation de l'avertissement Dev Tunnel.
2. Ouverture de `/`, `/login` puis `/dashboard`.
3. Vérification du DOM, du titre de page, de l'écran affiché et du chargement des modules React/Vite.
4. Rechargement de la page et nouvel essai avec une session authentifiée.
5. Test de connexion API avec chaque compte demo et contrôle du `role_code` retourné.
6. Quelques tests de lecture métier, sans création, modification ou suppression de données.
7. Aucun appel aux fonctionnalités d'abonnement ou de facturation d'abonnement.

## 3. Résultat de la connexion par rôle

| Rôle | Compte | Connexion | Rôle reçu par l'API | Accueil prévu | Test de l'interface |
|---|---|---:|---|---|---|
| Super Admin | `admin@tia.mg` | PASS (200) | `super_admin` | `/super-admin` | BLOQUÉ : écran blanc |
| Admin Entreprise | `demo@btppro.mg` | PASS (200) | `admin_entreprise` | `/dashboard` | BLOQUÉ : écran blanc |
| Directeur | `directeur@btppro.mg` | PASS (200) | `directeur` | `/dashboard` | BLOQUÉ : écran blanc |
| Comptable | `comptable@btppro.mg` | PASS (200) | `comptable` | `/dashboard` | BLOQUÉ : écran blanc |
| Chef de Projet | `chefprojet@btppro.mg` | PASS (200) | `chef_projet` | `/dashboard` | BLOQUÉ : écran blanc |
| Chef de Chantier | `chefchantier@btppro.mg` | PASS (200) | `chef_chantier` | `/dashboard` | BLOQUÉ : écran blanc |
| RH | `rh@btppro.mg` | PASS (200) | `rh` | `/dashboard` | BLOQUÉ : écran blanc |
| Matériel | `materiel@btppro.mg` | PASS (200) | `materiel` | `/dashboard` | BLOQUÉ : écran blanc |
| Magasinier | `magasinier@btppro.mg` | PASS (200) | `magasinier` | `/dashboard` | BLOQUÉ : écran blanc |
| Commercial | `commercial@btppro.mg` | PASS (200) | `commercial` | `/dashboard` | BLOQUÉ : écran blanc |
| Employé | `employe@btppro.mg` | PASS (200) | `employe` | `/employe` | BLOQUÉ : écran blanc |
| Client | `client@btppro.mg` | PASS (200) | `client` | `/client` | BLOQUÉ : écran blanc |

Le mot de passe utilisé pour ces comptes est celui fourni dans le README : `Admin123!`.

## 4. Blocage critique observé

Après chargement de l'application :

- le titre de page est `frontend` ;
- le document contient bien `<div id="root"></div>` ;
- `#root` reste vide ;
- le corps de page ne contient aucun texte ou bouton ;
- le résultat est identique sur `/`, `/login` et `/dashboard` ;
- le résultat persiste après rechargement et après ajout d'une session authentifiée dans le stockage local ;
- une capture d'écran montre une page entièrement blanche.

Les modules Vite/React sont demandés par le navigateur, mais aucun contenu React n'est finalement rendu. L'absence d'écran de secours visible rend le problème particulièrement bloquant : un utilisateur ne reçoit ni message d'erreur ni indication de chargement.

## 5. Tests API complémentaires

Ces tests ne remplacent pas un test d'interface complet.

| Vérification | Résultat | Observation |
|---|---|---|
| Connexion Admin Entreprise | PASS | Le rôle `admin_entreprise` est retourné avec un jeton valide. |
| Lecture `/api/dashboard/stats` avec Admin Entreprise | PASS (200) | Une réponse JSON de statistiques est retournée. |
| Connexion des 12 comptes | PASS | Les 12 comptes ont accepté le mot de passe demo et retourné le rôle attendu. |
| `/api/dashboard/stats` avec Super Admin | À corriger | Réponse `400` : `Entreprise ID manquant`, alors que le rôle Super Admin voit aussi le module dashboard dans la configuration frontend. |
| `/api/finance/stats` avec Directeur | NON RÉPONDU | Aucune réponse dans la fenêtre de test de plus de 60 secondes. |
| `/api/employe-terrain/dashboard` avec Employé | NON RÉPONDU | Aucune réponse dans la fenêtre de test de plus de 30 secondes. |
| `/api/espace-client/dashboard` avec Client | NON RÉPONDU | Aucune réponse dans la fenêtre de test de plus de 30 secondes. |

Les trois tests « non répondu » doivent être reproduits côté serveur avec des logs SQL et un délai d'expiration explicite avant de conclure à une panne définitive. Ils constituent néanmoins un signal de performance ou de requête bloquante à traiter.

## 6. Ce qui n'a pas pu être validé

À cause de l'écran blanc, les éléments suivants restent à tester après correction du frontend :

- affichage du tableau de bord et redirection de chaque rôle ;
- visibilité réelle des menus selon les permissions ;
- accès autorisé et refusé aux routes métier ;
- consultation des chantiers, RH, matériel, stocks, finance, commercial et alertes ;
- espace Employé : tâches, travaux, rapports, photos, signalements, planning et badge ;
- espace Client : demandes, projets, devis, contrats, chantiers, situations, factures et paiements ;
- création et modification des données métier ;
- messages d'erreur, validations de formulaires, états vides et chargements ;
- affichage mobile et responsive.

Aucune donnée n'a été créée, modifiée ou supprimée pendant ce test.

## 7. Améliorations à faire, étape par étape

### Étape 1 - Corriger l'écran blanc avant tout autre test

1. Reproduire le problème sur `/login` en ouvrant la console navigateur et l'onglet réseau.
2. Vérifier le résultat de `npm run build` dans `Web/frontend`.
3. Vérifier que `main.tsx` monte réellement React sur `#root` et qu'aucune importation ne reste en attente.
4. Vérifier les versions et la compatibilité de Vite, React, `react-dom` et des dépendances précompilées.
5. Tester l'application en build de production avec `npm run preview`, et non uniquement avec le serveur Vite de développement exposé par Dev Tunnel.
6. Ajouter un écran de secours visible pour les erreurs de chargement de module, avec un message compréhensible et un bouton « Réessayer ».
7. Ajouter un délai maximum de chargement : après 10 à 15 secondes, afficher une erreur au lieu de laisser une page blanche.

**Critère de sortie :** `/login` affiche un formulaire visible après un chargement normal, et une erreur lisible apparaît en cas de panne.

### Étape 2 - Stabiliser les réponses backend

1. Reproduire séparément les endpoints `/api/finance/stats`, `/api/employe-terrain/dashboard` et `/api/espace-client/dashboard`.
2. Ajouter des logs de durée par endpoint et par requête SQL.
3. Identifier les requêtes lentes, les relations chargées en boucle et les jointures inutiles.
4. Ajouter les index SQL nécessaires sur les colonnes de filtrage : entreprise, utilisateur, projet, chantier et statut.
5. Ajouter un délai d'expiration côté serveur et retourner une erreur JSON explicite plutôt que laisser la requête pendante.
6. Vérifier les réponses lorsque la base ne contient aucune donnée : retourner des listes vides et des compteurs à zéro.

**Critère de sortie :** chaque tableau de bord répond en moins de 2 secondes avec le jeu de données demo, ou retourne une erreur contrôlée.

### Étape 3 - Clarifier le cas Super Admin

1. Décider si le Super Admin doit avoir accès au dashboard d'une entreprise.
2. Si oui, ajouter un sélecteur d'entreprise et transmettre un `entreprise_id` valide.
3. Si non, retirer `/dashboard` de ses modules visibles et le rediriger uniquement vers `/super-admin`.
4. Ajouter un test automatisé pour éviter la réponse `400 Entreprise ID manquant` depuis une page normalement accessible.

### Étape 4 - Ajouter une vraie matrice RBAC automatisée

1. Créer un test de connexion pour chacun des 12 comptes demo.
2. Vérifier la redirection attendue : Super Admin vers `/super-admin`, Employé vers `/employe`, Client vers `/client`, autres rôles vers `/dashboard`.
3. Pour chaque rôle, vérifier au moins une route autorisée et une route interdite.
4. Vérifier que l'API refuse aussi les actions interdites, et pas seulement que le menu les masque.
5. Vérifier les permissions d'action : création, validation, suppression, export et paiement.

### Étape 5 - Tester les parcours métier sans abonnement

Après les étapes 1 à 4, utiliser un jeu de données demo isolé et réinitialisable :

1. Dashboard et alertes.
2. Chantiers et suivi d'avancement.
3. RH et pointages.
4. Matériel et maintenances.
5. Stocks, articles et mouvements.
6. Commercial : client, demande, projet, métré, devis et situation.
7. Finance : dépenses, factures, paiements et exports, sans changer de plan.
8. Employé : présence, tâche, travail réalisé, rapport et signalement.
9. Client : consultation et réponse aux devis, demandes et suivi des projets.
10. Vérifier les opérations de création/modification/suppression puis nettoyer les données de test.

### Étape 6 - Améliorer l'expérience utilisateur

1. Ajouter des états visibles : chargement, vide, erreur et succès.
2. Afficher le nom et le rôle connectés, avec une déconnexion accessible.
3. Remplacer les erreurs techniques par des messages orientés utilisateur.
4. Désactiver les boutons pendant une sauvegarde pour éviter les doublons.
5. Vérifier la lisibilité sur mobile et les tableaux larges.
6. Ajouter une confirmation avant les actions destructives.

### Étape 7 - Mettre en place une validation avant livraison

1. Lancer le build frontend et les tests backend sur chaque changement.
2. Exécuter les 12 connexions demo dans un test de fumée automatique.
3. Exécuter un test E2E par rôle sur un navigateur propre.
4. Bloquer la livraison si `#root` reste vide ou si une route protégée renvoie une page blanche.
5. Conserver un rapport de régression avec le temps de réponse des endpoints principaux.

## 8. Priorités recommandées

1. **Bloquant immédiat :** corriger le rendu frontend et ajouter un écran d'erreur visible.
2. **Très haute priorité :** diagnostiquer les endpoints qui ne répondent pas et le `400` du dashboard Super Admin.
3. **Haute priorité :** automatiser la matrice des 12 rôles et les règles d'accès.
4. **Moyenne priorité :** valider les CRUD métier sur des données demo isolées.
5. **Moyenne priorité :** améliorer les états de chargement, d'erreur et les contrôles mobiles.
