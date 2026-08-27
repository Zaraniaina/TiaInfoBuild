// Desktop/controllers/financeController.js
const db = require('../models/db')
/**
 * Contrôleur Main Process - Module Finance & Alertes
 */
class FinanceController {
  constructor(repos) {
    this.repos = repos
  }

  // --- DÉPENSES ---
  async getDepensesByChantier(event, chantierId) {
    try {
      const items = this.repos.depenses.getByChantier(chantierId)
      return { success: true, data: items }
    } catch (error) {
      console.error('FinanceController.getDepensesByChantier error:', error)
      return { success: false, error: error.message }
    }
  }

  async getTotalDepensesByChantier(event, chantierId) {
    try {
      const total = this.repos.depenses.getTotalByChantier(chantierId)
      return { success: true, data: total }
    } catch (error) {
      console.error('FinanceController.getTotalDepensesByChantier error:', error)
      return { success: false, error: error.message }
    }
  }

  async getDepensesByCategorie(event, chantierId) {
    try {
      const items = this.repos.depenses.getByCategorie(chantierId)
      return { success: true, data: items }
    } catch (error) {
      console.error('FinanceController.getDepensesByCategorie error:', error)
      return { success: false, error: error.message }
    }
  }

  async getDepensesEnAttenteValidation(event, entrepriseId) {
    try {
      const items = this.repos.depenses.getEnAttenteValidation(entrepriseId)
      return { success: true, data: items }
    } catch (error) {
      console.error('FinanceController.getDepensesEnAttenteValidation error:', error)
      return { success: false, error: error.message }
    }
  }

  // --- ALERTES ---
  async getAlertesNonLues(event, entrepriseId, limit) {
    try {
      const items = this.repos.alertes.getNonLues(entrepriseId, limit)
      return { success: true, data: items }
    } catch (error) {
      console.error('FinanceController.getAlertesNonLues error:', error)
      return { success: false, error: error.message }
    }
  }

  async marquerAlerteLue(event, id) {
    try {
      const result = this.repos.alertes.marquerLue(id)
      return { success: true, data: result }
    } catch (error) {
      console.error('FinanceController.marquerAlerteLue error:', error)
      return { success: false, error: error.message }
    }
  }

  async marquerToutesAlertesLues(event, entrepriseId) {
    try {
      const result = this.repos.alertes.marquerToutesLues(entrepriseId)
      return { success: true, data: result }
    } catch (error) {
      console.error('FinanceController.marquerToutesAlertesLues error:', error)
      return { success: false, error: error.message }
    }
  }

  async creerAlerte(event, data) {
    try {
      const result = this.repos.alertes.creer(data)
      return { success: true, data: result }
    } catch (error) {
      console.error('FinanceController.creerAlerte error:', error)
      return { success: false, error: error.message }
    }
  }

  async countAlertesNonLues(event, entrepriseId) {
    try {
      const count = this.repos.alertes.countNonLues(entrepriseId)
      return { success: true, data: count }
    } catch (error) {
      console.error('FinanceController.countAlertesNonLues error:', error)
      return { success: false, error: error.message }
    }
  }

