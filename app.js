/* ============================================================
   IMAGO DEI Patient Intake & Service Record Management System
   Frontend application (Supabase backend)
   CONFIG: paste your project URL and anon key below.
   ============================================================ */
const SUPABASE_URL      = 'sb_publishable_Kin2H_bCAeeyuxDFMB0Kww_x8Sz2J0o';
const SUPABASE_ANON_KEY = 'sb_secret_RlixionfjRtVGzmhqg7QeQ_IlNRGkaY';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let session = null;
let myProfile = null;

/* ---------------- helpers ---------------- */
const el = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const peso = n => '\u20B1' + Number(n || 0).toLocaleString('en-PH',
  {minimumFractionDigits: 2, maximumFractionDigits: 2});
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-PH',
  {year:'numeric', month:'short', day:'numeric'}) : '';
const ageFrom = dob => {
  if (!dob) return '';
  const b = new Date(dob), n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--;
  return a;
};

function toast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  el('toast-container').appendChild(t);
  setTimeout(() => t.remove(), 3800);
}

function openModal(html) {
  const root = el('modal-root');
  root.innerHTML = '<div class="modal-backdrop"><div class="modal">' + html + '</div></div>';
  root.querySelector('.modal-backdrop').addEventListener('click', e => {
    if (e.target.classList.contains('modal-backdrop')) closeModal();
  });
}
function closeModal() { el('modal-root').innerHTML = ''; }

/* ---------------- auth ---------------- */
async function initAuth() {
  const { data } = await sb.auth.getSession();
  session = data.session;
  if (session) await loadProfile();
  renderShell();
  sb.auth.onAuthStateChange((_e, s) => {
    session = s;
    if (s) { loadProfile().then(renderShell); }
    else { myProfile = null; renderShell(); }
  });
}

async function loadProfile() {
  const { data, error } = await sb.from('profiles').select('*')
    .eq('id', session.user.id).single();
  if (error) { toast('Could not load user profile: ' + error.message, 'error'); return; }
  myProfile = data;
}

function renderShell() {
  const loggedIn = !!session && !!myProfile;
  el('login-screen').classList.toggle('hidden', loggedIn);
  el('app-shell').classList.toggle('hidden', !loggedIn);
  if (loggedIn) {
    el('user-info').innerHTML =
      '<strong>' + esc(myProfile.full_name || session.user.email) + '</strong>' +
      esc(session.user.email) + ' \u2022 ' + (myProfile.role === 'admin' ? 'Administrator' : 'Staff');
    applyPermissions();
    route();
  }
}

function applyPermissions() {
  const admin = myProfile && myProfile.role === 'admin';
  document.querySelectorAll('[data-admin-only]').forEach(n => n.classList.toggle('hidden', !admin));
}

el('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = el('login-btn');
  btn.disabled = true; btn.textContent = 'Signing in\u2026';
  el('login-error').classList.add('hidden');
  const { error } = await sb.auth.signInWithPassword({
    email: el('login-email').value.trim(),
    password: el('login-password').value
  });
  btn.disabled = false; btn.textContent = 'Sign In';
  if (error) {
    el('login-error').textContent = error.message;
    el('login-error').classList.remove('hidden');
  }
});

el('logout-btn').addEventListener('click', async () => {
  await sb.auth.signOut();
  location.hash = '';
});

/* ---------------- router ---------------- */
const routes = {
  '/dashboard': renderDashboard,
  '/clients':   renderClients,
  '/register':  renderRegister,
  '/midwives':  renderMidwives,
  '/services':  renderServices,
  '/reports':   renderReports
};
window.addEventListener('hashchange', route);

function route() {
  if (!session || !myProfile) return;
  const hash = location.hash.replace('#', '') || '/dashboard';
  const [path, param] = hash.split('/');
  document.querySelectorAll('#nav a').forEach(a =>
    a.classList.toggle('active', a.dataset.route === '/' + path));
  if (path === 'client' && param) return renderClientProfile(param);
  const r = routes['/' + path] || routes['/dashboard'];
  r();
}

/* ---------------- dashboard ---------------- */
async function renderDashboard() {
  const main = el('main');
  main.innerHTML = '<div class="spinner"></div>';
  const t = todayISO();
  const [
    clients, midwives, records, todayRecs, recentClients, recentRecords
  ] = await Promise.all([
    sb.from('clients').select('id, registered_at', { count: 'exact', head: false }),
    sb.from('midwives').select('id', { count: 'exact', head: true }).eq('status', 'Active'),
    sb.from('service_records').select('id, client_id', { count: 'exact', head: false }),
    sb.from('service_records').select('id', { count: 'exact', head: true }).eq('service_date', t),
    sb.from('clients').select('id, client_code, full_name, contact_number, registered_at')
      .order('created_at', { ascending: false }).limit(6),
    sb.from('service_records')
      .select('id, service_date, price, payment_status, clients(full_name, client_code), services(name)')
      .order('service_date', { ascending: false }).order('created_at', { ascending: false }).limit(6)
  ]);

  const totalClients = clients.count ?? clients.data.length;
  const returning = new Set((records.data || []).map(r => r.client_id)).size;
  const totalServices = records.count ?? records.data.length;
  const todayCount = todayRecs.count ?? 0;

  main.innerHTML = `
    <div class="page-head">
      <div><h2>Dashboard</h2><p>Welcome back. Here is today\u2019s snapshot.</p></div>
      <div>${todayISO()}</div>
    </div>

    <div class="stat-grid">
      <div class="stat"><div class="num">${totalClients}</div><div class="lbl">Registered Clients</div></div>
      <div class="stat accent"><div class="num">${returning}</div><div class="lbl">Returning Clients</div></div>
      <div class="stat"><div class="num">${totalServices}</div><div class="lbl">Services Performed</div></div>
      <div class="stat"><div class="num">${midwives.count ?? 0}</div><div class="lbl">Active Midwives</div></div>
      <div class="stat accent"><div class="num">${todayCount}</div><div class="lbl">Today\u2019s Services</div></div>
    </div>

    <div class="quick-grid">
      <button class="quick-btn" onclick="location.hash='#/register'">\u2795 Register New Client</button>
      <button class="quick-btn" onclick="location.hash='#/clients'">\uD83D\uDD0D Search Client</button>
      <button class="quick-btn" onclick="goAddService()">\u2795 Add New Service</button>
      <button class="quick-btn" onclick="location.hash='#/midwives'" data-admin-only>\u2699\uFE0F Manage Midwives</button>
      <button class="quick-btn" onclick="location.hash='#/services'" data-admin-only>\u2699\uFE0F Manage Services</button>
      <button class="quick-btn" onclick="location.hash='#/clients'">\uD83D\uDCCB View Client Records</button>
    </div>

    <div class="two-col">
      <div class="card">
        <h3 style="margin-bottom:12px">Recent Registrations</h3>
        ${(recentClients.data || []).length === 0 ? '<p style="color:var(--muted)">No clients yet.</p>' : `
        <table><thead><tr><th>Client</th><th>ID</th><th>Contact</th><th>Registered</th></tr></thead>
        <tbody>${recentClients.data.map(c => `
          <tr class="clickable" onclick="location.hash='#/client/${c.id}'">
            <td>${esc(c.full_name)}</td><td><span class="pill code">${esc(c.client_code)}</span></td>
            <td>${esc(c.contact_number || '-')}</td><td>${fmtDate(c.registered_at)}</td>
          </tr>`).join('')}</tbody></table>`}
      </div>
      <div class="card">
        <h3 style="margin-bottom:12px">Recent Service Transactions</h3>
        ${(recentRecords.data || []).length === 0 ? '<p style="color:var(--muted)">No services recorded yet.</p>' : `
        <table><thead><tr><th>Date</th><th>Client</th><th>Service</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>${recentRecords.data.map(r => `
          <tr>
            <td>${fmtDate(r.service_date)}</td>
            <td>${esc(r.clients ? r.clients.full_name : '?')} <span class="pill code">${esc(r.clients ? r.clients.client_code : '')}</span></td>
            <td>${esc(r.services ? r.services.name : '?')}</td>
            <td>${peso(r.price)}</td>
            <td><span class="pill ${r.payment_status.toLowerCase()}">${r.payment_status}</span></td>
          </tr>`).join('')}</tbody></table>`}
      </div>
    </div>`;
  applyPermissions();
}

