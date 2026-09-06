export default async function globalTeardown() {
  const instance = globalThis.__MONGO_INSTANCE__;

  if (instance) {
    await instance.stop();
    console.log('[globalTeardown] in-memory MongoDB stopped');
  }
}