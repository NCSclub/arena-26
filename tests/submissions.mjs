import test from 'node:test';
import assert from 'node:assert/strict';
import { scryptSync } from 'node:crypto';
import { validateSubmission, validateSubmissionSettings } from '../lib/validation.js';
import { handleSession } from '../api/admin/session.js';
import { handleSubmission } from '../api/submissions.js';
import { handleAdminSubmissions } from '../api/admin/submissions.js';
import { handleAdminSettings } from '../api/admin/settings.js';
import { DEFAULT_SUBMISSION_SETTINGS as defaults } from '../dist/submission-rules.js';

const origin = 'https://arena-26.vercel.app';
// The pre-loaded sessions with the Morning Session switched on (and optional overrides for it).
const openMorning = (overrides = {}) => ({
  ...defaults, sessions: defaults.sessions.map(session => session.value === 'morning' ? { ...session, open: true, ...overrides } : session),
});
const payload = {
  submissionId: '00000000-0000-4000-8000-000000000002', teamName: 'Byte Busters', session: 'morning',
  answers: [
    { challenge: 'morning-hard-puzzle', parts: [' red ', 'fox'] },
    { challenge: 'morning-easy-coding', file: { name: 'main.py', content: 'print("hi")\n' } },
  ],
};
const settingsInput = ({ revision, sessions, extensions, maxFileKB, maxTotalKB } = defaults) => ({
  revision, extensions, maxFileKB, maxTotalKB,
  sessions: sessions.map(({ value, open, endsAt, challenges }) => ({ value, open, endsAt, challenges })),
});
const withSession = (input, value, changes) => ({ ...input, sessions: input.sessions.map(session => session.value === value ? { ...session, ...changes } : session) });
const post = (path, body, headers = {}, method = 'POST') => new Request(`${origin}${path}`, {
  method, headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
});

// In-memory stand-in for the Upstash REST API, covering the commands used by submissions and settings.
function setup(context) {
  const strings = new Map(), hashes = new Map(), order = new Map();
  const hash = key => hashes.get(key) ?? hashes.set(key, new Map()).get(key);
  const salt = 'b'.repeat(32), password = 'test-only-password-not-a-real-credential';
  for (const [key, value] of Object.entries({ KV_REST_API_URL: 'https://storage.test', KV_REST_API_TOKEN: 'test-token', SESSION_SECRET: 'test-session-secret'.repeat(4), ADMIN_PASSWORD_HASH: `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}` })) {
    const old = process.env[key]; process.env[key] = value;
    context.after(() => { if (old === undefined) delete process.env[key]; else process.env[key] = old; });
  }
  context.mock.method(globalThis, 'fetch', async (_url, options) => {
    const [op, ...args] = JSON.parse(options.body);
    let result;
    if (op === 'SET') { strings.set(args[0], args[1]); result = 'OK'; }
    else if (op === 'GET') result = strings.get(args[0]) ?? null;
    else if (op === 'HGET') result = hash(args[0]).get(args[1]) ?? null;
    else if (op === 'HMGET') result = args.slice(1).map(field => hash(args[0]).get(field) ?? null);
    else if (op === 'HLEN') result = hash(args[0]).size;
    else if (op === 'ZREVRANGE') result = [...order].sort((a, b) => b[1] - a[1]).map(([id]) => id).slice(args[1], args[2] + 1);
    else if (op === 'EVAL' && args[2] === 'arena:submissions' && args[1] === 4) {
      const [requestKey, id, record, files, score] = args.slice(5);
      const replay = strings.get(requestKey);
      if (replay && hash('arena:submissions').has(replay)) result = [2, replay];
      else {
        hash('arena:submissions').set(id, record); hash('arena:submission-files').set(id, files);
        order.set(id, score); strings.set(requestKey, id); result = [1, id];
      }
    }
    else if (op === 'EVAL' && args[2] === 'arena:submissions' && args[1] === 3) {
      const id = args[5];
      result = Number(hash('arena:submissions').delete(id));
      hash('arena:submission-files').delete(id); order.delete(id);
    }
    else if (op === 'EVAL' && args[2] === 'arena:submission-settings') {
      const [key, revision, saved] = args.slice(2);
      const current = strings.get(key) ? JSON.parse(strings.get(key)).revision : 0;
      result = current === revision ? (strings.set(key, saved), 1) : 0;
    }
    else if (op === 'EVAL') result = 1;
    else throw new Error(`Unexpected test command: ${op}`);
    return Response.json({ result });
  });
  const useSettings = settings => strings.set('arena:submission-settings', JSON.stringify(settings));
  return { strings, hash, password, useSettings };
}

