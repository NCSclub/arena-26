import { randomBytes } from 'node:crypto';
import { HttpError } from './http.js';
import { REGISTRATION_CLOSES_AT } from '../dist/event-config.js';
import {
  BINARY_EXTENSIONS, CHALLENGE_TYPES, fileExtension, sessionIsOpen, SETTINGS_LIMITS, SUBMISSION_SESSIONS,
} from '../dist/submission-rules.js';

export function validateRegistration(input, now = Date.now()) {
  if (now >= Date.parse(REGISTRATION_CLOSES_AT)) throw new HttpError(410, 'Registration is closed.');
  if (input.website) throw new HttpError(400, 'Unable to submit this registration.');
  const values = validateMemberDetails(input);
  if (!/^[a-f0-9-]{36}$/i.test(input.submissionId || '')) throw new HttpError(400, 'Refresh the form and try again.');
  return values;
}

export function validateMemberDetails(input, { allowIncomplete = false } = {}) {
  const text = (key, max, required = true) => {
    if (typeof input[key] !== 'string') { if (!required && input[key] == null) return ''; throw new HttpError(400, `Check ${key}.`); }
    const value = input[key].trim();
    if ((required && !value) || value.length > max || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(value)) throw new HttpError(400, `Check ${key}.`);
    return value;
  };
  const fullName = text('fullName', 120), phoneNumber = text('phoneNumber', 24, !allowIncomplete), email = text('email', 160).toLowerCase();
  if (phoneNumber && !/^[+0-9 ()-]{8,24}$/.test(phoneNumber)) throw new HttpError(400, 'Check your phone number.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Check your email address.');
  const yearOfStudy = text('yearOfStudy', 2, !allowIncomplete);
  if (yearOfStudy && !['L1', 'L2', 'L3', 'M1'].includes(yearOfStudy)) throw new HttpError(400, 'Select your year of study.');
  if (typeof input.hasTeam !== 'boolean' || typeof input.needsTransportation !== 'boolean') throw new HttpError(400, 'Check team and transport choices.');
  let teammates = [];
  if (input.hasTeam) {
    if (!Array.isArray(input.teammates) || input.teammates.length > 3) throw new HttpError(400, 'Include up to three teammates.');
    teammates = input.teammates.map(name => {
      if (typeof name !== 'string' || name.trim().length > 120 || /[\u0000-\u001f\u007f]/.test(name)) throw new HttpError(400, 'Check teammate names.');
      return name.trim();
    }).filter(Boolean);
  }
  return { fullName, phoneNumber, email, discordTag: text('discordTag', 80, !allowIncomplete), university: text('university', 160, !allowIncomplete), yearOfStudy, studentId: text('studentId', 80, !allowIncomplete), hasTeam: input.hasTeam, teamName: input.hasTeam ? text('teamName', 100) : '', teammates, needsTransportation: input.needsTransportation, transportationAddress: input.needsTransportation ? text('transportationAddress', 240) : '', expectations: text('expectations', 2000, !allowIncomplete) };
}

