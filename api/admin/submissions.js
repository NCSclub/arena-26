import { checkOrigin, endpoint, HttpError, json } from '../../lib/http.js';
import { requireAdmin } from '../../lib/security.js';
import { deleteSubmission, submissionPage, submissionWithFiles } from '../../lib/store.js';

const slug = value => value.normalize('NFKD').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 40);

function attachment(name) {
  const fallback = name.replace(/[^\x20-\x7e]|["\\]/g, '_');
  const encoded = encodeURIComponent(name).replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export const handleAdminSubmissions = endpoint(async request => {
  if (!['GET', 'DELETE'].includes(request.method)) return json({ error: 'Method not allowed.' }, 405, { Allow: 'GET, DELETE' });
  await requireAdmin(request);
  const params = new URL(request.url).searchParams;
  const id = params.get('id');
  if (request.method === 'GET' && id === null) {
    const offset = Number(params.get('offset') || 0);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) throw new HttpError(400, 'Invalid page.');
    return json(await submissionPage(offset));
  }
  if (!/^[a-f0-9-]{36}$/i.test(id || '')) throw new HttpError(400, 'Invalid submission reference.');
  if (request.method === 'DELETE') {
    checkOrigin(request);
    if (!await deleteSubmission(id)) throw new HttpError(404, 'This submission no longer exists.');
    return json({ deleted: true });
  }
  const submission = await submissionWithFiles(id);
  if (!submission) throw new HttpError(404, 'This submission no longer exists.');
  if (!params.has('challenge')) return json(submission);
  // ?challenge=<id> downloads the file a team sent for that challenge in this submission.
  const file = submission.files.find(entry => entry.challenge === params.get('challenge'));
  if (!file) throw new HttpError(404, 'This file no longer exists.');
  const label = submission.record.answers?.find(answer => answer.challenge === file.challenge)?.challengeLabel ?? file.challenge;
  const prefix = [slug(submission.record.teamName) || 'team', submission.record.session, slug(label) || 'challenge'].filter(Boolean).join('_');
  // Always served as a plain-text download so submitted code can never render as a page.
  return new Response(file.content, { headers: {
    'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': attachment(`${prefix}_${file.name}`),
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
  } });
});

export default { fetch: handleAdminSubmissions };