  async getTrésorerie(event, entrepriseId) {
    try {
      const today = db.prepare("SELECT date('now', 'localtime') as today").get().today
      const data = {
        aujourdhui: today,
        facturesJ30: { montant: 0, count: 0 },
        facturesJ60: { montant: 0, count: 0 },
        facturesJ90: { montant: 0, count: 0 },
        depensesJ30: { montant: 0, count: 0 },
        depensesJ60: { montant: 0, count: 0 },
        depensesJ90: { montant: 0, count: 0 },
        soldePrevisionnel: 0
      }

      const facturesJ30 = db.prepare(`
        SELECT SUM(COALESCE(montantTTC, montant, 0) - COALESCE(montantPaye, 0)) as montant, COUNT(*) as count
        FROM Facture WHERE entrepriseId = ? AND is_deleted = 0
        AND statut IN ('emise', 'envoyee', 'partiellement_payee', 'emis')
        AND dateEcheance >= ? AND dateEcheance < date(?, '+30 days')
      `).get(entrepriseId, today, today)
      data.facturesJ30 = { montant: facturesJ30?.montant || 0, count: facturesJ30?.count || 0 }

      const facturesJ60 = db.prepare(`
        SELECT SUM(COALESCE(montantTTC, montant, 0) - COALESCE(montantPaye, 0)) as montant, COUNT(*) as count
        FROM Facture WHERE entrepriseId = ? AND is_deleted = 0
        AND statut IN ('emise', 'envoyee', 'partiellement_payee', 'emis')
        AND dateEcheance >= date(?, '+30 days') AND dateEcheance < date(?, '+60 days')
      `).get(entrepriseId, today, today)
      data.facturesJ60 = { montant: facturesJ60?.montant || 0, count: facturesJ60?.count || 0 }

      const facturesJ90 = db.prepare(`
        SELECT SUM(COALESCE(montantTTC, montant, 0) - COALESCE(montantPaye, 0)) as montant, COUNT(*) as count
        FROM Facture WHERE entrepriseId = ? AND is_deleted = 0
        AND statut IN ('emise', 'envoyee', 'partiellement_payee', 'emis')
        AND dateEcheance >= date(?, '+60 days') AND dateEcheance < date(?, '+90 days')
      `).get(entrepriseId, today, today)
      data.facturesJ90 = { montant: facturesJ90?.montant || 0, count: facturesJ90?.count || 0 }

      const depensesJ30 = db.prepare(`
        SELECT SUM(montant) as montant, COUNT(*) as count FROM Depense
        WHERE chantierId IN (SELECT id FROM Chantier WHERE entrepriseId = ? AND is_deleted = 0)
        AND is_deleted = 0 AND dateDepense >= ? AND dateDepense < date(?, '+30 days')
      `).get(entrepriseId, today, today)
      data.depensesJ30 = { montant: depensesJ30?.montant || 0, count: depensesJ30?.count || 0 }

      const depensesJ60 = db.prepare(`
        SELECT SUM(montant) as montant, COUNT(*) as count FROM Depense
        WHERE chantierId IN (SELECT id FROM Chantier WHERE entrepriseId = ? AND is_deleted = 0)
        AND is_deleted = 0 AND dateDepense >= date(?, '+30 days') AND dateDepense < date(?, '+60 days')
      `).get(entrepriseId, today, today)
      data.depensesJ60 = { montant: depensesJ60?.montant || 0, count: depensesJ60?.count || 0 }

      const depensesJ90 = db.prepare(`
        SELECT SUM(montant) as montant, COUNT(*) as count FROM Depense
        WHERE chantierId IN (SELECT id FROM Chantier WHERE entrepriseId = ? AND is_deleted = 0)
        AND is_deleted = 0 AND dateDepense >= date(?, '+60 days') AND dateDepense < date(?, '+90 days')
      `).get(entrepriseId, today, today)
      data.depensesJ90 = { montant: depensesJ90?.montant || 0, count: depensesJ90?.count || 0 }

      const caPaye = db.prepare(`
        SELECT SUM(montantPaye) as total FROM Facture
        WHERE entrepriseId = ? AND is_deleted = 0
      `).get(entrepriseId)?.total || 0
      const totalDepenses = db.prepare(`
        SELECT SUM(montant) as total FROM Depense
        WHERE chantierId IN (SELECT id FROM Chantier WHERE entrepriseId = ? AND is_deleted = 0)
        AND is_deleted = 0
      `).get(entrepriseId)?.total || 0
      data.soldePrevisionnel = caPaye - totalDepenses

      return { success: true, data }
    } catch (error) {
      console.error('FinanceController.getTrésorerie error:', error)
      return { success: false, error: error.message }
    }
  }

