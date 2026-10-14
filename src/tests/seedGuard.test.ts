import { areAllHostsLocal, assertSeedAllowed } from '../utils/seedGuard.ts';

const ATLAS_MULTI_HOST =
  'mongodb://user:pass@shard-00-00.abcde.mongodb.net:27017,shard-00-01.abcde.mongodb.net:27017,shard-00-02.abcde.mongodb.net:27017/taskflow?ssl=true&replicaSet=atlas-xyz-shard-0&authSource=admin';
const ATLAS_SRV = 'mongodb+srv://user:p%40ss@cluster0.abcde.mongodb.net/taskflow?retryWrites=true';
const LOCAL_URI = 'mongodb://127.0.0.1:52087/';

// ==========================================
// 1. HOST DETECTION (fails closed)
// ==========================================

test.each([
  ['in-memory test server', LOCAL_URI, true],
  ['localhost with credentials and a database', 'mongodb://admin:secret@localhost:27017/taskflow', true],
  ['bracketed IPv6 loopback', 'mongodb://[::1]:27017/taskflow', true],
  ['uppercase LOCALHOST', 'mongodb://LOCALHOST:27017', true],
  ['several local hosts', 'mongodb://localhost:27017,127.0.0.1:27018/db', true],
  ['Atlas multi-host (non-SRV)', ATLAS_MULTI_HOST, false],
  ['Atlas SRV', ATLAS_SRV, false],
  ['local host mixed with a remote host', 'mongodb://localhost:27017,db.example.com:27017/db', false],
  ['a host that merely starts with localhost', 'mongodb://localhost.evil.com:27017/db', false],
  ['a remote host with a local-looking credential', 'mongodb://localhost:pw@db.example.com:27017/db', false],
  ['an empty string', '', false],
  ['whitespace only', '   ', false],
  ['a missing host', 'mongodb:///db', false],
  ['nonsense', 'not-a-uri', false],
  ['a different scheme', 'postgres://localhost:5432/db', false],
])('areAllHostsLocal: %s', (_label, uri, expected) => {
  expect(areAllHostsLocal(uri)).toBe(expected);
});

// ==========================================
// 2. CONFIRMATION FLAG
// ==========================================

test.each([
  ['unset', undefined],
  ['empty', ''],
  ['false', 'false'],
  ['1', '1'],
  ['TRUE (wrong case)', 'TRUE'],
  ['yes', 'yes'],
  ['true with a trailing space', 'true '],
])('refuses when CONFIRM_SEED is %s', (_label, value) => {
  expect(() => assertSeedAllowed({ CONFIRM_SEED: value, MONGODB_URI: LOCAL_URI })).toThrow(
    /CONFIRM_SEED/
  );
});

// ==========================================
// 3. PRODUCTION SAFEGUARD
// ==========================================

test('allows a local database when explicitly confirmed', () => {
  expect(() =>
    assertSeedAllowed({ CONFIRM_SEED: 'true', MONGODB_URI: LOCAL_URI, NODE_ENV: 'test' })
  ).not.toThrow();
});

test('allows a local database when NODE_ENV is unset', () => {
  expect(() => assertSeedAllowed({ CONFIRM_SEED: 'true', MONGODB_URI: LOCAL_URI })).not.toThrow();
});

test.each([
  ['an Atlas multi-host URI', { MONGODB_URI: ATLAS_MULTI_HOST }],
  ['an Atlas SRV URI', { MONGODB_URI: ATLAS_SRV }],
  ['NODE_ENV=production on a local URI', { MONGODB_URI: LOCAL_URI, NODE_ENV: 'production' }],
  ['a missing MONGODB_URI', {}],
  ['an unparseable MONGODB_URI', { MONGODB_URI: 'garbage' }],
])('refuses %s without ALLOW_PRODUCTION_SEED', (_label, extra) => {
  expect(() => assertSeedAllowed({ CONFIRM_SEED: 'true', ...extra })).toThrow(
    /ALLOW_PRODUCTION_SEED/
  );
});

test.each(['false', '1', 'TRUE', ''])(
  'refuses a production target when ALLOW_PRODUCTION_SEED is %p',
  (value) => {
    expect(() =>
      assertSeedAllowed({
        CONFIRM_SEED: 'true',
        MONGODB_URI: ATLAS_MULTI_HOST,
        ALLOW_PRODUCTION_SEED: value,
      })
    ).toThrow(/ALLOW_PRODUCTION_SEED/);
  }
);

test('allows a production target only with both flags exactly true', () => {
  expect(() =>
    assertSeedAllowed({
      CONFIRM_SEED: 'true',
      MONGODB_URI: ATLAS_MULTI_HOST,
      ALLOW_PRODUCTION_SEED: 'true',
    })
  ).not.toThrow();
});

test('refusal messages never contain the connection string or its credentials', () => {
  let message = '';
  try {
    assertSeedAllowed({ CONFIRM_SEED: 'true', MONGODB_URI: ATLAS_MULTI_HOST });
  } catch (error) {
    message = error instanceof Error ? error.message : '';
  }

  expect(message).not.toBe('');
  expect(message).not.toContain('user:pass');
  expect(message).not.toContain('mongodb.net');
});