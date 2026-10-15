export default {
  transform: {
    '^.+\\.(t|j)sx?$': '@swc/jest',
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  globalSetup: './src/tests/testSetup.ts',
  globalTeardown: './src/tests/testTeardown.ts',
  testMatch: ['<rootDir>/src/tests/e2e/**/*.e2e.test.ts'],
};