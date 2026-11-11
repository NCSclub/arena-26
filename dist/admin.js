import { CHALLENGE_TYPES, sessionIsOpen, SETTINGS_LIMITS, SUBMISSION_SESSIONS } from '/submission-rules.js';

const $ = selector => document.querySelector(selector);
const pageSize = 50;
let records = [], offset = 0, loading = false;
let selectedMember, saving = false;
let rosterRecords = [];
let submissions = [], loadingSubmissions = false, selectedSubmission;
let settings, settingsDirty = false, savingSettings = false;

// The dashboard has two pages, chosen by the URL hash so a reload stays on the same page.
const dashboardPages = ['registrations', 'submissions'];
function showPage() {
  const current = dashboardPages.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'registrations';
  for (const page of dashboardPages) {
    $(`#${page}-page`).hidden = page !== current;
    const tab = $(`[data-tab="${page}"]`);
    if (page === current) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }
  document.title = `ARENA — ${current === 'submissions' ? 'Submissions' : 'Registrations'} · Organizer console`;
}
addEventListener('hashchange', showPage);
showPage();
const date = value => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Algiers', hourCycle: 'h23' }).format(new Date(value));
const labels = { id: 'Reference', createdAt: 'Registered (Algeria time)', fullName: 'Full name', email: 'Email', phoneNumber: 'Phone', discordTag: 'Discord', university: 'Institution', yearOfStudy: 'Year of study', studentId: 'Student ID', hasTeam: 'Has a team', teamName: 'Team name', teammates: 'Teammates', needsTransportation: 'Transport requested', transportationAddress: 'Departure address', expectations: 'Expectations' };

function showLogin(message = '') {
  records = []; offset = 0;
  rosterRecords = [];
  clearFilters();
  $('#roster-team').value = '';
  $('#roster-search').value = '';
  updateTeamOptions();
  selectedMember = undefined;
  toggleEdit(false);
  $('#team-list').replaceChildren();
  $('#teams-status').textContent = '';
  $('#registration-rows').replaceChildren(); $('#detail-fields').replaceChildren();
  submissions = []; selectedSubmission = undefined; settings = undefined; settingsDirty = false;
  for (const selector of submissionFilters) $(selector).value = '';
  for (const selector of ['#submission-rows', '#latest-head', '#latest-rows', '#submission-fields', '#submission-files', '#session-settings']) $(selector).replaceChildren();
  for (const selector of ['#submissions-status', '#settings-status', '#registrations-tab-count', '#submissions-tab-count']) $(selector).textContent = '';
  $('#submission-detail').close();
  $('#registration-detail').close(); $('#dashboard').hidden = true; $('#login-panel').hidden = false;
  $('#login-status').textContent = message;
}

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...options });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) showLogin(data.error);
    throw new Error(data.error || 'Request failed. Please try again.');
  }
  return data;
}

function showDetails(record) {
  selectedMember = record;
  toggleEdit(false);
  $('#detail-status').textContent = '';
  $('#detail-title').textContent = record.fullName;
  $('#detail-fields').replaceChildren(...Object.entries(labels).map(([key, label]) => {
    const row = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = label;
    const value = record[key];
    dd.textContent = key === 'createdAt' ? date(value) : typeof value === 'boolean' ? value ? 'Yes' : 'No' : Array.isArray(value) ? value.join(', ') || '—' : value || '—';
    row.append(dt, dd);return row;
  }));
  if (!$('#registration-detail').open) $('#registration-detail').showModal();
}

function toggleEdit(editing) {
  $('#member-form').hidden = !editing;
  $('#member-actions').hidden = editing;
  $('#detail-fields').hidden = editing;
  if (!editing) $('#edit-fields').replaceChildren();
}

const fieldLimits = { fullName: 120, email: 160, phoneNumber: 24, discordTag: 80, university: 160,
  studentId: 80, teamName: 100, transportationAddress: 240, expectations: 2000 };

const teamFields = ['hasTeam', 'teamName', 'teammates'];

