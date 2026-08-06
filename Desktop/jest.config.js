module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/__tests__/setup/setEnv.js'],
  testMatch: ['**/__tests__/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/setup/'],
  testTimeout: 15000,
  verbose: true
};