export default {
  transform: {
    '^.+\\.(t|j)sx?$': '@swc/jest',
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  globalSetup: './src/test/testSetup.ts',
  globalTeardown: './src/test/testTeardown.ts',
};