function showMemberForm(record, teamOnly = false, newTeam = false) {
  selectedMember = record;
  $('#member-save-status').textContent = '';
  $('#detail-title').textContent = record ? teamOnly ? `Edit team · ${record.fullName}` : `Edit · ${record.fullName}` : newTeam ? 'New team' : 'New member';
  $('#detail-status').textContent = record ? '' : newTeam
    ? 'Enter the team name, plus the first member’s name and email.'
    : 'Only name and email are required to add a solo member.';
  const fields = Object.entries(labels).filter(([key]) => teamOnly ? teamFields.includes(key) : !['id', 'createdAt'].includes(key));
  $('#edit-fields').replaceChildren(...fields.map(([key, title]) => {
    if (key === 'teammates') {
      const group = document.createElement('fieldset');
      group.id = 'teammate-fields';
      const legend = document.createElement('legend');
      legend.textContent = 'Teammates (optional)';
      group.append(legend);
      for (let index = 0; index < 3; index++) {
        const label = document.createElement('label');
        label.textContent = `Teammate ${index + 1}`;
        const input = document.createElement('input');
        input.name = 'teammate';
        input.maxLength = 120;
        input.value = record?.teammates?.[index] ?? '';
        label.append(input);
        group.append(label);
      }
      return group;
    }
    const label = document.createElement('label');
    const value = record?.[key];
    const control = document.createElement(key === 'yearOfStudy' ? 'select' :
      key === 'expectations' ? 'textarea' : 'input');
    control.name = key;
    label.textContent = title;
    if (key === 'yearOfStudy') {
      control.append(new Option('Select a year', ''), ...['L1', 'L2', 'L3', 'M1'].map(year => new Option(year, year)));
    }
    if (['hasTeam', 'needsTransportation'].includes(key)) {
      control.type = 'checkbox';
      control.checked = Boolean(value || (newTeam && key === 'hasTeam'));
      control.disabled = newTeam && key === 'hasTeam';
      label.prepend(control);
    } else {
      if (key === 'email') control.type = 'email';
      if (key === 'phoneNumber') control.type = 'tel';
      if (key === 'teamName') control.setAttribute('list', 'team-options');
      control.required = ['fullName', 'email', 'teamName', 'transportationAddress'].includes(key);
      if (fieldLimits[key]) control.maxLength = fieldLimits[key];
      control.value = value ?? '';
      label.append(control);
    }
    return label;
  }));
  const form = $('#member-form');
  const updateFields = () => {
    const teammates = $('#teammate-fields');
    teammates.hidden = teammates.disabled = !form.elements.hasTeam.checked;
    for (const [name, enabled] of Object.entries({
      teamName: form.elements.hasTeam.checked,
      transportationAddress: form.elements.needsTransportation?.checked,
    })) {
      const field = form.elements[name];
      if (!field) continue;
      field.disabled = !enabled;
      field.parentElement.hidden = !enabled;
    }
  };
  form.elements.hasTeam.onchange = updateFields;
  if (form.elements.needsTransportation) form.elements.needsTransportation.onchange = updateFields;
  updateFields();
  toggleEdit(true);
  form.querySelector('[type="submit"]').textContent = record ? 'Save changes' : newTeam ? 'Create team' : 'Add member';
  if (!$('#registration-detail').open) $('#registration-detail').showModal();
  (form.elements.fullName || form.elements.hasTeam).focus();
  $('#registration-detail').scrollTop = 0;
}

$('#add-member').addEventListener('click', () => showMemberForm());
$('#add-team').addEventListener('click', () => showMemberForm(undefined, false, true));
$('#edit-member').addEventListener('click', () => showMemberForm(selectedMember));
$('#edit-team').addEventListener('click', () => showMemberForm(selectedMember, true));
$('#cancel-edit').addEventListener('click', () => {
  if (selectedMember) showDetails(selectedMember);
  else $('#registration-detail').close();
});
$('#member-form').addEventListener('submit', event => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const teammates = formData.getAll('teammate').map(name => name.trim()).filter(Boolean);
  formData.delete('teammate');
  const values = { ...selectedMember, ...Object.fromEntries(formData), teammates };
  values.hasTeam = form.elements.hasTeam.checked;
  if (form.elements.needsTransportation) values.needsTransportation = form.elements.needsTransportation.checked;
  values.revision = selectedMember?.revision ?? 0;
  changeMember(selectedMember, selectedMember ? 'PATCH' : 'POST', values,
    selectedMember ? 'Member details saved.' : 'Member added.', form.querySelector('[type="submit"]'));
});
$('#delete-member').addEventListener('click', event => {
  deleteMember(selectedMember, event.currentTarget);
});

function deleteMember(record, button) {
  if (confirm(`Permanently delete ${record.fullName}'s registration?`)) {
    changeMember(record, 'DELETE', undefined, 'Member deleted.', button);
  }
}

async function changeMember(record, method, values, message, button) {
  const dialog = $('#registration-detail');
  const status = !dialog.open ? $('#load-status') :
    $('#member-form').hidden ? $('#detail-status') : $('#member-save-status');
  if (saving || loading) {
    status.textContent = 'Please wait for the current request to finish, then try again.';
    return;
  }
  saving = true;
  button.disabled = true;
  status.textContent = 'Saving…';
  try {
    const path = record ? `/api/admin/registrations?id=${encodeURIComponent(record.id)}` : '/api/admin/registrations';
    const data = await api(path, {
      method,
      ...(values && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) }),
    });
    if (dialog.open && selectedMember?.id === record?.id) {
      if (data.record) {
        showDetails(data.record);
        $('#detail-status').textContent = message;
      } else dialog.close();
    }
    if (method === 'POST') {
      offset = 0;
      clearFilters();
      $('#roster-team').value = '';
      $('#roster-search').value = '';
    }
    await load(message);
  } catch (error) {
    (dialog.open ? status : $('#load-status')).textContent = error.message;
  }
  finally { saving = false;button.disabled = false; }
}

