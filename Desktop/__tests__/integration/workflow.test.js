/**
 * TEST D'INTÉGRATION — Parcours utilisateur complet
 */
const { initTestDb, resetData, closeDb, getDb } = require('../setup/dbHelper');

jest.mock('axios');
const axios = require('axios');

let db, handleLogin, handleRegister;
let repos = {}, ctrl = {};

beforeAll(() => {
  initTestDb();
  db = getDb();
  ({ handleLogin, handleRegister } = require('../../controllers/authController'));

  repos.chantiers = new (require('../../models/repositories/ChantierRepository'))();
  repos.clients = new (require('../../models/repositories/ClientRepository'))();
  repos.devis = new (require('../../models/repositories/DevisRepository'))();
  repos.contrats = new (require('../../models/repositories/ContratRepository'))();
  repos.factures = new (require('../../models/repositories/FactureRepository'))();
  repos.depenses = new (require('../../models/repositories/DepenseRepository'))();
  repos.articles = new (require('../../models/repositories/ArticleRepository'))();
  repos.employes = new (require('../../models/repositories/EmployeRepository'))();
  repos.alertes = new (require('../../models/repositories/AlerteRepository'))();
  repos.dashboard = new (require('../../models/repositories/DashboardRepository'))();
  repos.incidents = new (require('../../models/repositories/IncidentRepository'))();

  ctrl.commercial = new (require('../../controllers/commercialController'))(repos);
  ctrl.chantier = new (require('../../controllers/chantierController'))(repos);
  ctrl.dashboard = new (require('../../controllers/dashboardController'))(repos);
});
afterAll(() => closeDb());
beforeEach(() => { resetData(); jest.clearAllMocks(); });

describe('Workflow métier complet — BTP', () => {
  test('Parcours : inscription hors ligne → connexion → cycle commercial complet', async () => {
    axios.post.mockRejectedValue(new Error('offline'));
    const register = await handleRegister({}, {
      nom: 'Rakoto', prenom: 'Jean',
      email: 'jean@btp.mg', password: 'pwd2026',
      entreprise: 'BTP Rakoto'
    });
    expect(register.success).toBe(true);
    const entrepriseId = register.user.entrepriseId;

    const login = await handleLogin({}, { email: 'jean@btp.mg', password: 'pwd2026' });
    expect(login.success).toBe(true);

    const client = await ctrl.commercial.createClient({}, { nom: 'Mairie de Tana' }, entrepriseId);
    expect(client.success).toBe(true);

    const devis = await ctrl.commercial.createDevis({}, {
      clientId: client.data.id,
      lignes: [
        { description: 'Réfection route', quantite: 100, prixUnitaire: 50 },
        { description: 'Signalisation', quantite: 10, prixUnitaire: 200 }
      ]
    }, entrepriseId);
    expect(devis.data.montantTotal).toBe(7000);

    await ctrl.commercial.updateDevis({}, devis.data.id, { statut: 'accepte' });
    const contrat = await ctrl.commercial.transformerDevisEnContrat({}, devis.data.id, { entrepriseId });
    expect(contrat.data.montant).toBe(7000);

    const chantier = await ctrl.chantier.create({}, {
      nom: 'Route RN7 - Section A', budgetPrevu: 7000
    }, entrepriseId);
    await ctrl.chantier.addPhase({}, chantier.data.id, { nom: 'Terrassement', budget: 3000 });
    await ctrl.chantier.addPhase({}, chantier.data.id, { nom: 'Goudronnage', budget: 4000 });
    expect((await ctrl.chantier.getPhasesByChantier({}, chantier.data.id)).data).toHaveLength(2);

    const facture = await ctrl.commercial.createFacture({}, {
      contratId: contrat.data.id, montant: 7000, dateEcheance: '2026-09-30'
    }, entrepriseId);
    await ctrl.commercial.ajouterPaiementFacture({}, facture.data.id, { montant: 3000 });
    let f = repos.factures.getWithPaiements(facture.data.id);
    expect(f.resteAPayer).toBe(4000);
    await ctrl.commercial.ajouterPaiementFacture({}, facture.data.id, { montant: 4000 });
    f = repos.factures.getWithPaiements(facture.data.id);
    expect(f.estPayee).toBe(true);

    repos.depenses.create({ chantierId: chantier.data.id, montant: 2500, categorie: 'Matériaux' });
    repos.depenses.create({ chantierId: chantier.data.id, montant: 1500, categorie: 'Main oeuvre' });
    const budget = await ctrl.chantier.recalculerBudget({}, chantier.data.id);
    expect(budget.data.budgetReel).toBe(4000);

    const stats = await ctrl.dashboard.getDashboardStats({}, entrepriseId);
    expect(stats.data.chantiers.total).toBe(1);
  });

  test('Parcours RH : employé → pointage → présents du jour', async () => {
    const e = repos.employes.createWithValidation({ nom: 'Ouvrier', prenom: 'Un', matricule: 'OUV-1' }, 1);
    repos.employes.pointer({ employeId: e.id, heureArrivee: '07:00', statut: 'present' });
    const presents = repos.employes.getPresentsToday(1);
    expect(presents.map(p => p.id)).toContain(e.id);
  });

  test('Parcours Stock : article → entrées/sorties → alerte stock bas', async () => {
    const a = repos.articles.create({ nom: 'Ciment', quantiteStock: 0, seuilAlerte: 10, unite: 'sac' }, 1);
    repos.articles.updateStock(a.id, 50, 'entree', { motif: 'Livraison fournisseur' });
    repos.articles.updateStock(a.id, 45, 'sortie', { motif: 'Consommation chantier' });
    const article = repos.articles.getById(a.id);
    expect(article.quantiteStock).toBe(5);
    expect(repos.articles.getEnAlerte(1).map(x => x.id)).toContain(a.id);

    repos.alertes.creer({
      entrepriseId: 1, typeEntite: 'Article', entiteId: a.id,
      message: `Stock bas : ${article.nom}`, niveauGravite: 'moyenne'
    });
    expect(repos.alertes.countNonLues(1)).toBe(1);
  });

  test('Parcours incident : déclaration → résolution', async () => {
    const c = await ctrl.chantier.create({}, { nom: 'Site B' }, 1);
    await ctrl.chantier.addIncident({}, c.data.id, { titre: 'Retard béton', gravite: 'elevee' }, 1);
    let ouverts = await ctrl.chantier.getIncidentsOuvertsByEntreprise({}, 1);
    expect(ouverts.data).toHaveLength(1);
    await ctrl.chantier.changerStatutIncident({}, ouverts.data[0].id, 'resolu');
    ouverts = await ctrl.chantier.getIncidentsOuvertsByEntreprise({}, 1);
    expect(ouverts.data).toHaveLength(0);
  });
});