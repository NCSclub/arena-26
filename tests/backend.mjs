import test from 'node:test';
import assert from 'node:assert/strict';
import { scryptSync, createHash } from 'node:crypto';
import { validateRegistration, csvCell } from '../lib/validation.js';
import { handleSession } from '../api/admin/session.js';
import { handleAdminRegistrations } from '../api/admin/registrations.js';
import { handleExport } from '../api/admin/export.js';
import { handleRegistration } from '../api/registrations.js';
import { readJson } from '../lib/http.js';

const payload = { submissionId: '00000000-0000-4000-8000-000000000001', fullName: 'Test Player', email: 'PLAYER@example.com', phoneNumber: '0550 00 00 00', discordTag: 'test-player', university: 'Test University', yearOfStudy: 'L2', studentId: 'TEST-123', hasTeam: false, teammates: [], needsTransportation: false, expectations: 'Practice problem solving.' };
const before = Date.parse('2026-11-02T16:00:00Z');
const request = (path, body, extra = {}) => new Request(`https://arena-26.vercel.app${path}`, { method: 'POST', headers: { Origin: 'https://arena-26.vercel.app', 'Content-Type': 'application/json', ...extra.headers }, body: JSON.stringify(body), ...extra });

function setup(context) {
  const data = new Map();
  const salt = 'a'.repeat(32), password = 'test-only-password-not-a-real-credential';
  context.mock.method(Date, 'now', () => before);
  for (const [key, value] of Object.entries({ KV_REST_API_URL: 'https://storage.test', KV_REST_API_TOKEN: 'test-token', SESSION_SECRET: 'test-session-secret'.repeat(4), ADMIN_PASSWORD_HASH: `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}` })) {
    const old = process.env[key];process.env[key] = value;
    context.after(() => { if (old === undefined) delete process.env[key]; else process.env[key] = old; });
  }
  context.mock.method(globalThis, 'fetch', async (_url, options) => {
    const [op, ...args] = JSON.parse(options.body);
    let result;
    if (op === 'SET') { data.set(args[0], args[1]);result = 'OK'; }
    else if (op === 'GET') result = data.get(args[0]) ?? null;
    else if (op === 'DEL') result = Number(data.delete(args[0]));
    else if (op === 'EVAL') result = 1;
    else throw new Error(`Unexpected test command: ${op}`);
    return Response.json({ result });
  });
  return { data, password };
}

test('Registration validates required fields, limits, conditional answers, and the exact Algeria deadline', () => {
  const valid = validateRegistration({ ...payload, teamName: 'Stale', teammates: ['Stale'], transportationAddress: 'Stale' }, before);
  assert.equal(valid.email, 'player@example.com');assert.equal(valid.teamName, '');assert.deepEqual(valid.teammates, []);assert.equal(valid.transportationAddress, '');
  for (const change of [{ email: 'invalid' }, { fullName: '' }, { fullName: [] }, { phoneNumber: 'abc' }, { yearOfStudy: 'L9' }, { hasTeam: 'yes' }, { hasTeam: true, teamName: '' }, { hasTeam: true, teamName: 'Test', teammates: ['1','2','3','4'] }, { needsTransportation: true, transportationAddress: '' }, { expectations: 'x'.repeat(2001) }, { website: 'spam' }, { submissionId: 'bad' }]) assert.throws(() => validateRegistration({ ...payload, ...change }, before));
  assert.doesNotThrow(() => validateRegistration(payload, Date.parse('2026-11-10T15:59:59Z')));
  assert.throws(() => validateRegistration(payload, Date.parse('2026-11-10T16:00:00Z')), error => error.status === 410);
});

test('CSV neutralizes formula cells and quotes untrusted multiline content', () => {
  assert.equal(csvCell('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"');
  assert.equal(csvCell('  +cmd'), '"\'  +cmd"');assert.equal(csvCell('a,"b"\nc'), '"a,""b""\nc"');
});

test('Public requests cannot read registrations, export data, forge an admin session, or submit cross-origin', async context => {
  setup(context);
  const unauth = new Request('https://arena-26.vercel.app/api/admin/registrations');
  assert.equal((await handleAdminRegistrations(unauth)).status, 401);
  assert.equal((await handleExport(unauth)).status, 401);
  const forged = new Request(unauth.url, { headers: { cookie: `arena_admin=${'f'.repeat(64)}` } });
  assert.equal((await handleAdminRegistrations(forged)).status, 401);
  assert.equal((await handleRegistration(request('/api/registrations', payload, { headers: { Origin: 'https://other.example', 'Content-Type': 'application/json' } }))).status, 403);
  assert.equal((await handleSession(request('/api/admin/session', { password: 'whatever' }, { headers: { 'Content-Type': 'application/json' } }))).status, 403);
});

test('Admin login uses an opaque secure cookie and logout invalidates the server-side session', async context => {
  const { data, password } = setup(context);
  assert.equal((await handleSession(request('/api/admin/session', { password: 'wrong' }))).status, 401);
  const login = await handleSession(request('/api/admin/session', { password }));
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/);assert.match(cookie, /Secure/);assert.match(cookie, /SameSite=Strict/);assert.match(cookie, /Path=\/api\/admin/);
  const token = cookie.match(/arena_admin=([a-f0-9]{64})/)[1];
  assert.ok(data.has('arena:session:' + createHash('sha256').update(token).digest('hex')));
  const sessionRequest = new Request('https://arena-26.vercel.app/api/admin/session', { headers: { cookie } });
  assert.equal((await handleSession(sessionRequest)).status, 200);
  const logout = new Request(sessionRequest.url, { method: 'DELETE', headers: { cookie, Origin: 'https://arena-26.vercel.app' } });
  assert.equal((await handleSession(logout)).status, 200);
  assert.equal((await handleSession(sessionRequest)).status, 401);
});

test('Login throttling fails closed before password verification', async context => {
  setup(context);
  context.mock.method(globalThis, 'fetch', async () => Response.json({ result: 9 }));
  assert.equal((await handleSession(request('/api/admin/session', { password: 'wrong' }))).status, 429);
});

test('Request parsing rejects oversized and malformed JSON', async () => {
  await assert.rejects(readJson(request('/api/registrations', { text: 'x'.repeat(17000) })), error => error.status === 413);
  await assert.rejects(readJson(new Request('https://arena-26.vercel.app/api/registrations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })), error => error.status === 400);
});