function updateTeamOptions() {
  const names = [...new Set(records.filter(record => record.hasTeam && record.teamName).map(record => record.teamName))]
    .sort((a, b) => a.localeCompare(b));
  const select = $('#filter-team');
  const current = select.value;
  select.replaceChildren(new Option('All teams and solo', ''), new Option('Solo members', 'solo'),
    ...names.map(name => new Option(name, `team:${name}`)));
  if ([...select.options].some(option => option.value === current)) select.value = current;
  const rosterSelect = $('#roster-team');
  const currentRoster = rosterSelect.value;
  rosterSelect.replaceChildren(new Option('All teams', ''), ...names.map(name => new Option(name, name)));
  if (names.includes(currentRoster)) rosterSelect.value = currentRoster;
  $('#team-options').replaceChildren(...names.map(name => new Option(name, name)));
}

function renderTeams() {
  const status = $('#teams-status');
  const selectedTeam = $('#roster-team').value;
  const query = $('#roster-search').value.trim().toLowerCase();
  const teams = new Map();
  for (const record of rosterRecords) {
      if (!record.hasTeam || !record.teamName) continue;
    if (selectedTeam && record.teamName !== selectedTeam) continue;
      if (!teams.has(record.teamName)) teams.set(record.teamName, []);
      teams.get(record.teamName).push(record);
    }
  const names = [...teams.keys()].filter(name => name.toLowerCase().includes(query) ||
    teams.get(name).some(record => [record.fullName, ...(record.teammates ?? [])]
      .some(value => value.toLowerCase().includes(query))))
    .sort((a, b) => a.localeCompare(b));
  $('#team-list').replaceChildren(...names.map(name => {
    const card = document.createElement('article');
    const heading = document.createElement('h3');
    heading.textContent = name;
    card.append(heading);
    for (const record of teams.get(name)) {
      const row = document.createElement('div');
      const label = document.createElement('span');
      label.textContent = record.fullName;
      row.className = 'team-member';
      row.append(label,
        memberButton('Edit member', record, () => showMemberForm(record)),
        memberButton('Edit team', record, () => showMemberForm(record, true)),
        memberButton('Delete member', record, event => deleteMember(record, event.currentTarget), 'danger'));
      if (record.teammates?.length) {
        const teammates = document.createElement('small');
        teammates.className = 'team-member-notes';
        teammates.textContent = `Listed teammates · ${record.teammates.join(', ')}`;
        row.append(teammates);
      }
      card.append(row);
    }
    return card;
  }));
  status.textContent = names.length ? `${names.length} matching teams` : 'No matching teams.';
}

function memberButton(title, record, action, style = '') {
  return actionButton(title, `${title} for ${record.fullName}`, action, style);
}

function actionButton(title, label, action, style = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `button secondary details-button ${style}`;
  button.textContent = title;
  button.setAttribute('aria-label', label);
  button.addEventListener('click', action);
  return button;
}

const filterInputs = ['#search', '#filter-team', '#filter-attendance', '#filter-transport', '#filter-year'];

function clearFilters() {
  for (const selector of filterInputs) $(selector).value = '';
}

function render() {
  const query = $('#search').value.trim().toLowerCase();
  const team = $('#filter-team').value;
  const attendance = $('#filter-attendance').value;
  const transport = $('#filter-transport').value;
  const year = $('#filter-year').value;
  const matches = records.filter(row =>
    (!team || (row.hasTeam ? `team:${row.teamName}` : 'solo') === team) &&
    (!attendance || Boolean(row.checkedInAt) === (attendance === 'yes')) &&
    (!transport || row.needsTransportation === (transport === 'yes')) &&
    (!year || row.yearOfStudy === year) &&
    [row.fullName, row.email, row.university, row.teamName, ...(row.teammates ?? [])]
      .some(value => (value ?? '').toLowerCase().includes(query)));
  offset = Math.min(offset, Math.floor(Math.max(0, matches.length - 1) / pageSize) * pageSize);
  $('#registration-rows').replaceChildren(...matches.slice(offset, offset + pageSize).map(record => {
    const tr = document.createElement('tr');
    const add = (main, sub) => { const td = document.createElement('td');td.textContent = main;if (sub) { const small = document.createElement('small');small.textContent = sub;td.append(small); }tr.append(td);return td; };
    add(record.fullName, record.email);add(record.university, record.yearOfStudy);add(record.hasTeam ? record.teamName : 'Solo');
    add(record.needsTransportation ? 'Requested' : 'Independent');add(date(record.createdAt));
    const attendance = add(record.checkedInAt ? 'Checked in' : 'Awaiting check-in', record.checkedInAt && date(record.checkedInAt));
    attendance.className = 'attendance';
    const checkIn = document.createElement('button');
    checkIn.className = 'button secondary details-button';
    checkIn.textContent = record.checkedInAt ? 'Undo check-in' : 'Check in';
    checkIn.setAttribute('aria-label', `${checkIn.textContent} for ${record.fullName}`);
    checkIn.addEventListener('click', () => changeMember(record, 'PATCH', { checkedIn: !record.checkedInAt },
      record.checkedInAt ? 'Check-in undone.' : 'Member checked in.', checkIn));
    attendance.append(checkIn);
    const td = add('');
    td.className = 'member-row-actions';
    td.append(memberButton('View', record, () => showDetails(record)),
      memberButton('Edit team', record, () => showMemberForm(record, true)),
      memberButton('Delete', record, event => deleteMember(record, event.currentTarget), 'danger'));
    return tr;
  }));
  $('#empty-state').hidden = matches.length > 0;
  $('#empty-state').textContent = records.length ? 'No members match these filters.' : 'No registrations yet.';
  $('#page-info').textContent = `${matches.length ? offset + 1 : 0}–${Math.min(offset + pageSize, matches.length)} of ${matches.length}`;
  $('#previous-page').disabled = offset === 0;$('#next-page').disabled = offset + pageSize >= matches.length;
  rosterRecords = matches;
  renderTeams();
}