/* "Add New Service" quick action: pick a client first via search */
function goAddService() {
  openClientPicker(client => openServiceModal(client));
}

/* ---------------- client registry & live search ---------------- */
let searchTimer = null;

async function renderClients() {
  const main = el('main');
  main.innerHTML = `
    <div class="page-head">
      <div><h2>Client Registry</h2><p>Type a name to find a returning client, or register a new one.</p></div>
      <button class="btn btn-accent" onclick="location.hash='#/register'">\u2795 Register New Client</button>
    </div>
    <div class="search-wrap">
      <input type="text" id="client-search" placeholder="Search client name\u2026"
             autocomplete="off" autocapitalize="words">
      <div id="suggest" class="hidden"></div>
    </div>
    <div id="recent-clients"></div>`;

  const { data } = await sb.from('clients')
    .select('id, client_code, full_name, contact_number, registered_at')
    .order('created_at', { ascending: false }).limit(15);
  renderClientList(data || []);

  el('client-search').addEventListener('input', e => {
    clearTimeout(searchTimer);
    const q = e.target.value.trim();
    if (q.length < 2) { el('suggest').classList.add('hidden'); return; }
    searchTimer = setTimeout(() => searchClients(q), 250);
  });
}

function renderClientList(clients) {
  el('recent-clients').innerHTML = clients.length === 0
    ? '<div class="card"><p style="color:var(--muted)">No clients found.</p></div>'
    : `<div class="card"><table><thead><tr>
        <th>Client</th><th>Client ID</th><th>Contact</th><th>Registered</th><th></th></tr></thead>
      <tbody>${clients.map(c => `
        <tr class="clickable" onclick="location.hash='#/client/${c.id}'">
          <td>${esc(c.full_name)}</td>
          <td><span class="pill code">${esc(c.client_code)}</span></td>
          <td>${esc(c.contact_number || '-')}</td>
          <td>${fmtDate(c.registered_at)}</td>
          <td><button class="btn btn-soft btn-sm" onclick="event.stopPropagation();openServiceModalById('${c.id}')">Add Service</button></td>
        </tr>`).join('')}</tbody></table></div>`;
}

async function searchClients(q) {
  const box = el('suggest');
  const { data, error } = await sb.from('clients')
    .select('id, client_code, full_name, contact_number, date_of_birth')
    .ilike('full_name', '%' + q + '%').order('full_name').limit(8);
  if (error) { toast(error.message, 'error'); return; }
  if (!data.length) {
    box.innerHTML = '<div class="suggest-empty">No match. ' +
      '<a href="#/register" onclick="document.getElementById(\'suggest\').classList.add(\'hidden\')">Register as new client</a></div>';
  } else {
    box.innerHTML = data.map(c => `
      <div class="suggest-item" onclick="pickClient('${c.id}')">
        <span>${esc(c.full_name)}</span>
        <small>${esc(c.client_code)} \u2022 ${esc(c.contact_number || 'no contact')}</small>
      </div>`).join('');
  }
  box.classList.remove('hidden');
}
function pickClient(id) {
  el('suggest').classList.add('hidden');
  el('client-search').value = '';
  location.hash = '#/client/' + id;
}

/* Reusable client picker modal (used by quick "Add New Service") */
function openClientPicker(onPick) {
  openModal(`
    <h3>Select a Client</h3>
    <div class="field" style="margin-bottom:12px">
      <input type="text" id="picker-search" placeholder="Type client name\u2026" autocomplete="off">
    </div>
    <div id="picker-results" style="max-height:300px;overflow-y:auto"></div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Cancel</button></div>`);
  const input = el('picker-search');
  input.focus();
  let t = null;
  input.addEventListener('input', () => {
    clearTimeout(t);
    const q = input.value.trim();
    if (q.length < 2) { el('picker-results').innerHTML = ''; return; }
    t = setTimeout(async () => {
      const { data } = await sb.from('clients')
        .select('id, client_code, full_name, contact_number')
        .ilike('full_name', '%' + q + '%').limit(8);
      el('picker-results').innerHTML = (data || []).map(c => `
        <div class="suggest-item" data-id="${c.id}">
          <span>${esc(c.full_name)}</span>
          <small>${esc(c.client_code)} \u2022 ${esc(c.contact_number || '-')}</small>
        </div>`).join('') || '<div class="suggest-empty">No match.</div>';
      el('picker-results').querySelectorAll('.suggest-item').forEach(n =>
        n.addEventListener('click', async () => {
          const { data: c } = await sb.from('clients').select('*').eq('id', n.dataset.id).single();
          closeModal(); onPick(c);
        }));
    }, 250);
  });
}

