# Test fonctionnel des rôles

## Résumé

- Application : `https://m8q3fqnk-5173.inc1.devtunnels.ms/`
- Date : 2026-09-09 07:34 UTC
- Abonnements et changement de plan : **non utilisés**
- Actions d'écriture : **non utilisées** ; uniquement des lectures API non destructives
- Rôles validés fonctionnellement par API pendant ce cycle : **10/12**
- Rôles à retester après stabilisation du tunnel/API : **Employé et Client**

## Résultat global

Les rôles Super Admin, Admin Entreprise, Directeur, Comptable, Chef de Projet, Chef de Chantier, RH, Matériel, Magasinier et Commercial ont réussi leurs lectures fonctionnelles principales.

Le contrôle n'a pas été considéré comme terminé pour Employé et Client : les appels ont expiré après plusieurs requêtes de test et le tunnel/API ne répondait plus dans le délai prévu. Ces deux rôles ne doivent donc pas être déclarés « validés » uniquement sur la base de la configuration.

## 1. Test des fonctionnalités par rôle

Toutes les routes ci-dessous ont été appelées en `GET` avec le compte correspondant. Aucun abonnement n'a été ouvert.

| Rôle | Fonctionnalités vérifiées | Résultat |
|---|---|---|
| Super Admin | Statistiques SaaS, entreprises, utilisateurs | PASS : 3/3 en HTTP 200 |
| Admin Entreprise | Dashboard, utilisateurs, paramètres entreprise | PASS : 3/3 en HTTP 200 |
| Directeur | Dashboard, finance, chantiers, commercial, RH, matériel, stocks, alertes | PASS : 8/8 en HTTP 200 |
| Comptable | Dashboard, finance, commercial, chantiers, RH, alertes | PASS : 6/6 en HTTP 200 |
| Chef de Projet | Dashboard, chantiers, RH, matériel, stocks, finance, alertes | PASS : 7/7 en HTTP 200 |
| Chef de Chantier | Dashboard, chantiers, RH, matériel, stocks, finance, alertes | PASS : 7/7 en HTTP 200 |
| RH | Dashboard, employés, chantiers, alertes | PASS : 4/4 en HTTP 200 |
| Matériel | Dashboard, matériel, chantiers, alertes | PASS : 4/4 en HTTP 200 |
| Magasinier | Dashboard, articles de stock, chantiers, alertes | PASS : 4/4 en HTTP 200 |
| Commercial | Dashboard, clients, chantiers, finance, alertes | PASS : 5/5 en HTTP 200 |
| Employé | Dashboard terrain, tâches, travaux, rapports, photos, signalements, profil, documents, badge, pointages, planning, présence | À RETESTER : expiration pendant le test courant |
| Client | Dashboard client, profil, demandes, projets, devis, contrats, avenants, chantiers, avancement, situations, factures, paiements, documents, notifications, préférences | À RETESTER : expiration pendant le test courant |

## 2. Contrôle des rôles

Les connexions et rôles suivants ont été vérifiés dans le cycle actuel pour les 10 rôles validés :

- le compte demo accepte le mot de passe fourni ;
- le jeton est retourné ;
- le `role_code` correspond au rôle attendu ;
- les endpoints métier correspondant au rôle répondent correctement.

Les appels métier utilisés étaient en lecture seule. Aucune création, modification ou suppression de donnée n'a été faite.

## 3. Modules déclarés

La configuration frontend déclare les modules suivants :

| Rôle | Modules principaux |
|---|---|
| Super Admin | Super Admin, Entreprises, Utilisateurs, Logs, Paramètres, Dashboard |
| Admin Entreprise | Dashboard, Historique des connexions, Paramètres, Tarification* |
| Directeur | Dashboard, Chantiers, Finance, Commercial, RH, Matériel, Stocks, Alertes |
| Comptable | Dashboard, Finance, Commercial, Chantiers, RH, Alertes |
| Chef de Projet | Dashboard, Chantiers, RH, Matériel, Stocks, Finance, Alertes |
| Chef de Chantier | Dashboard, Chantiers, RH, Matériel, Stocks, Finance, Alertes |
| RH | Dashboard, RH, Chantiers, Alertes |
| Matériel | Dashboard, Matériel, Chantiers, Alertes |
| Magasinier | Dashboard, Stocks, Chantiers, Alertes |
| Commercial | Dashboard, Commercial, Chantiers, Finance, Alertes |
| Employé | Espace Employé, Profil, Chantiers, Tâches, Travaux, Rapports, Photos, Signalements, Notifications, Planning, Documents, Badge |
| Client | Espace Client, Profil, Demandes, Projets, Devis, Contrats, Avenants, Chantiers, Avancement, Situations, Factures, Paiements, Documents, Notifications, Paramètres |

`*` La tarification et les abonnements restent hors périmètre. La configuration les déclare encore pour certains rôles ; ils devront être masqués ou désactivés si cette règle doit être appliquée strictement dans l'interface.

