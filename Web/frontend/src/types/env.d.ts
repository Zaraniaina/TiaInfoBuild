/* Typage des variables d'environnement Vite (.env, .env.desktop).
   Déclarations globales (fichier sans import/export) : elles fusionnent
   avec `ImportMetaEnv` fourni par `vite/client`. */

interface ImportMetaEnv {
  /** 'desktop' pour le build Tauri (`vite build --mode desktop`), absent pour le web. */
  readonly VITE_BUILD_TARGET?: string
  /** URL de base de l'API FastAPI (défaut : http://localhost:8000/api). */
  readonly VITE_API_URL?: string
  /** '1' pour piloter l'UI desktop sur le sidecar FastAPI local (expérimental :
   * requiert la base partagée avec les hubs Rust — OFF par défaut). */
  readonly VITE_SIDECAR_HTTP?: string
}
