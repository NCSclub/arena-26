export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function json(data, status = 200, extra = {}) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', ...extra } });
}

export function checkOrigin(request) {
  const origins = [process.env.SITE_URL || 'https://arena-26.vercel.app'];
  if (process.env.VERCEL_URL) origins.push(`https://${process.env.VERCEL_URL}`);
  if (process.env.ARENA_LOCAL_DEV === 'true' && !process.env.VERCEL) {
    const port = process.env.PORT || '4173';
    for (const host of ['127.0.0.1', 'localhost']) origins.push(new URL(`http://${host}:${port}`).origin);
  }
  if (!origins.includes(request.headers.get('origin'))) throw new HttpError(403, 'Request not allowed.');
}

export async function readJson(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) throw new HttpError(415, 'Send JSON data.');
  if (Number(request.headers.get('content-length')) > 16384) throw new HttpError(413, 'Request is too large.');
  const reader = request.body?.getReader();
  let size = 0, chunks = [];
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) { await reader.cancel(); throw new HttpError(413, 'Request is too large.'); }
      chunks.push(value);
    }
  }
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data;
  } catch { throw new HttpError(400, 'Invalid request data.'); }
}

export function endpoint(handler) {
  return async request => {
    try { return await handler(request); }
    catch (error) {
      if (!(error instanceof HttpError)) console.error('ARENA request failed:', error.name);
      return json({ error: error instanceof HttpError ? error.message : 'Service temporarily unavailable. Please try again.' }, error.status || 503);
    }
  };
}