  async getFinancesSante(event, entrepriseId) {
    try {
      const data = {
        caTotal: 0,
        totalFactures: 0,
        totalPaye: 0,
        totalEnRetard: 0,
        totalDepenses: 0,
        margeGlobale: 0,
        ratioRecouvrement: 0,
        rentabiliteChantiers: []
      }

      const caTotal = db.prepare(`
        SELECT SUM(COALESCE(montantTTC, montant, 0)) as total FROM Facture
        WHERE entrepriseId = ? AND is_deleted = 0
      `).get(entrepriseId)?.total || 0
      data.caTotal = caTotal

      const totalFactures = db.prepare(`
        SELECT SUM(COALESCE(montantTTC, montant, 0)) as total FROM Facture
        WHERE entrepriseId = ? AND is_deleted = 0
      `).get(entrepriseId)?.total || 0
      data.totalFactures = totalFactures

      const totalPaye = db.prepare(`
        SELECT SUM(montantPaye) as total FROM Facture
        WHERE entrepriseId = ? AND is_deleted = 0
      `).get(entrepriseId)?.total || 0
      data.totalPaye = totalPaye

      const totalEnRetard = db.prepare(`
        SELECT SUM(COALESCE(montantTTC, montant, 0) - COALESCE(montantPaye, 0)) as total
        FROM Facture WHERE entrepriseId = ? AND is_deleted = 0
        AND statut IN ('emise', 'envoyee', 'partiellement_payee', 'emis')
        AND dateEcheance < date('now', 'localtime')
      `).get(entrepriseId)?.total || 0
      data.totalEnRetard = totalEnRetard

      const totalDepenses = db.prepare(`
        SELECT SUM(montant) as total FROM Depense
        WHERE chantierId IN (SELECT id FROM Chantier WHERE entrepriseId = ? AND is_deleted = 0)
        AND is_deleted = 0
      `).get(entrepriseId)?.total || 0
      data.totalDepenses = totalDepenses

      data.margeGlobale = caTotal - totalDepenses
      data.ratioRecouvrement = totalFactures > 0 ? Math.round((totalPaye / totalFactures) * 100) : 0

      const chantiers = db.prepare(`
        SELECT id, nom, budgetPrevu, budgetReel FROM Chantier
        WHERE entrepriseId = ? AND is_deleted = 0 AND budgetPrevu > 0
        ORDER BY budgetReel DESC LIMIT 5
      `).all(entrepriseId)
      data.rentabiliteChantiers = chantiers.map(c => ({
        id: c.id,
        nom: c.nom,
        budgetPrevu: c.budgetPrevu || 0,
        budgetReel: c.budgetReel || 0,
        marge: (c.budgetReel || 0) - (c.budgetPrevu || 0),
        pctMarge: c.budgetPrevu > 0 ? Math.round(((c.budgetReel || 0) / c.budgetPrevu) * 100) : 0
      }))

      return { success: true, data }
    } catch (error) {
      console.error('FinanceController.getFinancesSante error:', error)
      return { success: false, error: error.message }
    }
  }