async function adminCookie(password) {
  return (await handleSession(post('/api/admin/session', { password }))).headers.get('set-cookie');
}

test('Both sessions ship closed and pre-loaded with the morning and afternoon challenges', () => {
  const summary = defaults.sessions.map(session => [session.value, session.open, session.challenges.map(challenge => `${challenge.label}:${challenge.type === 'text' ? challenge.fields : 'file'}`)]);
  assert.deepEqual(summary, [
    ['morning', false, ['Hard Puzzle:2', 'Medium Puzzle:3', 'Hard Reverse:file', 'Easy Coding:file', 'Hard Coding:file']],
    ['afternoon', false, ['Easy Puzzle:3', 'Medium Puzzle:2', 'Medium Reverse:file', 'Easy Reverse:file', 'Medium Coding:file']],
  ]);
  assert.doesNotThrow(() => validateSubmissionSettings(settingsInput()), 'the pre-loaded settings are valid');
  assert.throws(() => validateSubmission(payload, defaults), error => error.status === 410);
});

test('A submission is a team name plus answers to challenges of one open session', () => {
  const settings = openMorning();
  const valid = validateSubmission(payload, settings);
  assert.equal(valid.session, 'morning');
  assert.equal(valid.sessionLabel, 'Morning Session');
  assert.deepEqual(valid.answers[0], { challenge: 'morning-hard-puzzle', challengeLabel: 'Hard Puzzle', type: 'text', parts: ['red', 'fox'] });
  assert.deepEqual(valid.answers[1].file, { name: 'main.py', size: 12, content: 'print("hi")\n' });
  assert.deepEqual(validateSubmission({ ...payload, answers: [{ challenge: 'morning-medium-puzzle', parts: ['', 'key', ''] }] }, settings).answers[0].parts, ['', 'key', ''], 'some boxes may stay empty');
  const file = (name, content = 'x') => ({ challenge: 'morning-easy-coding', file: { name, content } });
  for (const change of [
    { website: 'spam' }, { submissionId: 'bad' }, { teamName: '' }, { teamName: 'Line\nbreak' }, { session: 'evening' }, { session: undefined },
    { answers: [] }, { answers: Array.from({ length: 6 }, () => payload.answers[0]) }, { answers: [null] },
    { answers: [{ challenge: 'afternoon-easy-puzzle', parts: ['a', 'b', 'c'] }] }, { answers: [payload.answers[0], payload.answers[0]] },
    { answers: [{ challenge: 'morning-hard-puzzle', parts: ['only one'] }] }, { answers: [{ challenge: 'morning-hard-puzzle', parts: ['a', 'b', 'c'] }] },
    { answers: [{ challenge: 'morning-hard-puzzle', parts: ['', ' '] }] }, { answers: [{ challenge: 'morning-hard-puzzle', parts: ['x'.repeat(501), ''] }] },
    { answers: [{ challenge: 'morning-hard-puzzle', parts: ['two\nlines', ''] }] }, { answers: [{ challenge: 'morning-hard-puzzle', parts: [1, 2] }] },
    { answers: [{ challenge: 'morning-hard-puzzle', text: 'red fox' }] }, { answers: [{ challenge: 'morning-easy-coding', parts: ['print(1)'] }] },
    { answers: [file('virus.exe')] }, { answers: [file('../main.py')] }, { answers: [file('main.c', 'a\u0000b')] }, { answers: [file('main.c', '')] },
    { answers: [file('big.py', 'x'.repeat(200 * 1024 + 1))] },
  ]) assert.throws(() => validateSubmission({ ...payload, ...change }, settings), JSON.stringify(change).slice(0, 80));
  assert.throws(() => validateSubmission({ ...payload, session: 'afternoon', answers: [{ challenge: 'afternoon-easy-puzzle', parts: ['a', 'b', 'c'] }] }, settings), error => error.status === 410);
  const big = value => ({ challenge: value, file: { name: `${value}.py`, content: 'x'.repeat(190 * 1024) } });
  assert.throws(() => validateSubmission({ ...payload, answers: [big('morning-easy-coding'), big('morning-hard-coding')] }, { ...settings, maxTotalKB: 300 }), /in total/);
  const closing = Date.parse('2026-11-12T12:00:00Z');
  const timed = openMorning({ endsAt: new Date(closing).toISOString() });
  assert.doesNotThrow(() => validateSubmission(payload, timed, closing - 1000));
  assert.throws(() => validateSubmission(payload, timed, closing), error => error.status === 410, 'the session closes by itself at its end time');
});

