import { HttpError } from './http.js';
import { REGISTRATION_CLOSES_AT } from '../dist/event-config.js';

export function validateRegistration(input, now = Date.now()) {
  if (now >= Date.parse(REGISTRATION_CLOSES_AT)) throw new HttpError(410, 'Registration is closed.');
  if (input.website) throw new HttpError(400, 'Unable to submit this registration.');
  const values = validateMemberDetails(input);
  if (!/^[a-f0-9-]{36}$/i.test(input.submissionId || '')) throw new HttpError(400, 'Refresh the form and try again.');
  return values;
}

export function validateMemberDetails(input) {
  const text = (key, max, required = true) => {
    if (typeof input[key] !== 'string') { if (!required && input[key] == null) return ''; throw new HttpError(400, `Check ${key}.`); }
    const value = input[key].trim();
    if ((required && !value) || value.length > max || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(value)) throw new HttpError(400, `Check ${key}.`);
    return value;
  };
  const fullName = text('fullName', 120), phoneNumber = text('phoneNumber', 24), email = text('email', 160).toLowerCase();
  if (!/^[+0-9 ()-]{8,24}$/.test(phoneNumber)) throw new HttpError(400, 'Check your phone number.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Check your email address.');
  if (!['L1', 'L2', 'L3', 'M1'].includes(input.yearOfStudy)) throw new HttpError(400, 'Select your year of study.');
  if (typeof input.hasTeam !== 'boolean' || typeof input.needsTransportation !== 'boolean') throw new HttpError(400, 'Check team and transport choices.');
  let teammates = [];
  if (input.hasTeam) {
    if (!Array.isArray(input.teammates) || input.teammates.length > 3) throw new HttpError(400, 'Include up to three teammates.');
    teammates = input.teammates.map(name => {
      if (typeof name !== 'string' || name.trim().length > 120 || /[\u0000-\u001f\u007f]/.test(name)) throw new HttpError(400, 'Check teammate names.');
      return name.trim();
    }).filter(Boolean);
  }
  return { fullName, phoneNumber, email, discordTag: text('discordTag', 80), university: text('university', 160), yearOfStudy: input.yearOfStudy, studentId: text('studentId', 80), hasTeam: input.hasTeam, teamName: input.hasTeam ? text('teamName', 100) : '', teammates, needsTransportation: input.needsTransportation, transportationAddress: input.needsTransportation ? text('transportationAddress', 240) : '', expectations: text('expectations', 2000) };
}

export function csvCell(value) {
  let text = Array.isArray(value) ? value.join('; ') : String(value ?? '');
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