async function load(message = '') {
  if (loading) return;
  loading = true;$('#load-status').textContent = 'Loading registrations…';$('#refresh').disabled = true;
  try {
    const data = await api('/api/admin/registrations');
    const all = new Map(data.records.map(record => [record.id, record]));
    for (let start = data.limit; start < data.total; start += data.limit) {
      const page = await api(`/api/admin/registrations?offset=${start}`);
      for (const record of page.records) all.set(record.id, record);
    }
    if ($('#dashboard').hidden) return;
    records = [...all.values()];
    updateTeamOptions();
    $('#total').textContent = data.total;$('#registrations-tab-count').textContent = data.total;$('#teams').textContent = data.teams;$('#solo').textContent = data.total - data.teams;$('#transport').textContent = data.transport;
    render();$('#load-status').textContent = typeof message === 'string' && message ? message : 'Up to date · Algeria time';
  } catch (error) { $('#load-status').textContent = error.message; }
  finally { loading = false;$('#refresh').disabled = false; }
}

const submissionFilters = ['#submission-search', '#grid-session'];
const fileSize = bytes => bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
const shortDate = value => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Algiers', hourCycle: 'h23' }).format(new Date(value));
const answersOf = row => row.answers ?? [];
const answerCount = count => `${count} ${count === 1 ? 'answer' : 'answers'}`;
const sessionLabel = value => SUBMISSION_SESSIONS.find(session => session.value === value)?.label ?? value ?? '—';
// Uses the current name, or the name saved with the answer if the challenge was removed since.
const challengeName = answer => settings?.sessions.flatMap(session => session.challenges).find(challenge => challenge.value === answer.challenge)?.label
  ?? answer.challengeLabel ?? answer.challenge;
// Text answers are numbered parts: one line for the tables, one part per line in the detail view.
const textLine = answer => answer.parts.length === 1 ? answer.parts[0] : answer.parts.map((part, index) => `${index + 1}) ${part || '—'}`).join('   ');
const textLines = answer => answer.parts.length === 1 ? answer.parts[0] : answer.parts.map((part, index) => `Part ${index + 1}: ${part || '—'}`).join('\n');
// Algeria stays on UTC+1 all year, so the closing-time field converts with a fixed offset.
const toAlgeriaInput = iso => iso ? new Date(Date.parse(iso) + 3600e3).toISOString().slice(0, 16) : '';
const fromAlgeriaInput = value => value ? new Date(`${value}:00+01:00`).toISOString() : null;

function renderSubmissionStats() {
  $('#submission-total').textContent = submissions.length;
  $('#submissions-tab-count').textContent = submissions.length;
  $('#submission-teams').textContent = new Set(submissions.map(row => row.teamName.trim().toLowerCase())).size;
  $('#submission-latest').textContent = submissions[0] ? date(submissions[0].createdAt) : '—';
  const states = settings?.sessions.map(session => [sessionLabel(session.value).replace(/ Session$/, ''), sessionIsOpen(session)]) ?? [];
  $('#submission-state').textContent = states.length ? states.map(([name, open]) => `${name}: ${open ? 'open' : 'closed'}`).join(' · ') : '—';
  $('#submission-state').className = `stat-text ${states.some(([, open]) => open) ? 'open' : states.length ? 'closed' : ''}`;
}

function setSettingsStatus(message, state = '') {
  $('#settings-status').textContent = message;
  $('#settings-status').className = state;
}

function setSettingsDirty(dirty) {
  settingsDirty = dirty;
  setSettingsStatus(dirty ? 'Unsaved changes' : '', dirty ? 'dirty' : '');
}

// ---------- Form settings: one panel per session ----------

const answersFor = value => submissions.filter(row => answersOf(row).some(answer => answer.challenge === value)).length;

function updateSessionHelp(panel) {
  const hasChallenges = panel.querySelector('.challenge-rows').children.length > 0;
  panel.querySelector('.challenge-empty').hidden = hasChallenges;
  const open = panel.querySelector('[data-field="open"]').checked;
  const endsAt = fromAlgeriaInput(panel.querySelector('[data-field="endsAt"]').value);
  panel.querySelector('.open-help').textContent = !open ? 'Off: teams see this session as closed.'
    : !hasChallenges ? 'Add at least one challenge before opening this session.'
      : endsAt && Date.parse(endsAt) <= Date.now() ? 'The closing time has passed, so teams see this session as closed.'
        : endsAt ? `On until ${shortDate(endsAt)} (Algeria time). Teams see a countdown.`
          : 'On: teams can send answers. No closing time set.';
}