/* ---------------- register client (manual + OCR) ---------------- */
let intakeImageFile = null;

async function renderRegister() {
  const main = el('main');
  main.innerHTML = `
    <div class="page-head">
      <div><h2>Register Client</h2><p>Encode manually, or scan an existing intake form with OCR.</p></div>
    </div>
    <div class="tabs">
      <button class="tab active" id="tab-manual" onclick="switchTab('manual')">Manual Encoding</button>
      <button class="tab" id="tab-scan" onclick="switchTab('scan')">Picture / Camera (OCR)</button>
    </div>

    <div id="pane-scan" class="card hidden" style="margin-bottom:16px">
      <div class="drop-hint">Upload a photo of the client\u2019s intake form, or take a picture with the device camera.
        OCR will extract the text for review before saving.</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">
        <button class="btn btn-ghost" onclick="el('file-upload').click()">\uD83D\uDCC4 Upload Image</button>
        <button class="btn btn-ghost" onclick="el('file-camera').click()">\uD83D\uDCF7 Use Camera</button>
      </div>
      <input type="file" id="file-upload" accept="image/*" class="hidden">
      <input type="file" id="file-camera" accept="image/*" capture="environment" class="hidden">
      <div id="ocr-preview-area"></div>
      <div id="ocr-status" class="ocr-status"></div>
    </div>

    <div class="card">
      <div class="form-grid">
        <div class="field"><label>Full Name *</label><input id="f-name" required></div>
        <div class="field"><label>Contact Number</label><input id="f-contact"></div>
        <div class="field"><label>Address</label><input id="f-address"></div>
        <div class="field"><label>Date of Birth</label><input id="f-dob" type="date"></div>
        <div class="field"><label>Gender</label>
          <select id="f-gender"><option value="">\u2014</option><option>Female</option><option>Male</option><option>Other</option></select></div>
        <div class="field"><label>Emergency Contact Person</label><input id="f-ecp"></div>
        <div class="field"><label>Emergency Contact Number</label><input id="f-ecn"></div>
        <div class="field"><label>Date of Registration</label><input id="f-regdate" type="date" value="${todayISO()}"></div>
        <div class="field full"><label>Relevant Health Conditions / Medical Notes</label><textarea id="f-health"></textarea></div>
        <div class="field full"><label>Allergies and Contraindications</label><textarea id="f-allergies"></textarea></div>
        <div class="field full"><label>Additional Remarks</label><textarea id="f-remarks"></textarea></div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" onclick="location.hash='#/dashboard'">Cancel</button>
        <button class="btn btn-primary" id="save-client-btn" onclick="saveClient()">\uD83D\uDCBE Save Client</button>
      </div>
    </div>`;

  el('file-upload').addEventListener('change', e => handleIntakeImage(e.target.files[0]));
  el('file-camera').addEventListener('change', e => handleIntakeImage(e.target.files[0]));
}

function switchTab(which) {
  el('tab-manual').classList.toggle('active', which === 'manual');
  el('tab-scan').classList.toggle('active', which === 'scan');
  el('pane-scan').classList.toggle('hidden', which === 'manual');
}

async function handleIntakeImage(file) {
  if (!file) return;
  intakeImageFile = file;
  el('ocr-preview-area').innerHTML =
    '<img class="ocr-preview" src="' + URL.createObjectURL(file) + '">';
  const st = el('ocr-status');
  st.textContent = 'Running OCR\u2026 (first run downloads the language model, please wait)';
  try {
    const result = await Tesseract.recognize(file, 'eng');
    const text = result.data.text || '';
    st.textContent = 'OCR complete. Review the pre-filled fields below, then press Save Client.';
    applyOcrGuesses(text);
    toast('OCR finished \u2014 please review the extracted fields.', 'success');
  } catch (err) {
    st.textContent = 'OCR failed (' + err.message + '). You can still encode manually.';
    toast('OCR failed; encode manually instead.', 'error');
  }
}

