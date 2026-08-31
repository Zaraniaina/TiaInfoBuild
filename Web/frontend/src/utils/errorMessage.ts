export function formatErrorMessage(error: any, fallbackMessage: string = 'Une erreur est survenue.'): string {
  if (!error) return fallbackMessage

  const response = error?.response
  const status = response?.status
  const detail = response?.data?.detail

  // Message spécifique retourné par le backend
  if (detail) {
    if (typeof detail === 'string') {
      if (detail.includes('Un utilisateur avec cet email existe déjà') || detail.includes('Email déjà utilisé')) {
        return 'Un utilisateur avec cette adresse email existe déjà.'
      }
      if (detail.includes('Limite atteinte')) {
        return detail
      }
      if (detail.includes('Email ou mot de passe incorrect') || detail.includes('Could not validate credentials')) {
        return 'Email ou mot de passe incorrect.'
      }
      if (detail.includes('Ancien mot de passe incorrect')) {
        return 'L\'ancien mot de passe saisi est incorrect.'
      }
      return detail
    }
    if (Array.isArray(detail)) {
      return detail.map((e: any) => e.msg || String(e)).join(', ')
    }
  }

  // Codes HTTP standard
  if (status === 401) {
    return 'Votre session a expiré ou le mot de passe est incorrect. Veuillez vous reconnecter.'
  }
  if (status === 403) {
    return 'Vous n\'avez pas les permissions nécessaires pour effectuer cette action.'
  }
  if (status === 404) {
    return 'La ressource demandée est introuvable.'
  }
  if (status === 409) {
    return 'Cette donnée existe déjà (conflit d\'enregistrement).'
  }
  if (status === 422) {
    return 'Veuillez vérifier les informations saisies dans le formulaire.'
  }
  if (status >= 500) {
    return 'Une erreur interne est survenue sur le serveur. Veuillez réessayer ultérieurement.'
  }

  if (error.message && typeof error.message === 'string') {
    if (error.message.includes('Network Error')) {
      return 'Impossible de contacter le serveur backend. Veuillez vérifier que le serveur est démarré.'
    }
    return error.message
  }

  return fallbackMessage
}