test('Settings validation checks each session, challenge types, box counts, and closing times', () => {
  const input = withSession(settingsInput(), 'morning', {
    open: true, endsAt: '2026-11-12T13:00:00+01:00',
    challenges: [{ value: 'morning-hard-puzzle', label: ' Riddle ', type: 'text', fields: 4 }, { value: '', label: 'Bonus', type: 'file', fields: 3 }],
  });
  const saved = validateSubmissionSettings(input);
  const morning = saved.sessions[0];
  assert.equal(morning.endsAt, '2026-11-12T12:00:00.000Z');
  assert.deepEqual(morning.challenges[0], { value: 'morning-hard-puzzle', label: 'Riddle', type: 'text', fields: 4 });
  assert.match(morning.challenges[1].value, /^challenge-[a-f0-9]{8}$/);
  assert.ok(!('fields' in morning.challenges[1]), 'file challenges have no boxes');
  assert.equal(validateSubmissionSettings(withSession(input, 'morning', { endsAt: '' })).sessions[0].endsAt, null);
  assert.deepEqual(saved.sessions.map(session => session.value), ['morning', 'afternoon']);
  const morningChange = changes => withSession(input, 'morning', changes);
  const challenge = changes => morningChange({ challenges: [{ label: 'A', type: 'text', fields: 2, ...changes }] });
  for (const [label, broken] of Object.entries({
    missingSession: { ...input, sessions: input.sessions.slice(0, 1) }, notArray: { ...input, sessions: 'x' },
    openNotBoolean: morningChange({ open: 'yes' }), openEmpty: morningChange({ open: true, challenges: [] }), badEnd: morningChange({ endsAt: 'tomorrow' }),
    noType: challenge({ type: undefined }), badType: challenge({ type: 'video' }), protoType: challenge({ type: 'toString' }),
    zeroBoxes: challenge({ fields: 0 }), tooManyBoxes: challenge({ fields: 11 }), fractionBoxes: challenge({ fields: 1.5 }), missingBoxes: challenge({ fields: undefined }),
    longName: challenge({ label: 'x'.repeat(61) }), badId: challenge({ value: 'Bad ID' }),
    duplicateName: morningChange({ challenges: [{ label: 'A', type: 'file' }, { label: 'a', type: 'file' }] }),
    duplicateIdAcrossSessions: withSession(morningChange({ challenges: [{ value: 'shared', label: 'A', type: 'file' }] }), 'afternoon', { challenges: [{ value: 'shared', label: 'B', type: 'file' }] }),
    binaryType: { ...input, extensions: ['zip'] }, noTypes: { ...input, extensions: [] },
    zeroSize: { ...input, maxFileKB: 0 }, totalBelowFile: { ...input, maxFileKB: 300, maxTotalKB: 200 },
  })) assert.throws(() => validateSubmissionSettings(broken), undefined, label);
});

