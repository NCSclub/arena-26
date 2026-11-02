const $ = selector => document.querySelector(selector);
let records = [], offset = 0, total = 0, loading = false;
const date = value => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Algiers', hourCycle: 'h23' }).format(new Date(value));
const labels = { id: 'Reference', createdAt: 'Registered (Algeria time)', fullName: 'Full name', email: 'Email', phoneNumber: 'Phone', discordTag: 'Discord', university: 'Institution', yearOfStudy: 'Year of study', studentId: 'Student ID', hasTeam: 'Has a team', teamName: 'Team name', teammates: 'Teammates', needsTransportation: 'Transport requested', transportationAddress: 'Departure address', expectations: 'Expectations' };

function showLogin(message = '') {
  records = []; offset = 0; total = 0;
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
  $('#detail-title').textContent = record.fullName;
  $('#detail-fields').replaceChildren(...Object.entries(labels).map(([key, label]) => {
    const row = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = label;
    const value = record[key];
    dd.textContent = key === 'createdAt' ? date(value) : typeof value === 'boolean' ? value ? 'Yes' : 'No' : Array.isArray(value) ? value.join(', ') || '—' : value || '—';
    row.append(dt, dd);return row;
  }));
  $('#registration-detail').showModal();
}

function render() {
  const query = $('#search').value.trim().toLowerCase();
  const matches = records.filter(row => [row.fullName, row.email, row.university, row.teamName].some(value => value.toLowerCase().includes(query)));
  $('#registration-rows').replaceChildren(...matches.map(record => {
    const tr = document.createElement('tr');
    const add = (main, sub) => { const td = document.createElement('td');td.textContent = main;if (sub) { const small = document.createElement('small');small.textContent = sub;td.append(small); }tr.append(td);return td; };
    add(record.fullName, record.email);add(record.university, record.yearOfStudy);add(record.hasTeam ? record.teamName : 'Solo');
    add(record.needsTransportation ? 'Requested' : 'Independent');add(date(record.createdAt));
    const td = add(''), button = document.createElement('button');button.className = 'button secondary details-button';button.textContent = 'View';button.setAttribute('aria-label', `View ${record.fullName}`);button.addEventListener('click', () => showDetails(record));td.append(button);
    return tr;
  }));
  $('#empty-state').hidden = matches.length > 0;
  $('#empty-state').textContent = query && records.length ? 'No matching players on this page.' : 'No registrations yet. New players will appear here after submitting the form.';
  $('#page-info').textContent = `${total ? offset + 1 : 0}–${Math.min(offset + records.length, total)} of ${total}`;
  $('#previous-page').disabled = offset === 0;$('#next-page').disabled = offset + records.length >= total;
}

async function load() {
  if (loading) return;
  loading = true;$('#load-status').textContent = 'Loading registrations…';$('#refresh').disabled = true;
  try {
    const data = await api(`/api/admin/registrations?offset=${offset}`);
    records = data.records;total = data.total;
    $('#total').textContent = total;$('#teams').textContent = data.teams;$('#solo').textContent = total - data.teams;$('#transport').textContent = data.transport;
    render();$('#load-status').textContent = 'Up to date · Algeria time';
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
$('#previous-page').addEventListener('click', () => { if (loading) return;offset = Math.max(0, offset - 50);load(); });
$('#next-page').addEventListener('click', () => { if (loading) return;offset += 50;load(); });
$('#search').addEventListener('input', render);
$('#close-detail').addEventListener('click', () => $('#registration-detail').close());
try {
  await api('/api/admin/session');$('#login-panel').hidden = true;$('#dashboard').hidden = false;await load();
} catch { showLogin(); }
