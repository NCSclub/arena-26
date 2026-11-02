import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { redis } from './store.js';
import { HttpError } from './http.js';

const scrypt = promisify(scryptCallback);
const COOKIE = 'arena_admin';
export const SESSION_SECONDS = 8 * 60 * 60;
const sha = value => createHash('sha256').update(value).digest('hex');

export function privateHash(value) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SessionNotConfigured');
  return createHmac('sha256', secret).update(value).digest('hex');
}

export async function verifyPassword(password, encoded = process.env.ADMIN_PASSWORD_HASH) {
  if (!encoded) throw new Error('AdminNotConfigured');
  const [scheme, salt, digest] = encoded.split(':');
  if (scheme !== 'scrypt' || !/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{128}$/.test(digest || '')) throw new Error('InvalidPasswordConfiguration');
  const actual = await scrypt(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(digest, 'hex'));
}

function sessionToken(request) {
  const token = (request.headers.get('cookie') || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  return /^[a-f0-9]{64}$/.test(token || '') ? token : null;
}

export function sessionCookie(token, seconds = SESSION_SECONDS) {
  const secure = process.env.ARENA_LOCAL_DEV === 'true' && !process.env.VERCEL ? '' : '; Secure';
  return `${COOKIE}=${token}; HttpOnly${secure}; SameSite=Strict; Path=/api/admin; Max-Age=${seconds}`;
}

export async function createSession() {
  const token = randomBytes(32).toString('hex');
  await redis(['SET', `arena:session:${sha(token)}`, privateHash(process.env.ADMIN_PASSWORD_HASH), 'EX', SESSION_SECONDS]);
  return token;
}

export async function requireAdmin(request) {
  const token = sessionToken(request);
  if (!token) throw new HttpError(401, 'Sign in to continue.');
  const value = await redis(['GET', `arena:session:${sha(token)}`]);
  if (value !== privateHash(process.env.ADMIN_PASSWORD_HASH)) throw new HttpError(401, 'Your session expired. Sign in again.');
}

export async function destroySession(request) {
  const token = sessionToken(request);
  if (token) await redis(['DEL', `arena:session:${sha(token)}`]);
}

const RATE_LIMIT = `local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; return n`;
export async function rateLimit(request, action, maximum, seconds) {
  const ip = request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const key = `arena:limit:${action}:${privateHash(ip)}`;
  const count = await redis(['EVAL', RATE_LIMIT, 1, key, seconds]);
  if (count > maximum) throw new HttpError(429, 'Too many attempts. Please try again later.');
}
