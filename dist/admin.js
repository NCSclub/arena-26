const $ = selector => document.querySelector(selector);
const pageSize = 50;
let records = [], offset = 0, loading = false;
let selectedMember, saving = false;
let rosterRecords = [];
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
  const button = document.createElement('button');
  button.className = `button secondary details-button ${style}`;
  button.textContent = title;
  button.setAttribute('aria-label', `${title} for ${record.fullName}`);
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
    $('#total').textContent = data.total;$('#teams').textContent = data.teams;$('#solo').textContent = data.total - data.teams;$('#transport').textContent = data.transport;
    render();$('#load-status').textContent = typeof message === 'string' && message ? message : 'Up to date · Algeria time';
  } catch (error) { $('#load-status').textContent = error.message; }
  finally { loading = false;$('#refresh').disabled = false; }
}

$('#login-form').addEventListener('submit', async event => {
  event.preventDefault();const button = $('#login-form button');button.disabled = true;$('#login-status').textContent = 'Signing in…';
  try {
    await api('/api/admin/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('#password').value }) });
    $('#password').value = '';$('#login-panel').hidden = true;$('#dashboard').hidden = false;await load();
  } catch (error) { $('#login-status').textContent = error.message; }
  finally { button.disabled = false; }
});
$('#logout').addEventListener('click', async () => {
  try { await api('/api/admin/session', { method: 'DELETE' }); showLogin('Signed out.'); }
  catch (error) { $('#load-status').textContent = error.message; }
});
$('#refresh').addEventListener('click', load);
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
  await api('/api/admin/session');$('#login-panel').hidden = true;$('#dashboard').hidden = false;await load();
} catch { showLogin(); }