function applyOcrGuesses(text) {
  const line = re => {
    const m = text.match(re);
    return m ? m[1].trim() : '';
  };
  const set = (id, val) => { if (val) el(id).value = val; };
  set('f-name',    line(/(?:full\s*)?name\s*[:\-]\s*([^\n]+)/i));
  set('f-contact', line(/contact\s*(?:no\.?|number|#)?\s*[:\-]\s*([\d\s+\-()]{7,})/i));
  set('f-address', line(/address\s*[:\-]\s*([^\n]+)/i));
  set('f-ecp',     line(/emergency\s*contact\s*(?:person)?\s*[:\-]\s*([^\n]+)/i));
  set('f-health',  line(/(?:health|medical)\s*(?:condition|notes?)\s*[:\-]\s*([^\n]+)/i));
  set('f-allergies', line(/allerg(?:y|ies)\s*[:\-]\s*([^\n]+)/i));
  const dob = text.match(/(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/);
  if (dob) el('f-dob').value = dob[1].replace(/\//g, '-');
}

async function saveClient() {
  const name = el('f-name').value.trim();
  if (!name) { toast('Full name is required.', 'error'); return; }
  const btn = el('save-client-btn');
  btn.disabled = true;

  const payload = {
    full_name: name,
    contact_number: el('f-contact').value.trim() || null,
    address: el('f-address').value.trim() || null,
    date_of_birth: el('f-dob').value || null,
    gender: el('f-gender').value || null,
    emergency_contact_person: el('f-ecp').value.trim() || null,
    emergency_contact_number: el('f-ecn').value.trim() || null,
    health_conditions: el('f-health').value.trim() || null,
    allergies: el('f-allergies').value.trim() || null,
    remarks: el('f-remarks').value.trim() || null,
    registered_at: el('f-regdate').value || todayISO(),
    created_by: session.user.id
  };

  const { data, error } = await sb.from('clients').insert(payload).select().single();
  if (error) {
    btn.disabled = false;
    if (error.code === '23505')
      toast('A client with this name and contact number already exists. Search for them instead.', 'error');
    else toast('Save failed: ' + error.message, 'error');
    return;
  }

  if (intakeImageFile) {
    const path = data.id + '/' + Date.now() + '-' + intakeImageFile.name.replace(/[^\w.\-]/g, '_');
    const up = await sb.storage.from('intake-forms').upload(path, intakeImageFile);
    if (!up.error) {
      await sb.from('clients').update({ intake_image_path: path }).eq('id', data.id);
    } else {
      toast('Client saved, but image upload failed: ' + up.error.message, 'error');
    }
  }

  intakeImageFile = null;
  toast('Client ' + data.client_code + ' registered: ' + data.full_name, 'success');
  location.hash = '#/client/' + data.id;
}

/* ---------------- client profile + service history ---------------- */
async function renderClientProfile(id) {
  const main = el('main');
  main.innerHTML = '<div class="spinner"></div>';
  const { data: c, error } = await sb.from('clients').select('*').eq('id', id).single();
  if (error) { toast('Client not found.', 'error'); location.hash = '#/clients'; return; }

  const { data: records } = await sb.from('service_records')
    .select('*, services(name), service_record_midwives(midwife_id, midwives(full_name, midwife_code))')
    .eq('client_id', id)
    .order('service_date', { ascending: false })
    .order('created_at', { ascending: false });

  const age = c.date_of_birth ? ageFrom(c.date_of_birth) + ' yrs' : '';
  const visits = (records || []).length;

  main.innerHTML = `
    <div class="page-head">
      <div>
        <h2>${esc(c.full_name)}</h2>
        <p><span class="pill code">${esc(c.client_code)}</span>
           Registered ${fmtDate(c.registered_at)} \u2022 ${visits} visit${visits === 1 ? '' : 's'}</p>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-ghost" onclick="openEditClient('${c.id}')">Edit Info</button>
        <button class="btn btn-accent" onclick="openServiceModalById('${c.id}')">\u2795 Add New Service</button>
      </div>
    </div>

    <div class="card" style="margin-bottom:18px">
      <h3 style="margin-bottom:14px">Client Information</h3>
      <div class="form-grid" style="font-size:14px">
        <div><strong>Client ID</strong><br><span class="pill code">${esc(c.client_code)}</span></div>
        <div><strong>Full Name</strong><br>${esc(c.full_name)}</div>
        <div><strong>Contact Number</strong><br>${esc(c.contact_number || '-')}</div>
        <div><strong>Date of Birth / Age</strong><br>${fmtDate(c.date_of_birth)}${age ? ' (' + age + ')' : ''}</div>
        <div><strong>Gender</strong><br>${esc(c.gender || '-')}</div>
        <div><strong>Address</strong><br>${esc(c.address || '-')}</div>
        <div><strong>Emergency Contact</strong><br>${esc(c.emergency_contact_person || '-')}
             ${c.emergency_contact_number ? ' \u2022 ' + esc(c.emergency_contact_number) : ''}</div>
        <div><strong>Registration Date</strong><br>${fmtDate(c.registered_at)}</div>
        <div class="full"><strong>Health Conditions / Medical Notes</strong><br>${esc(c.health_conditions || '-')}</div>
        <div class="full"><strong>Allergies &amp; Contraindications</strong><br>${esc(c.allergies || '-')}</div>
        ${c.remarks ? '<div class="full"><strong>Remarks</strong><br>' + esc(c.remarks) + '</div>' : ''}
      </div>
      ${c.intake_image_path ? `<div style="margin-top:14px"><button class="btn btn-ghost btn-sm"
        onclick="viewIntakeImage('${c.id}','${esc(c.intake_image_path)}')">\uD83D\uDCC4 View Uploaded Intake Form</button></div>` : ''}
    </div>

    <div class="card">
      <h3 style="margin-bottom:14px">Service History</h3>
      ${(records || []).length === 0
        ? '<p style="color:var(--muted)">No services recorded yet. Use "Add New Service" above.</p>'
        : records.map(r => {
            const mw = (r.service_record_midwives || [])
              .map(j => esc(j.midwives ? j.midwives.full_name : '')).filter(Boolean).join(', ');
            return `
            <div class="svc-item">
              <div class="svc-head">
                <div><h4>${esc(r.services ? r.services.name : 'Service')}</h4>
                  <div class="svc-meta">${fmtDate(r.service_date)}
                    ${r.duration_minutes ? ' \u2022 ' + r.duration_minutes + ' min' : ''}
                    ${r.description ? ' \u2022 ' + esc(r.description) : ''}</div>
                </div>
                <div style="text-align:right">
                  <div style="font-weight:600">${peso(r.price)}</div>
                  <span class="pill ${r.payment_status.toLowerCase()}">${r.payment_status}</span>
                </div>
              </div>
              <div class="svc-midwives">Midwife(s): <strong>${mw || '-'}</strong></div>
              ${r.feedback ? '<div class="svc-meta" style="margin-top:4px">Feedback: ' + esc(r.feedback) + '</div>' : ''}
              ${r.notes ? '<div class="svc-meta" style="margin-top:4px">Notes: ' + esc(r.notes) + '</div>' : ''}
              <div style="margin-top:8px"><button class="btn btn-ghost btn-sm"
                onclick="openEditService('${r.id}')">Edit</button></div>
            </div>`;
          }).join('')}
    </div>`;
}

async function viewIntakeImage(clientId, path) {
  const { data, error } = await sb.storage.from('intake-forms').createSignedUrl(path, 120);
  if (error) { toast('Could not load image: ' + error.message, 'error'); return; }
  openModal('<h3>Uploaded Intake Form</h3><img src="' + data.signedUrl +
    '" style="width:100%;border-radius:10px"><div class="modal-foot">' +
    '<button class="btn btn-ghost" onclick="closeModal()">Close</button></div>');
}

/* Edit existing client info (admin, or staff for permitted fields) */
async function openEditClient(id) {
  const { data: c } = await sb.from('clients').select('*').eq('id', id).single();
  openModal(`
    <h3>Edit Client \u2014 ${esc(c.full_name)}</h3>
    <div class="form-grid">
      <div class="field"><label>Full Name *</label><input id="e-name" value="${esc(c.full_name)}"></div>
      <div class="field"><label>Contact Number</label><input id="e-contact" value="${esc(c.contact_number || '')}"></div>
      <div class="field"><label>Address</label><input id="e-address" value="${esc(c.address || '')}"></div>
      <div class="field"><label>Date of Birth</label><input id="e-dob" type="date" value="${c.date_of_birth || ''}"></div>
      <div class="field"><label>Gender</label>
        <select id="e-gender">
          ${['', 'Female', 'Male', 'Other'].map(g =>
            '<option value="' + g + '"' + (c.gender === g ? ' selected' : '') + '>' +
            (g || '\u2014') + '</option>').join('')}
        </select></div>
      <div class="field"><label>Emergency Contact Person</label><input id="e-ecp" value="${esc(c.emergency_contact_person || '')}"></div>
      <div class="field"><label>Emergency Contact Number</label><input id="e-ecn" value="${esc(c.emergency_contact_number || '')}"></div>
      <div class="field full"><label>Health Conditions / Medical Notes</label><textarea id="e-health">${esc(c.health_conditions || '')}</textarea></div>
      <div class="field full"><label>Allergies &amp; Contraindications</label><textarea id="e-allergies">${esc(c.allergies || '')}</textarea></div>
      <div class="field full"><label>Remarks</label><textarea id="e-remarks">${esc(c.remarks || '')}</textarea></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveEditClient('${c.id}')">Save Changes</button>
    </div>`);
}

async function saveEditClient(id) {
  const { error } = await sb.from('clients').update({
    full_name: el('e-name').value.trim(),
    contact_number: el('e-contact').value.trim() || null,
    address: el('e-address').value.trim() || null,
    date_of_birth: el('e-dob').value || null,
    gender: el('e-gender').value || null,
    emergency_contact_person: el('e-ecp').value.trim() || null,
    emergency_contact_number: el('e-ecn').value.trim() || null,
    health_conditions: el('e-health').value.trim() || null,
    allergies: el('e-allergies').value.trim() || null,
    remarks: el('e-remarks').value.trim() || null
  }).eq('id', id);
  if (error) { toast('Update failed: ' + error.message, 'error'); return; }
  closeModal(); toast('Client updated.', 'success'); route();
}

/* ---------------- add / edit service (with multi-midwife) ---------------- */
async function openServiceModalById(clientId) {
  const { data: c } = await sb.from('clients').select('*').eq('id', clientId).single();
  if (c) openServiceModal(c);
}

async function openServiceModal(client, existing) {
  const [{ data: services }, { data: midwives }] = await Promise.all([
    sb.from('services').select('*').eq('active', true).order('name'),
    sb.from('midwives').select('*, midwife_specializations(service_id)')
      .eq('status', 'Active').order('full_name')
  ]);
  const specOf = m => new Set((m.midwife_specializations || []).map(s => s.service_id));
  const isEdit = !!existing;

  openModal(`
    <h3>${isEdit ? 'Edit Service' : 'Add New Service'} \u2014 ${esc(client.full_name)}
      <span class="pill code">${esc(client.client_code)}</span></h3>
    <div class="form-grid">
      <div class="field"><label>Service *</label>
        <select id="s-service">
          <option value="">\u2014 select service \u2014</option>
          ${(services || []).map(s =>
            '<option value="' + s.id + '" data-price="' + s.price + '" data-dur="' +
            (s.duration_minutes || '') + '"' +
            (isEdit && existing.service_id === s.id ? ' selected' : '') + '>' +
            esc(s.name) + ' \u2014 ' + peso(s.price) + '</option>').join('')}
        </select></div>
      <div class="field"><label>Service Date</label>
        <input id="s-date" type="date" value="${isEdit ? existing.service_date : todayISO()}"></div>
      <div class="field"><label>Duration (minutes)</label>
        <input id="s-dur" type="number" min="0" value="${isEdit ? (existing.duration_minutes || '') : ''}"></div>
      <div class="field"><label>Price (\u20B1)</label>
        <input id="s-price" type="number" min="0" step="0.01" value="${isEdit ? existing.price : ''}"></div>
      <div class="field"><label>Payment Status</label>
        <select id="s-pay">${['Unpaid', 'Paid', 'Partial'].map(p =>
          '<option' + (isEdit && existing.payment_status === p ? ' selected' : '') + '>' + p + '</option>').join('')}
        </select></div>
      <div class="field full"><label>Service Description</label>
        <textarea id="s-desc">${isEdit ? esc(existing.description || '') : ''}</textarea></div>

      <div class="field"><label>Midwife *</label>
        <select id="s-mw-0"><option value="">\u2014 select midwife \u2014</option></select></div>
      <div class="field" style="justify-content:flex-end">
        <label style="display:flex;gap:8px;align-items:center;font-size:13.5px;cursor:pointer">
          <input type="checkbox" id="s-add-mw"> Add Another Midwife
        </label>
      </div>
      <div id="s-extra-mw" class="full hidden" style="display:flex;flex-direction:column;gap:10px"></div>

      <div class="field full"><label>Client Feedback / Remarks</label>
        <textarea id="s-feedback">${isEdit ? esc(existing.feedback || '') : ''}</textarea></div>
      <div class="field full"><label>Additional Notes</label>
        <textarea id="s-notes">${isEdit ? esc(existing.notes || '') : ''}</textarea></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="s-save" onclick="saveService('${client.id}'${isEdit ? ', \'' + existing.id + '\'' : ''})">
        ${isEdit ? 'Save Changes' : '\uD83D\uDCBE Save Service'}</button>
    </div>`);

  const svcSel = el('s-service');
  const mwSel0 = el('s-mw-0');

  function fillMidwives() {
    const sid = svcSel.value;
    const opts = (midwives || []).map(m => {
      const ok = !sid || specOf(m).has(sid) || specOf(m).size === 0;
      return '<option value="' + m.id + '"' + (ok ? '' : ' disabled') + '>' +
        esc(m.full_name) + ' (' + esc(m.midwife_code) + ')' +
        (ok ? '' : ' \u2014 not specialized') + '</option>';
    }).join('');
    mwSel0.innerHTML = '<option value="">\u2014 select midwife \u2014</option>' + opts;
    el('s-extra-mw').innerHTML = '';
  }
  svcSel.addEventListener('change', () => {
    const o = svcSel.selectedOptions[0];
    if (o && o.dataset.price) el('s-price').value = o.dataset.price;
    if (o && o.dataset.dur) el('s-dur').value = o.dataset.dur;
    fillMidwives();
  });
  fillMidwives();

  el('s-add-mw').addEventListener('change', e => {
    const box = el('s-extra-mw');
    if (e.target.checked) {
      addExtraMidwifeRow(midwives, specOf);
      const addBtn = document.createElement('button');
      addBtn.className = 'btn btn-ghost btn-sm';
      addBtn.style.alignSelf = 'flex-start';
      addBtn.textContent = '\u2795 Add another midwife';
      addBtn.onclick = () => addExtraMidwifeRow(midwives, specOf);
      box.appendChild(addBtn);
    } else {
      box.innerHTML = '';
      box.classList.add('hidden');
    }
  });

  if (isEdit && existing.service_record_midwives) {
    const ids = existing.service_record_midwives.map(j => j.midwife_id);
    if (ids[0]) mwSel0.value = ids[0];
    if (ids.length > 1) {
      el('s-add-mw').checked = true;
      el('s-add-mw').dispatchEvent(new Event('change'));
      const sels = el('s-extra-mw').querySelectorAll('select');
      ids.slice(1).forEach((mid, i) => {
        if (sels[i]) sels[i].value = mid;
        else if (i >= sels.length) {
          addExtraMidwifeRow(midwives, specOf);
          const all = el('s-extra-mw').querySelectorAll('select');
          all[all.length - 1].value = mid;
        }
      });
    }
  }
}

function addExtraMidwifeRow(midwives, specOf) {
  const box = el('s-extra-mw');
  box.classList.remove('hidden');
  const sid = el('s-service').value;
  const row = document.createElement('div');
  row.style.display = 'flex'; row.style.gap = '10px'; row.style.alignItems = 'center';
  row.innerHTML = '<select style="flex:1"><option value="">\u2014 select midwife \u2014</option>' +
    (midwives || []).map(m => {
      const ok = !sid || specOf(m).has(sid) || specOf(m).size === 0;
      return '<option value="' + m.id + '"' + (ok ? '' : ' disabled') + '>' +
        esc(m.full_name) + ' (' + esc(m.midwife_code) + ')' + (ok ? '' : ' \u2014 not specialized') + '</option>';
    }).join('') + '</select>' +
    '<button class="btn btn-ghost btn-sm" title="Remove">\u2716</button>';
  row.querySelector('button').onclick = () => row.remove();
  box.insertBefore(row, box.lastElementChild && box.lastElementChild.tagName === 'BUTTON'
    ? box.lastElementChild : null);
}

async function saveService(clientId, recordId) {
  const serviceId = el('s-service').value;
  const mw0 = el('s-mw-0').value;
  if (!serviceId) { toast('Please select a service.', 'error'); return; }
  if (!mw0) { toast('Please assign at least one midwife.', 'error'); return; }

  const extraIds = [...el('s-extra-mw').querySelectorAll('select')]
    .map(s => s.value).filter(Boolean);
  const midwifeIds = [...new Set([mw0, ...extraIds])];

  const payload = {
    client_id: clientId,
    service_id: serviceId,
    service_date: el('s-date').value || todayISO(),
    description: el('s-desc').value.trim() || null,
    duration_minutes: parseInt(el('s-dur').value) || null,
    price: parseFloat(el('s-price').value) || 0,
    payment_status: el('s-pay').value,
    feedback: el('s-feedback').value.trim() || null,
    notes: el('s-notes').value.trim() || null
  };

  let recId = recordId;
  if (recId) {
    const { error } = await sb.from('service_records').update(payload).eq('id', recId);
    if (error) { toast('Update failed: ' + error.message, 'error'); return; }
    await sb.from('service_record_midwives').delete().eq('service_record_id', recId);
  } else {
    const { data, error } = await sb.from('service_records')
      .insert({ ...payload, created_by: session.user.id }).select().single();
    if (error) { toast('Save failed: ' + error.message, 'error'); return; }
    recId = data.id;
  }

  const { error: jerr } = await sb.from('service_record_midwives')
    .insert(midwifeIds.map(m => ({ service_record_id: recId, midwife_id: m })));
  if (jerr) { toast('Service saved, but midwife assignment failed: ' + jerr.message, 'error'); }

  closeModal();
  toast(recordId ? 'Service updated.' : 'New service added to client record.', 'success');
  route();
}

async function openEditService(recordId) {
  const { data: r } = await sb.from('service_records')
    .select('*, service_record_midwives(midwife_id)')
    .eq('id', recordId).single();
  const { data: c } = await sb.from('clients').select('*').eq('id', r.client_id).single();
  openServiceModal(c, r);
}

/* ---------------- midwives module (admin managed) ---------------- */
async function renderMidwives() {
  const main = el('main');
  main.innerHTML = '<div class="spinner"></div>';
  const { data: midwives } = await sb.from('midwives')
    .select('*, midwife_specializations(service_id, services(name))')
    .order('full_name');
  const { data: services } = await sb.from('services').select('id, name')
    .eq('active', true).order('name');

  const isAdmin = myProfile.role === 'admin';
  main.innerHTML = `
    <div class="page-head">
      <div><h2>Midwives</h2><p>Register midwives and set their service specializations.</p></div>
      ${isAdmin ? '<button class="btn btn-accent" onclick="openMidwifeForm()">\u2795 Register Midwife</button>' : ''}
    </div>
    <div class="card">
      ${(midwives || []).length === 0 ? '<p style="color:var(--muted)">No midwives registered yet.</p>' : `
      <table><thead><tr><th>ID</th><th>Full Name</th><th>Contact</th><th>Status</th><th>Specializations</th>${isAdmin ? '<th></th>' : ''}</tr></thead>
      <tbody>${midwives.map(m => `
        <tr>
          <td><span class="pill code">${esc(m.midwife_code)}</span></td>
          <td>${esc(m.full_name)}</td>
          <td>${esc(m.contact_number || '-')}</td>
          <td><span class="pill ${m.status.toLowerCase()}">${m.status}</span></td>
          <td>${(m.midwife_specializations || []).map(s => esc(s.services ? s.services.name : '')).filter(Boolean).join(', ') || '-'}</td>
          ${isAdmin ? `<td style="white-space:nowrap">
            <button class="btn btn-ghost btn-sm" onclick="openMidwifeForm('${m.id}')">Edit</button>
            <button class="btn btn-soft btn-sm" onclick="toggleMidwifeStatus('${m.id}','${m.status}')">
              ${m.status === 'Active' ? 'Deactivate' : 'Activate'}</button>
          </td>` : ''}
        </tr>`).join('')}</tbody></table>`}
    </div>`;
}

async function openMidwifeForm(id) {
  const { data: services } = await sb.from('services').select('id, name')
    .eq('active', true).order('name');
  let m = { full_name: '', contact_number: '', status: 'Active', notes: '', midwife_specializations: [] };
  if (id) {
    const { data } = await sb.from('midwives')
      .select('*, midwife_specializations(service_id)').eq('id', id).single();
    m = data;
  }
  const current = new Set((m.midwife_specializations || []).map(s => s.service_id));
  openModal(`
    <h3>${id ? 'Edit' : 'Register'} Midwife</h3>
    <div class="form-grid">
      <div class="field"><label>Full Name *</label><input id="m-name" value="${esc(m.full_name)}"></div>
      <div class="field"><label>Contact Number</label><input id="m-contact" value="${esc(m.contact_number || '')}"></div>
      <div class="field"><label>Employment Status</label>
        <select id="m-status">${['Active', 'Inactive'].map(s =>
          '<option' + (m.status === s ? ' selected' : '') + '>' + s + '</option>').join('')}</select></div>
      <div class="field full"><label>Additional Notes</label><textarea id="m-notes">${esc(m.notes || '')}</textarea></div>
      <div class="field full"><label>Service Specializations</label>
        <div style="display:flex;flex-wrap:wrap;gap:10px">
          ${(services || []).map(s =>
            '<label style="display:flex;gap:6px;align-items:center;font-size:13.5px">' +
            '<input type="checkbox" class="m-spec" value="' + s.id + '"' +
            (current.has(s.id) ? ' checked' : '') + '> ' + esc(s.name) + '</label>').join('') || '<span style="color:var(--muted)">No services in catalog yet.</span>'}
        </div></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveMidwife('${id || ''}')">\uD83D\uDCBE Save Midwife</button>
    </div>`);
}

async function saveMidwife(id) {
  const name = el('m-name').value.trim();
  if (!name) { toast('Full name is required.', 'error'); return; }
  const payload = {
    full_name: name,
    contact_number: el('m-contact').value.trim() || null,
    status: el('m-status').value,
    notes: el('m-notes').value.trim() || null
  };
  let mid = id;
  if (id) {
    const { error } = await sb.from('midwives').update(payload).eq('id', id);
    if (error) { toast('Save failed: ' + error.message, 'error'); return; }
  } else {
    const { data, error } = await sb.from('midwives').insert(payload).select().single();
    if (error) { toast('Save failed: ' + error.message, 'error'); return; }
    mid = data.id;
  }
  await sb.from('midwife_specializations').delete().eq('midwife_id', mid);
  const specs = [...document.querySelectorAll('.m-spec:checked')].map(c => c.value);
  if (specs.length)
    await sb.from('midwife_specializations')
      .insert(specs.map(sid => ({ midwife_id: mid, service_id: sid })));
  closeModal(); toast('Midwife saved.', 'success'); renderMidwives();
}

async function toggleMidwifeStatus(id, status) {
  const { error } = await sb.from('midwives')
    .update({ status: status === 'Active' ? 'Inactive' : 'Active' }).eq('id', id);
  if (error) toast('Update failed: ' + error.message, 'error');
  else { toast('Midwife status updated.', 'success'); renderMidwives(); }
}

/* ---------------- services catalog (admin managed) ---------------- */
async function renderServices() {
  const main = el('main');
  main.innerHTML = '<div class="spinner"></div>';
  const { data: services } = await sb.from('services').order('name');
  const isAdmin = myProfile.role === 'admin';
  main.innerHTML = `
    <div class="page-head">
      <div><h2>Services</h2><p>The service list appears in every service registration dropdown.</p></div>
      ${isAdmin ? '<button class="btn btn-accent" onclick="openServiceForm()">\u2795 Add Service</button>' : ''}
    </div>
    <div class="card">
      ${(services || []).length === 0 ? '<p style="color:var(--muted)">No services defined yet.</p>' : `
      <table><thead><tr><th>Service</th><th>Description</th><th>Duration</th><th>Price</th><th>Status</th>${isAdmin ? '<th></th>' : ''}</tr></thead>
      <tbody>${services.map(s => `
        <tr>
          <td><strong>${esc(s.name)}</strong></td>
          <td>${esc(s.description || '-')}</td>
          <td>${s.duration_minutes ? s.duration_minutes + ' min' : '-'}</td>
          <td>${peso(s.price)}</td>
          <td><span class="pill ${s.active ? 'active' : 'inactive'}">${s.active ? 'Active' : 'Inactive'}</span></td>
          ${isAdmin ? `<td style="white-space:nowrap">
            <button class="btn btn-ghost btn-sm" onclick="openServiceForm('${s.id}')">Edit</button>
            <button class="btn btn-soft btn-sm" onclick="toggleServiceActive('${s.id}',${s.active})">
              ${s.active ? 'Deactivate' : 'Activate'}</button>
          </td>` : ''}
        </tr>`).join('')}</tbody></table>`}
    </div>`;
}

async function openServiceForm(id) {
  let s = { name: '', description: '', duration_minutes: '', price: 0, active: true };
  if (id) {
    const { data } = await sb.from('services').select('*').eq('id', id).single();
    s = data;
  }
  openModal(`
    <h3>${id ? 'Edit' : 'Add'} Service</h3>
    <div class="form-grid">
      <div class="field"><label>Service Name *</label><input id="sv-name" value="${esc(s.name)}"></div>
      <div class="field"><label>Price (\u20B1) *</label><input id="sv-price" type="number" min="0" step="0.01" value="${s.price}"></div>
      <div class="field"><label>Duration (minutes)</label><input id="sv-dur" type="number" min="0" value="${s.duration_minutes || ''}"></div>
      <div class="field full"><label>Description</label><textarea id="sv-desc">${esc(s.description || '')}</textarea></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveServiceCatalog('${id || ''}')">\uD83D\uDCBE Save Service</button>
    </div>`);
}

async function saveServiceCatalog(id) {
  const payload = {
    name: el('sv-name').value.trim(),
    price: parseFloat(el('sv-price').value) || 0,
    duration_minutes: parseInt(el('sv-dur').value) || null,
    description: el('sv-desc').value.trim() || null
  };
  if (!payload.name) { toast('Service name is required.', 'error'); return; }
  const q = id ? sb.from('services').update(payload).eq('id', id)
               : sb.from('services').insert(payload);
  const { error } = await q;
  if (error) { toast('Save failed: ' + error.message, 'error'); return; }
  closeModal(); toast('Service saved.', 'success'); renderServices();
}

async function toggleServiceActive(id, active) {
  const { error } = await sb.from('services').update({ active: !active }).eq('id', id);
  if (error) toast('Update failed: ' + error.message, 'error');
  else { toast('Service updated.', 'success'); renderServices(); }
}

/* ---------------- reports & export ---------------- */
let lastReport = null;

async function renderReports() {
  const main = el('main');
  const monthStart = todayISO().slice(0, 8) + '01';
  main.innerHTML = `
    <div class="page-head">
      <div><h2>Reports</h2><p>Filter by date range, export to Excel (CSV) or PDF (print).</p></div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div class="form-grid">
        <div class="field"><label>Report Type</label>
          <select id="r-type">
            <option value="daily">Daily Service Report</option>
            <option value="weekly">Weekly Service Report</option>
            <option value="monthly">Monthly Service Report</option>
            <option value="visits">Client Visit History</option>
            <option value="midwife">Midwife Service Records</option>
            <option value="popular">Most Requested Services</option>
            <option value="registrations">Client Registration Report</option>
          </select></div>
        <div class="field"><label>From Date</label><input id="r-from" type="date" value="${monthStart}"></div>
        <div class="field"><label>To Date</label><input id="r-to" type="date" value="${todayISO()}"></div>
        <div class="field" style="justify-content:flex-end">
          <button class="btn btn-primary" onclick="runReport()">\uD83D\uDD0D Generate Report</button>
        </div>
      </div>
    </div>
    <div id="r-results"></div>`;
}

async function runReport() {
  const type = el('r-type').value;
  const from = el('r-from').value, to = el('r-to').value;
  const box = el('r-results');
  box.innerHTML = '<div class="spinner"></div>';

  let title = '', columns = [], rows = [];

  if (type === 'registrations') {
    title = 'Client Registration Report (' + fmtDate(from) + ' \u2013 ' + fmtDate(to) + ')';
    columns = ['Client ID', 'Full Name', 'Contact', 'Address', 'Registered'];
    const { data } = await sb.from('clients').select('*')
      .gte('registered_at', from).lte('registered_at', to).order('registered_at');
    rows = (data || []).map(c =>
      [c.client_code, c.full_name, c.contact_number || '', c.address || '', fmtDate(c.registered_at)]);
  } else if (type === 'popular') {
    title = 'Most Requested Services (' + fmtDate(from) + ' \u2013 ' + fmtDate(to) + ')';
    columns = ['Service', 'Times Performed', 'Total Revenue'];
    const { data } = await sb.from('service_records')
      .select('price, services(name)').gte('service_date', from).lte('service_date', to);
    const agg = {};
    (data || []).forEach(r => {
      const n = r.services ? r.services.name : 'Unknown';
      agg[n] = agg[n] || { count: 0, total: 0 };
      agg[n].count++; agg[n].total += Number(r.price);
    });
    rows = Object.entries(agg).sort((a, b) => b[1].count - a[1].count)
      .map(([n, v]) => [n, v.count, peso(v.total)]);
  } else if (type === 'midwife') {
    title = 'Midwife Service Records (' + fmtDate(from) + ' \u2013 ' + fmtDate(to) + ')';
    columns = ['Midwife ID', 'Midwife', 'Services Performed'];
    const { data } = await sb.from('service_records')
      .select('service_record_midwives(midwife_id, midwives(full_name, midwife_code))')
      .gte('service_date', from).lte('service_date', to);
    const agg = {};
    (data || []).forEach(r => (r.service_record_midwives || []).forEach(j => {
      if (!j.midwives) return;
      const k = j.midwives.midwife_code;
      agg[k] = agg[k] || { name: j.midwives.full_name, count: 0 };
      agg[k].count++;
    }));
    rows = Object.entries(agg).map(([k, v]) => [k, v.name, v.count]);
  } else {
    const labels = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', visits: 'Client Visit' };
    title = labels[type] + ' Service Report (' + fmtDate(from) + ' \u2013 ' + fmtDate(to) + ')';
    columns = ['Date', 'Client', 'Client ID', 'Service', 'Midwife(s)', 'Duration', 'Price', 'Payment', 'Feedback'];
    const { data } = await sb.from('service_records')
      .select('*, clients(full_name, client_code), services(name), service_record_midwives(midwives(full_name))')
      .gte('service_date', from).lte('service_date', to)
      .order('service_date', { ascending: false });
    rows = (data || []).map(r => [
      fmtDate(r.service_date),
      r.clients ? r.clients.full_name : '',
      r.clients ? r.clients.client_code : '',
      r.services ? r.services.name : '',
      (r.service_record_midwives || []).map(j => j.midwives ? j.midwives.full_name : '').filter(Boolean).join(', '),
      r.duration_minutes ? r.duration_minutes + ' min' : '',
      peso(r.price), r.payment_status, r.feedback || ''
    ]);
  }

  lastReport = { title, columns, rows };
  box.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:14px">
        <h3 style="margin:0">${esc(title)}</h3>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost btn-sm" onclick="exportCSV()">\u2B07 Export Excel (CSV)</button>
          <button class="btn btn-ghost btn-sm" onclick="printReport()">\uD83D\uDDA8\uFE0F Print / PDF</button>
        </div>
      </div>
      ${rows.length === 0 ? '<p style="color:var(--muted)">No records in this date range.</p>' : `
      <div style="overflow-x:auto"><table><thead><tr>${columns.map(c => '<th>' + esc(c) + '</th>').join('')}</tr></thead>
      <tbody>${rows.map(r => '<tr>' + r.map(c => '<td>' + esc(c) + '</td>').join('') + '</tr>').join('')}</tbody></table></div>`}
    </div>`;
}

function exportCSV() {
  if (!lastReport) return;
  const csv = [lastReport.columns, ...lastReport.rows]
    .map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(','))
    .join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'imago-dei-report-' + todayISO() + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('CSV downloaded \u2014 opens in Excel.', 'success');
}

function printReport() {
  if (!lastReport) return;
  el('print-area').innerHTML = `
    <h2>Imago Dei Health &amp; Birth Center</h2>
    <p>${esc(lastReport.title)} \u2014 generated ${new Date().toLocaleString('en-PH')}</p>
    <table border="1" cellspacing="0" cellpadding="5">
      <thead><tr>${lastReport.columns.map(c => '<th>' + esc(c) + '</th>').join('')}</tr></thead>
      <tbody>${lastReport.rows.map(r => '<tr>' + r.map(c => '<td>' + esc(c) + '</td>').join('') + '</tr>').join('')}</tbody>
    </table>`;
  window.print();
}

/* ---------------- boot ---------------- */
document.addEventListener('DOMContentLoaded', initAuth);