function challengeRow({ value = '', label = '', type = 'file', fields = 1 } = {}) {
  const row = document.createElement('div');
  row.className = 'challenge-row';
  row.dataset.value = value;
  const name = document.createElement('input');
  name.required = true;
  name.maxLength = SETTINGS_LIMITS.challengeLabel;
  name.value = label;
  name.placeholder = 'Challenge name';
  name.setAttribute('aria-label', 'Challenge name');
  name.dataset.field = 'label';
  const kind = document.createElement('select');
  kind.setAttribute('aria-label', 'Answer type');
  kind.dataset.field = 'type';
  kind.append(...Object.entries(CHALLENGE_TYPES).map(([key, text]) => new Option(text, key)));
  kind.value = type;
  const boxes = document.createElement('label');
  boxes.className = 'box-count';
  boxes.textContent = 'Boxes';
  const count = document.createElement('input');
  count.type = 'number';
  count.min = 1;
  count.max = SETTINGS_LIMITS.fields;
  count.required = true;
  count.value = fields;
  count.dataset.field = 'fields';
  boxes.append(count);
  const syncType = () => { boxes.hidden = kind.value !== 'text'; count.disabled = kind.value !== 'text'; };
  kind.addEventListener('change', syncType);
  syncType();
  const meta = document.createElement('small');
  meta.textContent = value ? answerCount(answersFor(value)) : 'New';
  const remove = actionButton('Remove', `Remove challenge ${label}`.trim(), () => {
    const used = answersFor(value);
    if (used && !confirm(`${answerCount(used)} for “${name.value}” will stay saved, but teams will no longer see this challenge. Remove it?`)) return;
    const panel = row.closest('.session-panel');
    row.remove();
    updateSessionHelp(panel);
    setSettingsDirty(true);
  }, 'danger');
  row.append(name, kind, boxes, meta, remove);
  return row;
}

function sessionPanel(session) {
  const panel = document.createElement('section');
  panel.className = 'session-panel';
  panel.dataset.session = session.value;
  const heading = document.createElement('h3');
  heading.textContent = sessionLabel(session.value);
  const toggle = document.createElement('label');
  toggle.className = 'switch';
  const open = document.createElement('input');
  open.type = 'checkbox';
  open.checked = session.open;
  open.dataset.field = 'open';
  const toggleText = document.createElement('span');
  toggleText.textContent = 'Accept submissions';
  const help = document.createElement('small');
  help.className = 'open-help';
  toggle.append(open, toggleText, help);
  const ends = document.createElement('label');
  ends.className = 'ends-at';
  ends.textContent = 'Closes at (Algeria time)';
  const endsHint = document.createElement('small');
  endsHint.textContent = 'Optional. Teams see a countdown and the session closes by itself at this time.';
  const endsRow = document.createElement('span');
  endsRow.className = 'ends-row';
  const endsInput = document.createElement('input');
  endsInput.type = 'datetime-local';
  endsInput.value = toAlgeriaInput(session.endsAt);
  endsInput.dataset.field = 'endsAt';
  const clear = actionButton('Clear', `Clear the closing time of the ${sessionLabel(session.value)}`, () => {
    endsInput.value = '';
    updateSessionHelp(panel);
    setSettingsDirty(true);
  });
  endsRow.append(endsInput, clear);
  ends.append(endsHint, endsRow);
  const rows = document.createElement('div');
  rows.className = 'challenge-rows';
  rows.append(...session.challenges.map(challengeRow));
  const empty = document.createElement('p');
  empty.className = 'challenge-empty';
  empty.textContent = 'No challenges yet. Add one before opening this session.';
  const add = actionButton('+ Add challenge', `Add a challenge to the ${sessionLabel(session.value)}`, () => {
    if (rows.children.length >= SETTINGS_LIMITS.challenges) {
      setSettingsStatus(`A session can have up to ${SETTINGS_LIMITS.challenges} challenges.`, 'error');
      return;
    }
    // Suggest the first unused "Challenge NN" so a new row never clashes with an existing name.
    const taken = new Set([...rows.querySelectorAll('[data-field="label"]')].map(input => input.value.trim().toLowerCase()));
    let number = 1;
    while (taken.has(`challenge ${String(number).padStart(2, '0')}`)) number++;
    const row = challengeRow({ label: `Challenge ${String(number).padStart(2, '0')}` });
    rows.append(row);
    row.querySelector('[data-field="label"]').select();
    updateSessionHelp(panel);
    setSettingsDirty(true);
  });
  add.classList.add('add-challenge');
  panel.append(heading, toggle, ends, rows, empty, add);
  updateSessionHelp(panel);
  return panel;
}

