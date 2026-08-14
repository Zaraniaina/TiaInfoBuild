process.env.TIA_TEST_DB = require('path').join(__dirname, 'test.db');

const { initDatabase } = require('../models/init');
const db = require('../models/db');

beforeAll(() => {
  initDatabase();
});

afterAll(() => {
  db.close();
});
