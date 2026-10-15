import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const serverEntry = fileURLToPath(new URL('../../../dist/server.js', import.meta.url));
const describeOnPosix = process.platform === 'win32' ? describe.skip : describe;

const startedChildren: ChildProcess[] = [];

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

async function startServer() {
  if (!existsSync(serverEntry)) {
    throw new Error('dist/server.js not found. Run `npm run build` before `npm run test:e2e`.');
  }

  const port = await getFreePort();

  const env: NodeJS.ProcessEnv = { ...process.env, PORT: String(port), JWT_SECRET: 'e2e-test-secret' };
  delete env.NODE_OPTIONS;

  const child = spawn(process.execPath, [serverEntry], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  startedChildren.push(child);

  let output = '';
  child.stdout?.on('data', (chunk) => (output += chunk));
  child.stderr?.on('data', (chunk) => (output += chunk));

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Server did not start in time. Output so far:\n${output}`)), 20_000);
    const poll = setInterval(() => {
      if (output.includes('Server listening on port')) {
        clearTimeout(timer);
        clearInterval(poll);
        resolve();
      }
    }, 50);
    child.once('exit', (code) => {
      clearTimeout(timer);
      clearInterval(poll);
      reject(new Error(`Server exited early with code ${code}. Output:\n${output}`));
    });
  });

  return { child, port, getOutput: () => output };
}

afterEach(() => {
  for (const child of startedChildren.splice(0)) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
    }
  }
});

describeOnPosix.each(['SIGTERM', 'SIGINT'] as const)('graceful shutdown on %s', (signal) => {
  test('serves traffic, then closes HTTP and the database and exits with code 0', async () => {
    const { child, port, getOutput } = await startServer();

    const ready = await fetch(`http://127.0.0.1:${port}/health/ready`);
    expect(ready.status).toBe(200);
    expect(await ready.json()).toEqual({ status: 'ok' });

    const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
      child.once('exit', (code, exitSignal) => resolve({ code, signal: exitSignal }));
    });

    child.kill(signal);

    expect(await exited).toEqual({ code: 0, signal: null });

    const log = getOutput();
    expect(log).toContain(`${signal} received`);
    expect(log).toContain('Database connection closed.');
    expect(log).toContain('Shutdown complete.');

    await expect(fetch(`http://127.0.0.1:${port}/health/live`)).rejects.toThrow();
  }, 40_000);
});