## 4. Permissions à conserver

Les contrôles RBAC déjà vérifiés lors du cycle précédent restent cohérents avec les modules :

- Admin Entreprise vers les chantiers : refus `403` ;
- Employé vers la finance : refus `403` ;
- Client vers le dashboard interne : refus `403`.

La protection doit rester active côté API, même lorsqu'un menu est masqué côté frontend.

## 5. Limitation d'affichage observée

Dans le navigateur de test, l'ouverture de `/login` est restée vide après une attente prolongée et plusieurs nouveaux onglets. Les fichiers frontend ont été demandés, mais aucun composant n'a été visible.

La latence explique une partie du délai de chargement, mais le formulaire n'est pas apparu après l'attente complète. Pour valider les fonctionnalités utilisateur par clic, il faut donc refaire le test lorsque le tunnel sert le bundle frontend de manière stable.

## 6. Améliorations à faire étape par étape

### Étape 1 - Retester Employé et Client proprement

1. Redémarrer ou stabiliser le backend et le Dev Tunnel.
2. Tester un seul compte à la fois, sans lancer plusieurs connexions simultanées.
3. Vérifier le dashboard Employé et toutes ses pages en lecture seule.
4. Vérifier le dashboard Client et toutes ses pages en lecture seule.
5. Ajouter un délai d'expiration explicite par endpoint et enregistrer le temps de réponse.
6. Refaire ensuite les tests de création dans un environnement demo isolé.

**Critère de sortie :** les 12 rôles répondent sans expiration et chaque page autorisée affiche soit ses données, soit un état vide clair.

### Étape 2 - Rendre la latence visible pour l'utilisateur

1. Afficher un écran de chargement immédiat dans `index.html`, avant le démarrage de React.
2. Afficher un squelette de page pendant le chargement des modules.
3. Après 10 à 15 secondes, afficher une erreur lisible avec un bouton « Réessayer ».
4. Afficher une erreur dédiée lorsque l'API ne répond pas.
5. Ne jamais laisser uniquement une page blanche sans indication.

### Étape 3 - Tester le frontend en build de production

1. Exécuter `npm run build` dans `Web/frontend`.
2. Servir le résultat avec `npm run preview` ou un serveur statique.
3. Exposer ce build via le tunnel plutôt que le serveur Vite de développement.
4. Tester `/login`, puis chaque accueil de rôle dans un navigateur propre.
5. Vérifier que les erreurs d'importation ne bloquent pas silencieusement le montage de `#root`.

### Étape 4 - Automatiser la matrice rôles/modules

1. Créer un scénario de connexion par rôle.
2. Vérifier la route d'accueil attendue : Super Admin, Dashboard, Employé ou Client.
3. Vérifier au moins une route autorisée par module.
4. Vérifier une route interdite par rôle et attendre `403` ou une redirection contrôlée.
5. Vérifier les sous-routes comme `/employe/taches` et `/client/factures`.
6. Exécuter les tests un par un ou avec une limite de concurrence faible pour ne pas saturer le backend.

### Étape 5 - Tester les vraies actions métier

Après validation des lectures :

1. Préparer des données demo réinitialisables.
2. Tester la création et la modification d'un chantier avec Chef de Projet.
3. Tester les pointages et employés avec RH.
4. Tester un matériel et une maintenance avec Matériel.
5. Tester un article et un mouvement avec Magasinier.
6. Tester un client, une demande, un projet, un métré, un devis et une situation avec Commercial.
7. Tester une dépense et sa validation avec les rôles autorisés.
8. Tester une tâche, un rapport et un signalement avec Employé.
9. Tester la consultation et la réponse à un devis avec Client.
10. Nettoyer ou réinitialiser les données après les scénarios.

### Étape 6 - Garder les abonnements désactivés

1. Ajouter `SUBSCRIPTIONS_ENABLED=false` dans l'environnement demo.
2. Masquer la tarification et les modules d'abonnement dans les menus.
3. Bloquer aussi leurs endpoints côté API pour les rôles non concernés.
4. Ajouter un test qui vérifie qu'aucun parcours métier normal n'ouvre une page d'abonnement.

### Étape 7 - Améliorer les états vides et les erreurs

1. Afficher un état vide explicite lorsque Matériel ou Stocks ne contient aucune donnée.
2. Afficher le temps d'attente ou un message de reprise lorsque l'API est lente.
3. Afficher clairement les permissions manquantes après un `403`.
4. Désactiver les boutons pendant une sauvegarde.
5. Demander confirmation avant une suppression.
6. Vérifier l'affichage mobile des tableaux et menus.

## Conclusion

Le RBAC et les fonctionnalités principales de 10 rôles fonctionnent côté API. Le test complet des 12 rôles doit être terminé après stabilisation du tunnel/API, puis confirmé par des clics dans l'interface lorsque le bundle frontend est visible.
