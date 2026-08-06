// Exécuté AVANT tout import de module (via jest.config setupFiles)
// Force l'utilisation d'une BDD temporaire pour les tests
const path = require('path');
const os = require('os');

process.env.TIA_TEST_DB_PATH = path.join(os.tmpdir(), `tia_test_${process.pid}.sqlite`);