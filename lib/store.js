import { DEFAULT_SUBMISSION_SETTINGS } from '../dist/submission-rules.js';

export async function redis(command) {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('StorageNotConfigured');
  const response = await fetch(url, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command), signal: AbortSignal.timeout(10000), cache: 'no-store',
  });
  if (!response.ok) throw new Error('StorageUnavailable');
  const data = await response.json();
  if (data.error) throw new Error('StorageCommandFailed');
  return data.result;
}

export const SAVE_REGISTRATION = `
local replay = redis.call('GET', KEYS[4])
if replay and redis.call('GET', KEYS[3]) == replay and redis.call('HEXISTS', KEYS[1], replay) == 1 then return {2, replay} end
if redis.call('EXISTS', KEYS[3]) == 1 then return {0, ''} end
redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
redis.call('ZADD', KEYS[2], ARGV[3], ARGV[1])
redis.call('SET', KEYS[3], ARGV[1])
redis.call('SET', KEYS[4], ARGV[1], 'EX', 86400)
redis.call('HINCRBY', KEYS[5], 'teams', ARGV[4])
redis.call('HINCRBY', KEYS[5], 'transport', ARGV[5])
return {1, ARGV[1]}
`;

export async function saveRegistration(record, emailHash, requestHash) {
  return redis(['EVAL', SAVE_REGISTRATION, 5, 'arena:registrations', 'arena:registration-order', `arena:email:${emailHash}`, `arena:request:${requestHash}`, 'arena:registration-stats', record.id, JSON.stringify(record), Date.parse(record.createdAt), Number(record.hasTeam), Number(record.needsTransportation)]);
}

export async function registrationPage(offset = 0, limit = 50) {
  const [total, teams, transport, ids] = await Promise.all([
    redis(['HLEN', 'arena:registrations']), redis(['HGET', 'arena:registration-stats', 'teams']),
    redis(['HGET', 'arena:registration-stats', 'transport']), redis(['ZREVRANGE', 'arena:registration-order', offset, offset + limit - 1]),
  ]);
  const records = ids.length ? (await redis(['HMGET', 'arena:registrations', ...ids])).filter(Boolean).map(JSON.parse) : [];
  return { records, total, teams: Number(teams || 0), transport: Number(transport || 0), offset, limit };
}

const CHANGE_REGISTRATION = `
local current = redis.call('HGET', KEYS[1], ARGV[1])
if not current then return 0 end
if current ~= ARGV[2] then return 2 end
local old = cjson.decode(current)
local teams = old.hasTeam and -1 or 0
local transport = old.needsTransportation and -1 or 0
if ARGV[3] == '' then
  redis.call('HDEL', KEYS[1], ARGV[1])
  redis.call('ZREM', KEYS[2], ARGV[1])
else
  local owner = redis.call('GET', KEYS[5])
  if owner and owner ~= ARGV[1] then return 3 end
  local updated = cjson.decode(ARGV[3])
  teams = teams + (updated.hasTeam and 1 or 0)
  transport = transport + (updated.needsTransportation and 1 or 0)
  redis.call('HSET', KEYS[1], ARGV[1], ARGV[3])
  redis.call('SET', KEYS[5], ARGV[1])
end
if (ARGV[3] == '' or KEYS[4] ~= KEYS[5]) and redis.call('GET', KEYS[4]) == ARGV[1] then
  redis.call('DEL', KEYS[4])
end
redis.call('HINCRBY', KEYS[3], 'teams', teams)
redis.call('HINCRBY', KEYS[3], 'transport', transport)
return 1
`;

export function changeRegistration(id, current, updated, oldEmailHash, newEmailHash) {
  return redis(['EVAL', CHANGE_REGISTRATION, 5, 'arena:registrations', 'arena:registration-order',
    'arena:registration-stats', `arena:email:${oldEmailHash}`, `arena:email:${newEmailHash}`,
    id, current, updated ? JSON.stringify(updated) : '']);
}

// Submission details and file contents live in separate hashes so the admin list never loads source code.
const SUBMISSION_KEYS = ['arena:submissions', 'arena:submission-files', 'arena:submission-order'];

const SAVE_SUBMISSION = `
local replay = redis.call('GET', KEYS[4])
if replay and redis.call('HEXISTS', KEYS[1], replay) == 1 then return {2, replay} end
redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
redis.call('HSET', KEYS[2], ARGV[1], ARGV[3])
redis.call('ZADD', KEYS[3], ARGV[4], ARGV[1])
redis.call('SET', KEYS[4], ARGV[1], 'EX', 86400)
return {1, ARGV[1]}
`;

export function saveSubmission(record, files, requestHash) {
  return redis(['EVAL', SAVE_SUBMISSION, 4, ...SUBMISSION_KEYS, `arena:submission-request:${requestHash}`,
    record.id, JSON.stringify(record), JSON.stringify(files), Date.parse(record.createdAt)]);
}

export async function submissionPage(offset = 0, limit = 50) {
  const [total, ids] = await Promise.all([
    redis(['HLEN', 'arena:submissions']), redis(['ZREVRANGE', 'arena:submission-order', offset, offset + limit - 1]),
  ]);
  const records = ids.length ? (await redis(['HMGET', 'arena:submissions', ...ids])).filter(Boolean).map(JSON.parse) : [];
  return { records, total, offset, limit };
}

export async function submissionWithFiles(id) {
  const [record, files] = await Promise.all([redis(['HGET', 'arena:submissions', id]), redis(['HGET', 'arena:submission-files', id])]);
  return record ? { record: JSON.parse(record), files: JSON.parse(files || '[]') } : null;
}

const DELETE_SUBMISSION = `
local removed = redis.call('HDEL', KEYS[1], ARGV[1])
redis.call('HDEL', KEYS[2], ARGV[1])
redis.call('ZREM', KEYS[3], ARGV[1])
return removed
`;

export function deleteSubmission(id) {
  return redis(['EVAL', DELETE_SUBMISSION, 3, ...SUBMISSION_KEYS, id]);
}

const SETTINGS_KEY = 'arena:submission-settings';

export async function submissionSettings() {
  const stored = await redis(['GET', SETTINGS_KEY]);
  let settings;
  try { settings = { ...DEFAULT_SUBMISSION_SETTINGS, ...(stored ? JSON.parse(stored) : {}) }; }
  catch { settings = { ...DEFAULT_SUBMISSION_SETTINGS }; }
  // Settings saved before sessions existed fall back to the default sessions.
  if (!Array.isArray(settings.sessions)) settings.sessions = DEFAULT_SUBMISSION_SETTINGS.sessions;
  settings.sessions = settings.sessions.map(session => ({
    ...session,
    challenges: (session.challenges ?? []).map(challenge => challenge.type === 'text'
      ? { ...challenge, fields: Number.isInteger(challenge.fields) ? challenge.fields : 1 }
      : { ...challenge, type: 'file' }),
  }));
  return settings;
}

// Saves only if nobody else saved since `revision` was read, so two organizers cannot overwrite each other.
const SAVE_SETTINGS = `
local current = redis.call('GET', KEYS[1])
local revision = 0
if current then revision = cjson.decode(current).revision or 0 end
if tonumber(ARGV[1]) ~= revision then return 0 end
redis.call('SET', KEYS[1], ARGV[2])
return 1
`;

export async function saveSubmissionSettings(values, revision) {
  const saved = { ...values, revision: revision + 1, updatedAt: new Date().toISOString() };
  return await redis(['EVAL', SAVE_SETTINGS, 1, SETTINGS_KEY, revision, JSON.stringify(saved)]) ? saved : null;
}
