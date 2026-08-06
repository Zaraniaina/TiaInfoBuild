const { initTestDb, resetData, closeDb, getDb } = require('../setup/dbHelper');

jest.mock('axios');
const axios = require('axios');

let handleLogin, handleRegister, hashPassword, verifyPassword, db;

beforeAll(() => {
  initTestDb();
  db = getDb();
  ({ handleLogin, handleRegister, hashPassword, verifyPassword } =
    require('../../controllers/authController'));
});
afterAll(() => closeDb());
beforeEach(() => { resetData(); jest.clearAllMocks(); });

describe('Hachage des mots de passe', () => {
  test('hashPassword() produit un SHA-256 de 64 caractères', () => {
    expect(hashPassword('admin123')).toHaveLength(64);
    expect(hashPassword('')).toBe('');
  });

  test('verifyPassword() valide un hash correct et rejette un faux', () => {
    const hash = hashPassword('monMotDePasse');
    expect(verifyPassword('monMotDePasse', hash)).toBe(true);
    expect(verifyPassword('mauvais', hash)).toBe(false);
  });

  test('verifyPassword() fallback texte brut (héritage sync)', () => {
    expect(verifyPassword('plain', 'plain')).toBe(true);
  });
});

describe('handleLogin — utilisateur local', () => {
  test('connexion réussie avec le compte seedé', async () => {
    const res = await handleLogin({}, { email: 'admin@tiabuild.com', password: 'admin123' });
    expect(res.success).toBe(true);
    expect(res.user.email).toBe('admin@tiabuild.com');
  });

  test('mot de passe incorrect refusé', async () => {
    const res = await handleLogin({}, { email: 'admin@tiabuild.com', password: 'wrong' });
    expect(res.success).toBe(false);
    expect(res.message).toBe('Mot de passe incorrect.');
  });

  test('champs manquants rejetés', async () => {
    const res = await handleLogin({}, { email: '', password: '' });
    expect(res.success).toBe(false);
  });
});

describe('handleLogin — première connexion via Django', () => {
  test('utilisateur distant créé en local avec mot de passe haché', async () => {
    axios.post.mockResolvedValueOnce({
      data: {
        token: 'jwt-token-123',
        user: { id: 55, nom: 'Distant', prenom: 'User', email: 'distant@web.mg', roleId: 1, entrepriseId: 1 }
      }
    });
    const res = await handleLogin({}, { email: 'distant@web.mg', password: 'pwd2026' });
    expect(res.success).toBe(true);
    expect(res.token).toBe('jwt-token-123');
    const local = db.prepare('SELECT * FROM Utilisateur WHERE email = ?').get('distant@web.mg');
    expect(local).toBeDefined();
    expect(local.motDePasseHash).toBe(hashPassword('pwd2026'));
  });

  test('serveur Django injoignable → message clair', async () => {
    axios.post.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const res = await handleLogin({}, { email: 'nouveau@web.mg', password: 'x' });
    expect(res.success).toBe(false);
    expect(res.message).toContain('Impossible de joindre');
  });
});

describe('handleRegister', () => {
  test('mode hors ligne : création locale entreprise + utilisateur', async () => {
    axios.post.mockRejectedValueOnce(new Error('réseau down'));
    const res = await handleRegister({}, {
      nom: 'Rakoto', prenom: 'Jean',
      email: 'rakoto@entreprise.mg', password: 'pwd123',
      entreprise: 'Rakoto BTP'
    });
    expect(res.success).toBe(true);
    expect(res.message).toContain('Mode Hors Ligne');
    expect(res.user.email).toBe('rakoto@entreprise.mg');

    const ent = db.prepare("SELECT * FROM Entreprise WHERE nom = 'Rakoto BTP'").get();
    expect(ent.is_synced).toBe(0); // en attente de sync
    const user = db.prepare("SELECT * FROM Utilisateur WHERE email = 'rakoto@entreprise.mg'").get();
    expect(user.motDePasseHash).toHaveLength(64);
  });

  test('validation : champs obligatoires', async () => {
    const res = await handleRegister({}, { email: '', password: '', entreprise: '' });
    expect(res.success).toBe(false);
  });

  test('inscription réussie via serveur Django', async () => {
    axios.post.mockResolvedValueOnce({ data: { user_id: 99, entreprise_id: 88 } });
    const res = await handleRegister({}, {
      nom: 'Solo', prenom: 'Test',
      email: 'solo@web.mg', password: 'pwd',
      entreprise: 'Solo SARL'
    });
    expect(res.success).toBe(true);
    expect(res.message).toContain('synchronisée');
  });

  test('deux inscriptions avec le même email ne créent pas de doublon', async () => {
    axios.post.mockRejectedValue(new Error('offline'));
    await handleRegister({}, { nom: 'A', email: 'double@tia.mg', password: 'p1', entreprise: 'E1' });
    const res2 = await handleRegister({}, { nom: 'B', email: 'double@tia.mg', password: 'p2', entreprise: 'E2' });
    expect(res2.success).toBe(false);
    const count = db.prepare("SELECT COUNT(*) c FROM Utilisateur WHERE email = 'double@tia.mg'").get().c;
    expect(count).toBe(1);
  });
});