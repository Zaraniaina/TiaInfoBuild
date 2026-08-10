process.env.TIA_TEST_DB = '1';

const { initDatabase } = require('../models/init');
const db = require('../models/db');

beforeAll(() => {
  initDatabase();
});

afterAll(() => {
  db.close();
});
