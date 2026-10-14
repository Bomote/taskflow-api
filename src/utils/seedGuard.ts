type SeedEnv = Record<string, string | undefined>;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function stripPort(host: string): string {
  if (host.startsWith('[')) {
    const end = host.indexOf(']');
    return end === -1 ? host : host.slice(1, end);
  }
  const colon = host.indexOf(':');
  return colon === -1 ? host : host.slice(0, colon);
}


export function areAllHostsLocal(uri: string): boolean {
  const trimmed = uri.trim();
  const scheme = /^mongodb(\+srv)?:\/\//i.exec(trimmed);

  if (!scheme || scheme[1]) {
    return false;
  }

  const rest = trimmed.slice(scheme[0].length);
  const authority = rest.split(/[/?]/, 1)[0] ?? '';
  const hostList = authority.slice(authority.lastIndexOf('@') + 1);

  if (!hostList) {
    return false;
  }

  return hostList
    .split(',')
    .every((entry) => LOCAL_HOSTS.has(stripPort(entry.trim().toLowerCase())));
}


export function assertSeedAllowed(env: SeedEnv): void {
  if (env.CONFIRM_SEED !== 'true') {
    throw new Error("Refusing to seed: CONFIRM_SEED must be set to exactly 'true'.");
  }

  const looksLikeProduction =
    env.NODE_ENV === 'production' || !areAllHostsLocal(env.MONGODB_URI ?? '');

  if (looksLikeProduction && env.ALLOW_PRODUCTION_SEED !== 'true') {
    throw new Error(
      "Refusing to seed: the target looks like production (NODE_ENV=production or a non-local database host). " +
        "Also set ALLOW_PRODUCTION_SEED to exactly 'true' to proceed."
    );
  }
}