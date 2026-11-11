import { randomUUID } from 'node:crypto';
import { checkOrigin, endpoint, json, readJson } from '../lib/http.js';
import { privateHash, rateLimit } from '../lib/security.js';
import { redis, saveSubmission, submissionSettings } from '../lib/store.js';
import { validateSubmission } from '../lib/validation.js';
import { sessionIsOpen, SUBMISSION_SESSIONS } from '../dist/submission-rules.js';

export const handleSubmission = endpoint(async request => {
  if (request.method === 'GET') {
    const settings = await submissionSettings(), now = Date.now();
    const sessions = SUBMISSION_SESSIONS.map(({ value, label }) => {
      const session = settings.sessions.find(entry => entry.value === value) ?? { open: false, endsAt: null, challenges: [] };
      return { value, label, open: sessionIsOpen(session, now), endsAt: session.endsAt, challenges: session.challenges };
    });
    // `now` lets the page run its countdown on server time. A short shared cache absorbs page-load
    // bursts; posting always re-checks the live settings.
    return json({ now: new Date(now).toISOString(), sessions, extensions: settings.extensions, maxFileKB: settings.maxFileKB, maxTotalKB: settings.maxTotalKB }, 200,
      { 'Cache-Control': 'public, max-age=0, s-maxage=10' });
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, { Allow: 'GET, POST' });
  checkOrigin(request);
  // Teams on the venue network share one IP, so this limit is generous.
  await rateLimit(request, 'submission', 120, 600);
  const settings = await submissionSettings();
  // JSON escaping can at most double the size of file text; leave headroom for the team name and text answers.
  const input = await readJson(request, 2 * settings.maxTotalKB * 1024 + 256 * 1024);
  const { teamName, session, sessionLabel, answers } = validateSubmission(input, settings);
  // Text answers and file names go in the listing record; file contents are stored separately.
  const record = {
    id: randomUUID(), createdAt: new Date().toISOString(), teamName, session, sessionLabel,
    answers: answers.map(({ file, ...answer }) => file ? { ...answer, file: { name: file.name, size: file.size } } : answer),
  };
  const files = answers.filter(answer => answer.file).map(({ challenge, file }) => ({ challenge, name: file.name, content: file.content }));
  const [state, id] = await saveSubmission(record, files, privateHash(`submission:${input.submissionId}`));
  const createdAt = state === 1 ? record.createdAt : JSON.parse(await redis(['HGET', 'arena:submissions', id]) ?? 'null')?.createdAt;
  return json({ id, createdAt, message: 'Submission received.' }, state === 1 ? 201 : 200);
});

export default { fetch: handleSubmission };