const UNSAFE_FILE_NAME = /[\u0000-\u001f\u007f/\\:*?"<>|]/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const sessionLabel = value => SUBMISSION_SESSIONS.find(session => session.value === value)?.label ?? value;

// A submission is a team name plus answers to challenges of one open session: numbered text boxes for
// text challenges, one file for file challenges. Teams may answer only some challenges and send the rest later.
export function validateSubmission(input, settings, now = Date.now()) {
  if (input.website) throw new HttpError(400, 'Unable to send this submission.');
  if (!/^[a-f0-9-]{36}$/i.test(input.submissionId || '')) throw new HttpError(400, 'Refresh the page and try again.');
  const session = settings.sessions.find(option => option.value === input.session);
  if (!session) throw new HttpError(400, 'Choose a session. Refresh the page and try again.');
  if (!sessionIsOpen(session, now)) throw new HttpError(410, `The ${sessionLabel(session.value)} is closed. Contact the NCS organizing team.`);
  const teamName = typeof input.teamName === 'string' ? input.teamName.trim() : '';
  if (!teamName || teamName.length > 100 || CONTROL_CHARACTERS.test(teamName)) throw new HttpError(400, 'Check your team name.');
  if (!Array.isArray(input.answers) || input.answers.length > session.challenges.length) throw new HttpError(400, 'Refresh the page and try again.');
  if (!input.answers.length) throw new HttpError(400, 'Answer at least one challenge before submitting.');
  const answered = new Set();
  let total = 0;
  const answers = input.answers.map(answer => {
    const challenge = session.challenges.find(option => option.value === answer?.challenge);
    if (!challenge) throw new HttpError(400, 'The challenges have changed. Refresh the page and try again.');
    if (answered.has(challenge.value)) throw new HttpError(400, `${challenge.label} is answered twice.`);
    answered.add(challenge.value);
    const base = { challenge: challenge.value, challengeLabel: challenge.label, type: challenge.type };
    if (challenge.type === 'text') {
      // One entry per numbered box; empty boxes are allowed as long as one box is filled.
      if (!Array.isArray(answer.parts) || answer.parts.length !== challenge.fields) throw new HttpError(400, 'The challenges have changed. Refresh the page and try again.');
      const parts = answer.parts.map((part, index) => {
        const value = typeof part === 'string' ? part.trim() : null;
        if (value === null || value.length > SETTINGS_LIMITS.textAnswer || CONTROL_CHARACTERS.test(value)) {
          throw new HttpError(400, `Check part ${index + 1} of ${challenge.label} (up to ${SETTINGS_LIMITS.textAnswer} characters).`);
        }
        return value;
      });
      if (!parts.some(Boolean)) throw new HttpError(400, `Fill in at least one box for ${challenge.label}.`);
      return { ...base, parts };
    }
    const file = validateFile(answer.file, challenge, settings);
    total += file.size;
    if (total > settings.maxTotalKB * 1024) throw new HttpError(413, `Your files are larger than ${settings.maxTotalKB} KB in total.`);
    return { ...base, file };
  });
  return { teamName, session: session.value, sessionLabel: sessionLabel(session.value), answers };
}

function validateFile(file, challenge, { extensions, maxFileKB }) {
  const name = typeof file?.name === 'string' ? file.name.trim() : '';
  if (!name) throw new HttpError(400, `Attach a file for ${challenge.label}.`);
  if (name.length > 120 || UNSAFE_FILE_NAME.test(name)) throw new HttpError(400, `Rename the file for ${challenge.label} without special characters.`);
  if (!extensions.includes(fileExtension(name))) throw new HttpError(400, `${name} is not a supported file type.`);
  if (typeof file.content !== 'string' || file.content.includes('\u0000')) throw new HttpError(400, `${name} must be a text file.`);
  const size = Buffer.byteLength(file.content, 'utf8');
  if (!size) throw new HttpError(400, `${name} is empty.`);
  if (size > maxFileKB * 1024) throw new HttpError(413, `${name} is larger than ${maxFileKB} KB.`);
  return { name, size, content: file.content };
}

function validateSessionSettings(definition, input, usedIds) {
  const { value, label: sessionName } = definition;
  if (!input || typeof input.open !== 'boolean') throw new HttpError(400, `Choose whether the ${sessionName} is open.`);
  let endsAt = null;
  if (input.endsAt != null && input.endsAt !== '') {
    const time = typeof input.endsAt === 'string' ? Date.parse(input.endsAt) : NaN;
    if (!Number.isFinite(time)) throw new HttpError(400, `Check the closing time of the ${sessionName}.`);
    endsAt = new Date(time).toISOString();
  }
  if (!Array.isArray(input.challenges)) throw new HttpError(400, 'Reload the settings and try again.');
  if (input.challenges.length > SETTINGS_LIMITS.challenges) throw new HttpError(400, `Keep ${SETTINGS_LIMITS.challenges} challenges or fewer in the ${sessionName}.`);
  const labels = new Set();
  const challenges = input.challenges.map(challenge => {
    const label = typeof challenge?.label === 'string' ? challenge.label.trim() : '';
    if (!label || label.length > SETTINGS_LIMITS.challengeLabel || CONTROL_CHARACTERS.test(label)) {
      throw new HttpError(400, `Give each challenge a name (1–${SETTINGS_LIMITS.challengeLabel} characters).`);
    }
    if (labels.has(label.toLowerCase())) throw new HttpError(400, `Two challenges in the ${sessionName} are named “${label}”. Give each one a different name.`);
    labels.add(label.toLowerCase());
    if (!Object.hasOwn(CHALLENGE_TYPES, challenge.type)) throw new HttpError(400, `Choose whether “${label}” uses text boxes or a file.`);
    // Existing challenges keep their ID so earlier answers stay linked after a rename.
    const id = challenge.value || `challenge-${randomBytes(4).toString('hex')}`;
    if (typeof id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(id) || usedIds.has(id)) throw new HttpError(400, 'Reload the settings and try again.');
    usedIds.add(id);
    if (challenge.type === 'file') return { value: id, label, type: 'file' };
    if (!Number.isInteger(challenge.fields) || challenge.fields < 1 || challenge.fields > SETTINGS_LIMITS.fields) {
      throw new HttpError(400, `“${label}” needs between 1 and ${SETTINGS_LIMITS.fields} text boxes.`);
    }
    return { value: id, label, type: 'text', fields: challenge.fields };
  });
  if (input.open && !challenges.length) throw new HttpError(400, `Add at least one challenge before opening the ${sessionName}.`);
  return { value, open: input.open, endsAt, challenges };
}

export function validateSubmissionSettings(input) {
  if (!Array.isArray(input.sessions)) throw new HttpError(400, 'Reload the settings and try again.');
  const usedIds = new Set();
  const sessions = SUBMISSION_SESSIONS.map(definition =>
    validateSessionSettings(definition, input.sessions.find(session => session?.value === definition.value), usedIds));
  if (!Array.isArray(input.extensions) || !input.extensions.length) throw new HttpError(400, 'Add at least one accepted file type.');
  if (input.extensions.length > SETTINGS_LIMITS.extensions) throw new HttpError(400, `Keep ${SETTINGS_LIMITS.extensions} file types or fewer.`);
  const extensions = [...new Set(input.extensions.map(value => {
    const extension = typeof value === 'string' ? value.trim().replace(/^\./, '').toLowerCase() : '';
    if (!/^[a-z0-9]{1,10}$/.test(extension)) throw new HttpError(400, `“${String(value).slice(0, 20)}” is not a valid file extension.`);
    if (BINARY_EXTENSIONS.includes(extension)) throw new HttpError(400, `.${extension} files are not text, so they can’t be accepted.`);
    return extension;
  }))];
  const limit = (key, label) => {
    const value = input[key];
    if (!Number.isInteger(value) || value < 1 || value > SETTINGS_LIMITS[key]) throw new HttpError(400, `${label} must be between 1 and ${SETTINGS_LIMITS[key]}.`);
    return value;
  };
  const maxFileKB = limit('maxFileKB', 'Size per file'), maxTotalKB = limit('maxTotalKB', 'Total size');
  if (maxTotalKB < maxFileKB) throw new HttpError(400, 'The total size must be at least the size allowed per file.');
  return { sessions, extensions, maxFileKB, maxTotalKB };
}

export function csvCell(value) {
  let text = Array.isArray(value) ? value.join('; ') : String(value ?? '');
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
