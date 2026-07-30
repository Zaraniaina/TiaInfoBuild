# TIA INFO BUILD — Plateforme de Gestion BTP

Une plateforme SaaS complète de gestion pour les entreprises du bâtiment (BTP),
avec un système multi-tenant, un espace super-administrateur et des modules
métier intégrés.

## 🏗️ Architecture

### Système de rôles

| Rôle | Accès |
|------|-------|
| **Super-Administrateur** (`is_superuser`) | Gère toute la plateforme : entreprises, utilisateurs, abonnements |
| **Administrateur d'entreprise** (`role.code = administrateur`) | Gère son entreprise et ses modules BTP |
| **Directeur** (`role.code = directeur`) | Gestion avancée au sein de l'entreprise |
| **Chef de chantier** (`role.code = chef_chantier`) | Pilotage opérationnel de chantiers |
| **Employé** (`role.code = employe`) | Accès restreint |

### Espaces dédiés

- **Espace Super-Admin** → `/super-admin/` — Tableau de bord de la plateforme
- **Espace Entreprise** → `/` — Tableau de bord de l'entreprise

### Modules BTP

| Module | App | Fonctionnalités |
|--------|-----|-----------------|
| **Chantiers** | `chantiers` | Chantiers, phases, incidents |
| **Ressources Humaines** | `rh` | Employés, équipes, pointages |
| **Matériels** | `materiels` | Inventaire, affectations, maintenances, alertes |
| **Stocks** | `stocks` | Articles, fournisseurs, mouvements de stock |
| **Commercial** | `commercial` | Clients, devis, contrats, factures, paiements |

### Multi-Tenant

Chaque entreprise voit uniquement ses propres données grâce au `EntrepriseMiddleware`
qui injecte `request.entreprise` sur chaque requête.

## 🚀 Installation

### Prérequis

- Python 3.10+
- Django 5.0+ (voir `requirements.txt`)

### Installation

```bash
# 1. Cloner le projet
git clone https://github.com/Zaraniaina/Tia-Buid.git
cd "Tia-Buid"

# 2. Créer et activer l'environnement virtuel
python -m venv .venv
source .venv/bin/activate   # Linux/Mac
.venv\Scripts\activate      # Windows

# 3. Installer les dépendances
pip install -r requirements.txt

# 4. Appliquer les migrations
ython  manage.py makemigrations
python manage.py migrate

# 5. Créer les données de démonstration
python manage.py seed_demo

# 6. Lancer le serveur
python manage.py runserver
```

## 👤 Comptes de démonstration

Après exécution de `python manage.py seed_demo` :

| Compte | Mot de passe | Rôle |
|--------|-------------|------|
| `admin@tia-build.mg` | `admin123` | Super-Administrateur |
| `admin@btp-madagascar.mg` | `admin123` | Administrateur (BTP Construction Madagascar) |

## 📋 Fonctionnalités

### Super-Administrateur
- ✅ Tableau de bord avec KPIs globaux (entreprises, utilisateurs, abonnements)
- ✅ Gestion complète des entreprises (liste, détail, activation/désactivation, changement d'abonnement)
- ✅ Gestion des utilisateurs
- ✅ Répartition par abonnement et par rôle

### Inscription d'entreprise
- ✅ Formulaire d'inscription en un clic (entreprise + administrateur)
- ✅ Création automatique du compte administrateur
- ✅ Connexion automatique après inscription
- ✅ Plan d'essai gratuit par défaut

### Modules BTP
- ✅ **Chantiers** : CRUD complet, phases, incidents, budget
- ✅ **RH** : Employés, équipes, pointages
- ✅ **Matériels** : Inventaire, maintenances, alertes
- ✅ **Stocks** : Articles, seuils d'alerte, mouvements (entrée/sortie)
- ✅ **Commercial** : Clients, devis, factures, paiements

### Design
- ✅ Design system personnalisé (couleurs TIA, typographie)
- ✅ Responsive (mobile, tablette, desktop)
- ✅ Navigation adaptative selon le rôle
- ✅ Thème sombre élégant

## 📁 Structure du projet

```
buid/
├── accounts/          # Authentification, utilisateurs, entreprises, rôles
├── core/              # Dashboard, middleware multi-tenant, vues principales
├── chantiers/         # Gestion des chantiers, phases, incidents
├── rh/                # Ressources humaines (employés, équipes, pointages)
├── materiels/         # Gestion des matériels, maintenances, alertes
├── stocks/            # Gestion des stocks, articles, fournisseurs
├── commercial/        # Module commercial (clients, devis, factures)
├── templates/         # Templates HTML (base.html + templates par module)
├── static/            # CSS, images, polices
├── config/            # Configuration Django (settings, urls, wsgi)
└── manage.py
```

## 🔧 Commandes utiles

```bash
# Créer un super-utilisateur
python manage.py createsuperuser

# Créer les données de démonstration
python manage.py seed_demo

# Lancer le serveur de développement
python manage.py runserver

# Appliquer les migrations
python manage.py migrate

# Créer de nouvelles migrations
python manage.py makemigrations
```

## 🌐 URLs principales

| URL | Description |
|-----|-------------|
| `/` | Dashboard entreprise |
| `/comptes/connexion/` | Connexion |
| `/comptes/inscription/` | Inscription entreprise |
| `/chantiers/` | Gestion des chantiers |
| `/rh/` | Ressources humaines |
| `/materiels/` | Gestion des matériels |
| `/stocks/` | Gestion des stocks |
| `/commercial/` | Module commercial |
| `/admin/` | Admin Django |

## 📄 Licence

Projet développé pour TIA INFO BUILD — Madagascar.