function renderSettings() {
  const form = $('#settings-form');
  $('#session-settings').replaceChildren(...SUBMISSION_SESSIONS.map(({ value }) =>
    sessionPanel(settings.sessions.find(session => session.value === value) ?? { value, open: false, endsAt: null, challenges: [] })));
  form.elements.extensions.value = settings.extensions.join(' ');
  for (const key of ['maxFileKB', 'maxTotalKB']) {
    form.elements[key].value = settings[key];
    form.elements[key].max = SETTINGS_LIMITS[key];
  }
  setSettingsDirty(false);
}

function settingsFromForm() {
  const form = $('#settings-form');
  return {
    revision: settings.revision,
    sessions: [...$('#session-settings').children].map(panel => ({
      value: panel.dataset.session,
      open: panel.querySelector('[data-field="open"]').checked,
      endsAt: fromAlgeriaInput(panel.querySelector('[data-field="endsAt"]').value),
      challenges: [...panel.querySelector('.challenge-rows').children].map(row => {
        const type = row.querySelector('[data-field="type"]').value;
        return {
          value: row.dataset.value, label: row.querySelector('[data-field="label"]').value.trim(), type,
          ...(type === 'text' && { fields: Number(row.querySelector('[data-field="fields"]').value) }),
        };
      }),
    })),
    extensions: form.elements.extensions.value.split(/[\s,]+/).map(extension => extension.replace(/^\./, '').toLowerCase()).filter(Boolean),
    maxFileKB: Number(form.elements.maxFileKB.value), maxTotalKB: Number(form.elements.maxTotalKB.value),
  };
}

function settingsApplied() {
  const select = $('#grid-session');
  if (!select.options.length) {
    select.append(...SUBMISSION_SESSIONS.map(({ value, label }) => new Option(label, value)));
    // Start on the session that is open now, if any.
    select.value = settings?.sessions.find(session => sessionIsOpen(session))?.value ?? SUBMISSION_SESSIONS[0].value;
  }
  renderSubmissions();
  renderSubmissionStats();
}

async function loadSettings(message = '') {
  try {
    const data = await api('/api/admin/settings');
    if ($('#dashboard').hidden) return;
    settings = data;
    renderSettings();
    settingsApplied();
    if (message) setSettingsStatus(message, 'saved');
  } catch (error) { setSettingsStatus(error.message, 'error'); }
}

function addCell(tr, main, sub) {
  const td = document.createElement('td');
  td.textContent = main;
  if (sub) { const small = document.createElement('small'); small.textContent = sub; td.append(small); }
  tr.append(td);
  return td;
}

// ---------- Answers: latest per team, and full history ----------