test('Admins open sessions with closing times, guarded against stale saves, and the public page follows', async context => {
  const { password } = setup(context);
  const settingsRequest = (method, body, headers = {}) => handleAdminSettings(body ? post('/api/admin/settings', body, headers, method) : new Request(`${origin}/api/admin/settings`, { method, headers }));
  assert.equal((await settingsRequest('GET')).status, 401);
  const cookie = await adminCookie(password);
  const current = await (await settingsRequest('GET', undefined, { cookie })).json();
  assert.equal(current.revision, 0);
  assert.deepEqual(current.sessions.map(session => [session.value, session.open, session.challenges.length]), [['morning', false, 5], ['afternoon', false, 5]]);
  const closedPage = await (await handleSubmission(new Request(`${origin}/api/submissions`))).json();
  assert.ok(Date.parse(closedPage.now));
  assert.deepEqual(closedPage.sessions.map(session => [session.label, session.open]), [['Morning Session', false], ['Afternoon Session', false]]);
  const endsAt = new Date(Date.now() + 3600e3).toISOString();
  const changed = withSession(settingsInput(current), 'morning', { open: true, endsAt });
  assert.equal((await settingsRequest('PUT', changed, { cookie, Origin: 'https://other.example' })).status, 403);
  assert.equal((await settingsRequest('PUT', { ...changed, revision: 5 }, { cookie })).status, 409);
  assert.equal((await settingsRequest('PUT', withSession(changed, 'afternoon', { open: true, challenges: [] }), { cookie })).status, 400);
  const saved = await settingsRequest('PUT', changed, { cookie });
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).revision, 1);
  assert.equal((await settingsRequest('PUT', changed, { cookie })).status, 409, 'a save based on revision 0 is now stale');
  const publicSettings = await handleSubmission(new Request(`${origin}/api/submissions`));
  assert.match(publicSettings.headers.get('cache-control'), /s-maxage=10/);
  const body = await publicSettings.json();
  assert.deepEqual(body.sessions.map(session => [session.value, session.open, session.endsAt]), [['morning', true, endsAt], ['afternoon', false, null]]);
  assert.equal(body.sessions[0].challenges[1].fields, 3);
  assert.deepEqual(Object.keys(body).sort(), ['extensions', 'maxFileKB', 'maxTotalKB', 'now', 'sessions']);
});

test('Submissions follow the live session state, including closing times and older saved settings', async context => {
  const { hash, useSettings, strings } = setup(context);
  assert.equal((await handleSubmission(post('/api/submissions', payload))).status, 410, 'sessions start closed');
  useSettings(openMorning());
  const afternoon = { ...payload, session: 'afternoon', answers: [{ challenge: 'afternoon-easy-puzzle', parts: ['a', 'b', 'c'] }] };
  assert.equal((await handleSubmission(post('/api/submissions', afternoon))).status, 410);
  const created = await handleSubmission(post('/api/submissions', payload));
  assert.equal(created.status, 201);
  assert.equal(JSON.parse(hash('arena:submissions').get((await created.json()).id)).sessionLabel, 'Morning Session');
  useSettings(openMorning({ endsAt: new Date(Date.now() - 1000).toISOString() }));
  assert.equal((await handleSubmission(post('/api/submissions', { ...payload, submissionId: '00000000-0000-4000-8000-000000000004' }))).status, 410, 'past closing time');
  const pastPage = await (await handleSubmission(new Request(`${origin}/api/submissions`))).json();
  assert.equal(pastPage.sessions[0].open, false);
  // Settings saved before sessions existed fall back to the pre-loaded, closed sessions.
  strings.set('arena:submission-settings', JSON.stringify({ ...defaults, sessions: undefined, open: true, challenges: [{ value: 'legacy', label: 'Legacy' }] }));
  const legacy = await (await handleSubmission(new Request(`${origin}/api/submissions`))).json();
  assert.deepEqual(legacy.sessions.map(session => session.open), [false, false]);
  useSettings(openMorning({ challenges: [{ value: 'old-text', label: 'Old text', type: 'text' }] }));
  const old = await (await handleSubmission(new Request(`${origin}/api/submissions`))).json();
  assert.equal(old.sessions[0].challenges[0].fields, 1, 'text challenges saved without a box count get one box');
});

