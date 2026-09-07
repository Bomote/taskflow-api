export default {
  transform: {
    '^.+\\.(t|j)sx?$': '@swc/jest',
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  globalSetup: './src/tests/testSetup.ts',
  globalTeardown: './src/tests/testTeardown.ts',
};