// Submissions are newest first, so the first answer met per team and challenge is the latest one.
function latestByTeam(sessionValue) {
  const teams = new Map();
  for (const row of submissions) {
    if (row.session !== sessionValue) continue;
    const key = row.teamName.trim().toLowerCase();
    if (!teams.has(key)) teams.set(key, { name: row.teamName, lastSent: row.createdAt, answers: new Map() });
    const team = teams.get(key);
    for (const answer of answersOf(row)) if (!team.answers.has(answer.challenge)) team.answers.set(answer.challenge, { ...answer, row });
  }
  return [...teams.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// One column per current challenge of the session, plus removed challenges that still have answers.
function gridColumns(sessionValue) {
  const session = settings?.sessions.find(entry => entry.value === sessionValue);
  const columns = new Map((session?.challenges ?? []).map(challenge => [challenge.value, challenge.label]));
  for (const row of submissions) {
    if (row.session !== sessionValue) continue;
    for (const answer of answersOf(row)) if (!columns.has(answer.challenge)) columns.set(answer.challenge, `${challengeName(answer)} (removed)`);
  }
  return [...columns];
}

const answerText = answer => answer.file?.name ?? textLine(answer);
const matchesQuery = (query, values) => !query || values.some(value => (value ?? '').toLowerCase().includes(query));

function answerCell(tr, team, value) {
  const answer = team.answers.get(value);
  const td = document.createElement('td');
  if (!answer) {
    td.textContent = '—';
    td.className = 'no-answer';
  } else if (answer.file) {
    td.append(actionButton(answer.file.name, `Read ${answer.file.name} from ${team.name}`, () => showSubmission(answer.row, value), 'file-answer'));
  } else {
    const text = document.createElement('span');
    text.className = 'text-answer';
    text.textContent = textLines(answer);
    td.append(text);
  }
  if (answer) {
    const sent = document.createElement('small');
    sent.textContent = shortDate(answer.row.createdAt);
    td.append(sent);
  }
  tr.append(td);
}

function renderSubmissions() {
  const query = $('#submission-search').value.trim().toLowerCase();
  const sessionValue = $('#grid-session').value || SUBMISSION_SESSIONS[0].value;
  const columns = gridColumns(sessionValue);
  $('#latest-head').replaceChildren(...['Team', ...columns.map(([, label]) => label), 'Last sent'].map(label => {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = label;
    return th;
  }));
  const teams = latestByTeam(sessionValue).filter(team => matchesQuery(query, [team.name, ...[...team.answers.values()].map(answerText)]));
  $('#latest-rows').replaceChildren(...teams.map(team => {
    const tr = document.createElement('tr');
    addCell(tr, team.name).className = 'team-cell';
    for (const [value] of columns) answerCell(tr, team, value);
    addCell(tr, date(team.lastSent));
    return tr;
  }));
  $('#latest-empty').hidden = teams.length > 0;
  $('#latest-empty').textContent = submissions.some(row => row.session === sessionValue)
    ? 'No teams match this search.' : `No answers yet for the ${sessionLabel(sessionValue)}.`;

  const history = submissions.filter(row => matchesQuery(query, [row.teamName, ...answersOf(row).map(answerText)]));
  $('#submission-rows').replaceChildren(...history.map(row => {
    const tr = document.createElement('tr');
    addCell(tr, row.teamName).className = 'team-cell';
    addCell(tr, sessionLabel(row.session));
    addCell(tr, answersOf(row).map(challengeName).join(', ') || '—', answerCount(answersOf(row).length));
    addCell(tr, date(row.createdAt));
    const actions = addCell(tr, '');
    actions.className = 'member-row-actions';
    actions.append(actionButton('View', `View submission from ${row.teamName}`, () => showSubmission(row)),
      actionButton('Delete', `Delete submission from ${row.teamName}`, event => deleteSubmission(row, event.currentTarget), 'danger'));
    return tr;
  }));
  $('#submissions-empty').hidden = history.length > 0;
  $('#submissions-empty').textContent = submissions.length ? 'No submissions match this search.' : 'No submissions yet.';
}

async function loadSubmissions(message = '') {
  if (loadingSubmissions) return;
  loadingSubmissions = true; $('#submissions-status').textContent = 'Loading submissions…'; $('#refresh-submissions').disabled = true;
  try {
    const data = await api('/api/admin/submissions');
    const all = new Map(data.records.map(record => [record.id, record]));
    for (let start = data.limit; start < data.total; start += data.limit) {
      const page = await api(`/api/admin/submissions?offset=${start}`);
      for (const record of page.records) all.set(record.id, record);
    }
    if ($('#dashboard').hidden) return;
    submissions = [...all.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    settingsApplied();
    for (const row of $('#session-settings').querySelectorAll('.challenge-row')) {
      if (row.dataset.value) row.querySelector('small').textContent = answerCount(answersFor(row.dataset.value));
    }
    $('#submissions-status').textContent = `${message || 'Up to date'} · ${submissions.length} ${submissions.length === 1 ? 'submission' : 'submissions'}`;
  } catch (error) { $('#submissions-status').textContent = error.message; }
  finally { loadingSubmissions = false; $('#refresh-submissions').disabled = false; }
}

// Shows every answer in one submission; `focus` scrolls to the answer for that challenge.
async function showSubmission(row, focus) {
  selectedSubmission = row;
  const answers = answersOf(row);
  const fields = {
    Reference: row.id, 'Submitted (Algeria time)': date(row.createdAt), Team: row.teamName,
    Session: sessionLabel(row.session), Answered: answerCount(answers.length),
  };
  $('#submission-detail-title').textContent = row.teamName;
  $('#submission-fields').replaceChildren(...Object.entries(fields).map(([label, value]) => {
    const div = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = label; dd.textContent = value;
    div.append(dt, dd); return div;
  }));
  $('#submission-files').replaceChildren(...answers.map(answer => answerBlock(row, answer)));
  const hasFiles = answers.some(answer => answer.file);
  $('#submission-detail-status').textContent = hasFiles ? 'Loading files…' : '';
  if (!$('#submission-detail').open) $('#submission-detail').showModal();
  if (focus) $(`#submission-files [data-challenge="${focus}"]`)?.scrollIntoView({ block: 'start' });
  if (!hasFiles) return;
  try {
    const data = await api(`/api/admin/submissions?id=${encodeURIComponent(row.id)}`);
    if (selectedSubmission?.id !== row.id) return;
    for (const file of data.files) {
      const code = $(`#submission-files [data-challenge="${file.challenge}"] code`);
      if (code) code.textContent = file.content;
    }
    $('#submission-detail-status').textContent = '';
  } catch (error) { $('#submission-detail-status').textContent = error.message; }
}

function answerBlock(row, answer) {
  const article = document.createElement('article'), header = document.createElement('header');
  const name = document.createElement('strong'), meta = document.createElement('small');
  article.className = 'code-file';
  article.dataset.challenge = answer.challenge;
  name.textContent = challengeName(answer);
  header.append(name, meta);
  if (answer.file) {
    meta.textContent = `${answer.file.name} · ${fileSize(answer.file.size)}`;
    const download = document.createElement('a');
    download.className = 'button secondary details-button';
    download.href = `/api/admin/submissions?id=${encodeURIComponent(row.id)}&challenge=${encodeURIComponent(answer.challenge)}`;
    download.textContent = 'Download ↓';
    download.setAttribute('aria-label', `Download ${answer.file.name}`);
    header.append(download);
    const pre = document.createElement('pre'), code = document.createElement('code');
    pre.tabIndex = 0;
    pre.setAttribute('aria-label', `Contents of ${answer.file.name}`);
    code.textContent = 'Loading…';
    pre.append(code);
    article.append(header, pre);
  } else {
    meta.textContent = answer.parts.length === 1 ? 'Text answer' : `${answer.parts.length} text boxes`;
    const text = document.createElement('p');
    text.className = 'text-answer-full';
    text.textContent = textLines(answer);
    article.append(header, text);
  }
  return article;
}

async function deleteSubmission(row, button) {
  if (!row || !confirm(`Permanently delete this submission from ${row.teamName}?`)) return;
  const status = $('#submission-detail').open ? $('#submission-detail-status') : $('#submissions-status');
  button.disabled = true;
  status.textContent = 'Deleting…';
  try {
    await api(`/api/admin/submissions?id=${encodeURIComponent(row.id)}`, { method: 'DELETE' });
    if (selectedSubmission?.id === row.id) $('#submission-detail').close();
    submissions = submissions.filter(submission => submission.id !== row.id);
    settingsApplied();
    $('#submissions-status').textContent = `Submission deleted · ${submissions.length} remaining`;
  } catch (error) { status.textContent = error.message; }
  finally { button.disabled = false; }
}

for (const selector of submissionFilters) $(selector).addEventListener('input', renderSubmissions);
$('#refresh-submissions').addEventListener('click', () => loadSubmissions());

$('#settings-form').addEventListener('input', event => {
  const panel = event.target.closest('.session-panel');
  if (panel) updateSessionHelp(panel);
  setSettingsDirty(true);
});
$('#discard-settings').addEventListener('click', () => {
  if (settingsDirty && !confirm('Discard your unsaved changes to the form settings?')) return;
  loadSettings(settingsDirty ? 'Changes discarded.' : 'Settings reloaded.');
});
$('#settings-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (savingSettings || !settings) return;
  const emptyOpen = [...$('#session-settings').children].find(panel =>
    panel.querySelector('[data-field="open"]').checked && !panel.querySelector('.challenge-rows').children.length);
  if (emptyOpen) {
    setSettingsStatus(`Add at least one challenge before opening the ${sessionLabel(emptyOpen.dataset.session)}.`, 'error');
    emptyOpen.querySelector('.add-challenge').focus();
    return;
  }
  const button = event.currentTarget.querySelector('[type="submit"]');
  savingSettings = true;
  button.disabled = true;
  setSettingsStatus('Saving…');
  try {
    settings = await api('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settingsFromForm()) });
    renderSettings();
    settingsApplied();
    const open = settings.sessions.filter(session => sessionIsOpen(session)).map(session => sessionLabel(session.value));
    setSettingsStatus(`Saved. ${open.length ? `Open now: ${open.join(' and ')}.` : 'Both sessions are closed.'}`, 'saved');
  } catch (error) { setSettingsStatus(error.message, 'error'); }
  finally { savingSettings = false; button.disabled = false; }
});
addEventListener('beforeunload', event => { if (settingsDirty) event.preventDefault(); });
$('#close-submission').addEventListener('click', () => $('#submission-detail').close());
$('#delete-submission').addEventListener('click', event => deleteSubmission(selectedSubmission, event.currentTarget));

$('#login-form').addEventListener('submit', async event => {
  event.preventDefault();const button = $('#login-form button');button.disabled = true;$('#login-status').textContent = 'Signing in…';
  try {
    await api('/api/admin/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('#password').value }) });
    $('#password').value = '';$('#login-panel').hidden = true;$('#dashboard').hidden = false;loadSettings();await load();loadSubmissions();
  } catch (error) { $('#login-status').textContent = error.message; }
  finally { button.disabled = false; }
});
$('#logout').addEventListener('click', async () => {
  try { await api('/api/admin/session', { method: 'DELETE' }); showLogin('Signed out.'); }
  catch (error) { $('#load-status').textContent = error.message; }
});
$('#refresh').addEventListener('click', () => { load(); loadSubmissions(); });
$('#previous-page').addEventListener('click', () => { offset = Math.max(0, offset - pageSize);render(); });
$('#next-page').addEventListener('click', () => { offset += pageSize;render(); });
for (const selector of filterInputs) $(selector).addEventListener('input', () => { offset = 0;render(); });
$('#clear-filters').addEventListener('click', () => { clearFilters();offset = 0;render(); });
$('#roster-team').addEventListener('change', renderTeams);
$('#roster-search').addEventListener('input', renderTeams);
$('#clear-roster-filters').addEventListener('click', () => {
  $('#roster-team').value = '';
  $('#roster-search').value = '';
  renderTeams();
});
$('#close-detail').addEventListener('click', () => $('#registration-detail').close());
try {
  await api('/api/admin/session');$('#login-panel').hidden = true;$('#dashboard').hidden = false;loadSettings();await load();loadSubmissions();
} catch { showLogin(); }
