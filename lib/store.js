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
