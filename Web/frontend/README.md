# 💻 Frontend — TIA INFO BUILD (React + TypeScript + Vite)

Interface web de l'application de gestion BTP **TIA INFO BUILD**.

---

## 📋 Prérequis

- Node.js 18+
- npm
- Backend FastAPI démarré sur http://localhost:8000

---

## 🚀 Démarrage

```powershell
cd Web/frontend

# Installer les dépendances (une seule fois)
npm install

# Lancer le serveur de développement
npm run dev
```

- **Application** : [http://localhost:5173](http://localhost:5173)
- **Proxy API** : les requêtes `/api/*` sont redirigées vers `http://localhost:8000` (voir `vite.config.ts`)

---

## 🧪 Tests

```powershell
# Vérification TypeScript
npx tsc -b

# Lint
npm run lint

# Build de production
npm run build
```

---

## 📁 Structure

```
src/
├── components/       # Composants réutilisables (layout, charts, UI)
├── pages/            # Pages de l'application (settings, dashboard, commercial, etc.)
├── services/         # Appels API (axios)
├── stores/           # State management (Zustand)
├── types/            # Types TypeScript
├── utils/            # Helpers (permissions, formatters)
├── styles/           # CSS, Bootstrap, thème TIA
├── config/           # Configuration (rôles, permissions)
└── App.tsx           # Routage principal
```

---

## 🔑 Comptes de démo

Se connecter avec un des comptes définis dans [`Web/README_Web.md`](../README_Web.md).

---

## ⚙️ Variables d'environnement

Le fichier `.env` à la racine de `Web/frontend/` contient :

```env
VITE_API_URL=/api
```

Le proxy Vite redirige automatiquement `/api` vers le backend FastAPI.

---

## 🛠️ Dépannage

- Port 5173 occupé : changer le port dans `vite.config.ts`
- Erreur CORS : vérifier que le backend est démarré et que `CORS_ORIGINS` dans `Web/backend/.env` inclut `http://localhost:5173`
- 404 sur les routes : vérifier que le backend a bien redémarré après les correctifs de préfixes