test('Anyone can submit without an email, cross-site posts are refused, and retries do not create duplicates', async context => {
  const { hash, useSettings } = setup(context);
  useSettings(openMorning());
  assert.equal((await handleSubmission(post('/api/submissions', payload, { Origin: 'https://other.example' }))).status, 403);
  const created = await handleSubmission(post('/api/submissions', payload));
  assert.equal(created.status, 201);
  const { id, createdAt } = await created.json();
  const record = JSON.parse(hash('arena:submissions').get(id));
  assert.deepEqual(Object.keys(record).sort(), ['answers', 'createdAt', 'id', 'session', 'sessionLabel', 'teamName']);
  assert.deepEqual(record.answers, [
    { challenge: 'morning-hard-puzzle', challengeLabel: 'Hard Puzzle', type: 'text', parts: ['red', 'fox'] },
    { challenge: 'morning-easy-coding', challengeLabel: 'Easy Coding', type: 'file', file: { name: 'main.py', size: 12 } },
  ]);
  assert.deepEqual(JSON.parse(hash('arena:submission-files').get(id)), [{ challenge: 'morning-easy-coding', name: 'main.py', content: 'print("hi")\n' }]);
  const retried = await handleSubmission(post('/api/submissions', payload));
  assert.equal(retried.status, 200);
  assert.deepEqual(await retried.json(), { id, createdAt, message: 'Submission received.' });
  assert.equal(hash('arena:submissions').size, 1);
  const later = await handleSubmission(post('/api/submissions', { ...payload, submissionId: '00000000-0000-4000-8000-000000000003', answers: [{ challenge: 'morning-hard-reverse', file: { name: 'rev.txt', content: 'done' } }] }));
  assert.equal(later.status, 201);
  assert.equal(hash('arena:submissions').size, 2);
});

test('Submission requests above the size limit are refused before parsing', async context => {
  const { useSettings } = setup(context);
  useSettings(openMorning());
  const huge = { ...payload, answers: [{ challenge: 'morning-easy-coding', file: { name: 'big.txt', content: '\\'.repeat(700 * 1024) } }] };
  assert.equal((await handleSubmission(post('/api/submissions', huge))).status, 413);
});

test('Admins can list, read, download, and delete submissions; the public cannot', async context => {
  const { password, useSettings } = setup(context);
  useSettings(openMorning());
  const { id } = await (await handleSubmission(post('/api/submissions', payload))).json();
  const admin = (query, { method = 'GET', cookie, headers = {} } = {}) =>
    handleAdminSubmissions(new Request(`${origin}/api/admin/submissions${query}`, { method, headers: { ...(cookie && { cookie }), ...headers } }));
  assert.equal((await admin('')).status, 401);
  assert.equal((await admin(`?id=${id}&challenge=morning-easy-coding`)).status, 401);
  const cookie = await adminCookie(password);
  const list = await (await admin('', { cookie })).json();
  assert.equal(list.total, 1);
  assert.equal(list.records[0].session, 'morning');
  assert.deepEqual(list.records[0].answers[0].parts, ['red', 'fox']);
  assert.ok(!('content' in list.records[0].answers[1].file));
  const detail = await (await admin(`?id=${id}`, { cookie })).json();
  assert.equal(detail.files[0].content, 'print("hi")\n');
  const download = await admin(`?id=${id}&challenge=morning-easy-coding`, { cookie });
  assert.equal(download.status, 200);
  assert.equal(download.headers.get('content-type'), 'text/plain; charset=utf-8');
  assert.match(download.headers.get('content-disposition'), /^attachment; filename="byte-busters_morning_easy-coding_main\.py"/);
  assert.equal(await download.text(), 'print("hi")\n');
  for (const challenge of ['morning-hard-puzzle', 'morning-hard-coding', 'nope', '']) assert.equal((await admin(`?id=${id}&challenge=${challenge}`, { cookie })).status, 404);
  assert.equal((await admin('?id=bad', { cookie })).status, 400);
  assert.equal((await admin(`?id=${id}`, { method: 'DELETE', cookie, headers: { Origin: 'https://other.example' } })).status, 403);
  assert.equal((await admin(`?id=${id}`, { method: 'DELETE', cookie, headers: { Origin: origin } })).status, 200);
  assert.equal((await admin(`?id=${id}`, { cookie })).status, 404);
  assert.equal((await admin(`?id=${id}`, { method: 'DELETE', cookie, headers: { Origin: origin } })).status, 404);
  assert.equal((await (await admin('', { cookie })).json()).total, 0);
});