  async validerDepense(event, depenseId, data) {
    try {
      const depense = this.repos.depenses.getById(depenseId)
      if (!depense) return { success: false, error: 'Dépense non trouvée' }

      const user = event.user || _session
      const userRoles = getSessionRoles ? getSessionRoles() : []
      const isAdmin = userRoles.includes('ADMIN')
      const isComptable = userRoles.includes('COMPTABLE')
      const isChefChantier = userRoles.includes('CHEF_CHANTIER')

      let statut = data?.statutValidation || 'validee'
      let niveauValidation = data?.niveauValidation || 1

      if (!isAdmin && !isComptable && !isChefChantier) {
        return { success: false, error: 'Vous n\'avez pas les droits pour valider cette dépense' }
      }

      if (statut === 'validee' && !isAdmin && !isComptable) {
        return { success: false, error: 'Seul le Comptable ou l\'Administrateur peut valider définitivement une dépense' }
      }

      const updateData = {
        statutValidation: statut,
        valideePar: user?.id || data?.valideePar,
        updated_at: new Date().toISOString()
      }

      if (niveauValidation === 1 && isChefChantier && !isComptable) {
        updateData.statutValidation = 'en_attente_comptable'
      }

      const result = this.repos.depenses.update(depenseId, updateData)

      if (data?.envoyerNotification && result) {
        try {
          this.repos.notifications.create({
            entrepriseId: depense.entrepriseId || user.entrepriseId,
            utilisateurId: depense.valideePar || user.id,
            titre: `Dépense ${statut === 'validee' ? 'validée' : statut === 'refusee' ? 'refusée' : 'en attente'}`,
            message: `La dépense #${depenseId} d'un montant de ${depense.montant} Ar a été ${statut === 'validee' ? 'validée' : statut === 'refusee' ? 'refusée' : 'mise en attente de validation comptable'}.`,
            type: statut === 'refusee' ? 'avertissement' : 'info'
          })
        } catch (notifErr) {
          console.warn('Notification creation failed:', notifErr)
        }
      }

      return { success: true, data: result }
    } catch (error) {
      console.error('FinanceController.validerDepense error:', error)
      return { success: false, error: error.message }
    }
  }

  async getDepensesEnAttenteComptable(event, entrepriseId) {
    try {
      const items = this.repos.depenses.getEnAttenteComptable(entrepriseId)
      return { success: true, data: items }
    } catch (error) {
      console.error('FinanceController.getDepensesEnAttenteComptable error:', error)
      return { success: false, error: error.message }
    }
  }

  async envoyerRappel(event, factureId) {
    try {
      const facture = this.repos.factures.getWithPaiements(factureId)
      if (!facture) return { success: false, error: 'Facture non trouvée' }

      const entreprise = db.prepare('SELECT * FROM Entreprise WHERE id = ?').get(facture.entrepriseId)
      const client = db.prepare('SELECT * FROM Client WHERE id = ?').get(facture.clientId)

      if (!client?.email) return { success: false, error: 'Le client n\'a pas d\'adresse email' }

      const smtpConfig = {
        host: entreprise?.smtpHost,
        port: entreprise?.smtpPort || 587,
        user: entreprise?.smtpUser,
        pass: entreprise?.smtpPass,
        from: entreprise?.smtpFrom || entreprise?.email,
        secure: entreprise?.smtpSecure === 1
      }

      if (!smtpConfig.host) return { success: false, error: 'Configuration SMTP manquante' }

      const html = `
        <h2>Relance facture ${facture.numero}</h2>
        <p>Bonjour,</p>
        <p>Nous vous rappelons que la facture ${facture.numero} d'un montant de ${(facture.resteAPayer || 0).toFixed(2)} ${entreprise?.devise || 'MGA'} n'a pas été réglée à ce jour.</p>
        <p>Date d'émission: ${facture.dateEmission}</p>
        <p>Date d'échéance: ${facture.dateEcheance}</p>
        <p>Nous vous invitons à régulariser votre situation dans les plus brefs délais.</p>
        <p>Cordialement,<br>${entreprise?.nom || 'TIA INFO BUILD'}</p>
      `

      await sendInvoiceEmail({
        to: client.email,
        subject: `Relance: Facture ${facture.numero} - ${entreprise?.nom || 'TIA INFO BUILD'}`,
        html,
        pdfBuffer: null,
        pdfFilename: null,
        smtpConfig
      })

      if (client.dernierRappel === undefined) {
        db.prepare(`UPDATE Client SET dernierRappel = ? WHERE id = ?`).run(new Date().toISOString(), client.id)
      } else {
        db.prepare(`UPDATE Client SET dernierRappel = ? WHERE id = ?`).run(new Date().toISOString(), client.id)
      }

      return { success: true, message: 'Rappel envoyé par email' }
    } catch (error) {
      console.error('FinanceController.envoyerRappel error:', error)
      return { success: false, error: error.message }
    }
  }
}

module.exports = FinanceController