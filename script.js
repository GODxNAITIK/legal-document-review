'use strict';
/* =====================================================
   LegalFlow – Legal Document Review Workflow
   Vanilla JS. Data is stored in localStorage.
   ===================================================== */

/* ---------- 1. CONSTANTS & STATE ---------- */
const KEYS = { docs: 'lf_docs', reviewers: 'lf_reviewers', theme: 'lf_theme', user: 'lf_user' };
const STATUSES = ['Pending', 'Under Review', 'Changes Requested', 'Completed'];
const PRIORITIES = ['High', 'Medium', 'Low'];
const TYPES = ['Contract', 'NDA', 'Agreement', 'Lease', 'Other'];
const PROGRESS = { 'Pending': 25, 'Under Review': 60, 'Changes Requested': 75, 'Completed': 100 };
const STEPS_DONE = { 'Pending': 2, 'Under Review': 3, 'Changes Requested': 4, 'Completed': 5 };
const STEPS = ['Document Uploaded', 'Reviewer Assigned', 'Initial Review', 'Comments Added', 'Final Approval'];
const PRI_ORDER = { High: 0, Medium: 1, Low: 2 };
const TITLES = { dashboard: 'Dashboard', documents: 'All Documents', pending: 'Pending Reviews', completed: 'Completed', reviewers: 'Reviewers', reports: 'Reports', settings: 'Settings' };
const DOC_VIEWS = ['documents', 'pending', 'completed'];

let docs = [], reviewers = [], user = 'Admin User', currentId = null;
let ui = { view: 'dashboard', q: '', status: 'All', priority: 'All', reviewer: 'All', type: 'All', sort: 'updated', dir: 'desc' };

/* ---------- 2. HELPER FUNCTIONS ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const isoDate = (offset = 0) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); };
const stamp = (offset = 0) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString(); };
const fmt = d => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtTime = d => new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const initials = n => n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
const slug = s => s.toLowerCase().replace(/\s+/g, '-');
const overdue = d => d.status !== 'Completed' && d.due < isoDate();
const getDoc = id => docs.find(d => d.id === id);

// Save everything to localStorage
function save() {
  localStorage.setItem(KEYS.docs, JSON.stringify(docs));
  localStorage.setItem(KEYS.reviewers, JSON.stringify(reviewers));
}
// Add an entry to a document's history (newest first) and refresh "last updated"
function log(doc, text) {
  doc.history.unshift({ time: new Date().toISOString(), text });
  doc.updated = new Date().toISOString();
}
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = (type === 'success' ? '✓ ' : '⚠ ') + msg;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), 3000);
}
const statusBadge = s => `<span class="badge st-${slug(s)}">${s}</span>`;
const priBadge = p => `<span class="badge pr-${p.toLowerCase()}">${{ High: '🔴', Medium: '🟡', Low: '🟢' }[p]} ${p}</span>`;
const options = (arr, sel) => arr.map(o => `<option ${o === sel ? 'selected' : ''}>${esc(o)}</option>`).join('');

/* ---------- 3. DATA: SEED, LOAD ---------- */
function seed() {
  reviewers = [
    { id: 'r1', name: 'Rahul Sharma', email: 'rahul.sharma@legalflow.com' },
    { id: 'r2', name: 'Priya Singh', email: 'priya.singh@legalflow.com' },
    { id: 'r3', name: 'Amit Verma', email: 'amit.verma@legalflow.com' },
    { id: 'r4', name: 'Neha Kapoor', email: 'neha.kapoor@legalflow.com' }
  ];
  // name, client, type, reviewer, priority, status, due (days from today), tags
  const rows = [
    ['Employment Contract', 'ABC Technologies', 'Contract', 'Rahul Sharma', 'High', 'Under Review', 3, ['Contract', 'Important']],
    ['Non-Disclosure Agreement', 'XYZ Solutions', 'NDA', 'Priya Singh', 'Medium', 'Pending', 7, ['NDA', 'Client-A']],
    ['Partnership Agreement', 'Nova Enterprises', 'Agreement', 'Amit Verma', 'High', 'Changes Requested', 2, ['Partnership', 'Urgent']],
    ['Service Agreement', 'TechNova Ltd', 'Agreement', 'Neha Kapoor', 'Low', 'Completed', -2, ['Service']],
    ['Lease Agreement', 'Greenfield Properties', 'Lease', 'Rahul Sharma', 'Medium', 'Under Review', 10, ['Lease', 'Property']],
    ['Vendor Contract', 'Orbit Supplies', 'Contract', 'Priya Singh', 'High', 'Pending', 1, ['Vendor', 'Important']],
    ['Consulting Agreement', 'BlueSky Consulting', 'Agreement', 'Amit Verma', 'Low', 'Completed', -5, ['Consulting']],
    ['Mutual NDA', 'Helix Labs', 'NDA', 'Neha Kapoor', 'Medium', 'Completed', -1, ['NDA', 'Confidential']],
    ['Software License', 'CloudNine Pvt Ltd', 'Other', 'Rahul Sharma', 'Medium', 'Changes Requested', 5, ['License']],
    ['Office Sublease', 'Urban Spaces', 'Lease', 'Priya Singh', 'Low', 'Pending', 14, ['Lease']]
  ];
  docs = rows.map(([name, client, type, reviewer, priority, status, due, tags], i) => ({
    id: 'DOC-' + (1001 + i), name, client, type, reviewer, priority, status, due: isoDate(due), tags,
    description: `Review of the ${name.toLowerCase()} for ${client}.`,
    comments: [{ id: uid(), author: reviewer, text: 'Please verify Clause 7 before final approval.', time: stamp(-1) }],
    history: [
      { time: stamp(-1), text: `Status set to ${status}` },
      { time: stamp(-2), text: `${reviewer} assigned as reviewer` },
      { time: stamp(-3 - i), text: 'Document uploaded' }
    ],
    created: stamp(-3 - i), updated: stamp(-i % 4)
  }));
}
function load() {
  try {
    docs = JSON.parse(localStorage.getItem(KEYS.docs));
    reviewers = JSON.parse(localStorage.getItem(KEYS.reviewers));
  } catch (e) { docs = null; }
  if (!Array.isArray(docs) || !Array.isArray(reviewers)) { seed(); save(); } // first launch
  user = localStorage.getItem(KEYS.user) || user;
  setTheme(localStorage.getItem(KEYS.theme) || 'light');
}

/* ---------- 4. THEME & USER ---------- */
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  localStorage.setItem(KEYS.theme, t);
  $('#themeBtn').textContent = t === 'dark' ? '☀️' : '🌙';
}
const toggleTheme = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
function updateUser() { $('#userName').textContent = user; $('#userAvatar').textContent = initials(user); }

/* ---------- 5. FILTER + SORT LOGIC ---------- */
function filtered() {
  const q = ui.q.trim().toLowerCase();
  const list = docs.filter(d => {
    if (ui.view === 'pending' && d.status === 'Completed') return false;
    if (ui.view === 'completed' && d.status !== 'Completed') return false;
    if (ui.status !== 'All' && d.status !== ui.status) return false;
    if (ui.priority !== 'All' && d.priority !== ui.priority) return false;
    if (ui.reviewer !== 'All' && d.reviewer !== ui.reviewer) return false;
    if (ui.type !== 'All' && d.type !== ui.type) return false;
    if (q && ![d.name, d.client, d.reviewer, d.type, ...d.tags].some(v => v.toLowerCase().includes(q))) return false;
    return true;
  });
  const keys = { name: d => d.name.toLowerCase(), due: d => d.due, priority: d => PRI_ORDER[d.priority], status: d => STATUSES.indexOf(d.status), updated: d => d.updated };
  const key = keys[ui.sort], dir = ui.dir === 'asc' ? 1 : -1;
  return list.sort((a, b) => (key(a) > key(b) ? 1 : key(a) < key(b) ? -1 : 0) * dir);
}

/* ---------- 6. VIEW BUILDERS (return HTML strings) ---------- */
function stats() {
  const n = s => docs.filter(d => d.status === s).length;
  return { total: docs.length, pending: n('Pending'), review: n('Under Review'), done: n('Completed'), high: docs.filter(d => d.priority === 'High' && d.status !== 'Completed').length };
}
function statCards() {
  const s = stats();
  const c = [['Total Documents', s.total, 'total'], ['Pending Review', s.pending, 'pending'], ['Under Review', s.review, 'under-review'], ['Completed', s.done, 'completed'], ['High Priority', s.high, 'high']];
  return `<div class="cards">${c.map(([l, n, k]) => `<div class="card stat ${k}"><span>${l}</span><strong>${n}</strong></div>`).join('')}</div>`;
}
const bars = (title, rows) => {
  const max = Math.max(1, ...rows.map(r => r[1]));
  return `<div class="panel"><h3>${title}</h3>${rows.map(([l, n, c]) => `<div class="bar-row"><span>${esc(l)}</span><div class="bar"><i class="${c || ''}" style="width:${n / max * 100}%"></i></div><b>${n}</b></div>`).join('')}</div>`;
};
const countBy = (arr, key) => arr.map(v => [v, docs.filter(d => d[key] === v).length, slug(v)]);

function rowsHtml(list) {
  if (!list.length) return `<tr><td colspan="9" class="empty">📄 No documents match your search or filters.</td></tr>`;
  return list.map(d => `<tr>
    <td><b>${esc(d.name)}</b><small>${d.id}</small></td><td>${esc(d.client)}</td><td>${esc(d.type)}</td><td>${esc(d.reviewer)}</td>
    <td>${priBadge(d.priority)}</td><td>${statusBadge(d.status)}</td>
    <td class="${overdue(d) ? 'overdue' : ''}" ${overdue(d) ? 'title="Overdue"' : ''}>${fmt(d.due)}</td><td>${fmt(d.updated)}</td>
    <td class="actions">
      <button class="btn sm" data-act="view" data-id="${d.id}" title="View details">View</button>
      <button class="btn sm" data-act="edit" data-id="${d.id}" title="Edit document">Edit</button>
      <button class="btn sm danger" data-act="delete" data-id="${d.id}" title="Delete document">Delete</button>
    </td></tr>`).join('');
}
const tableHtml = body => `<div class="table-wrap"><table><thead><tr><th>Document Name</th><th>Client</th><th>Type</th><th>Reviewer</th><th>Priority</th><th>Status</th><th>Due Date</th><th>Last Updated</th><th>Actions</th></tr></thead><tbody id="tbody">${body}</tbody></table></div>`;

function viewDashboard() {
  const recent = docs.slice().sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, 5);
  return statCards() + `<div class="panel"><h3>Recently Updated Documents</h3>${tableHtml(rowsHtml(recent))}</div>
    <div class="two">${bars('Documents by Status', countBy(STATUSES, 'status'))}${bars('Documents by Priority', countBy(PRIORITIES, 'priority'))}</div>`;
}
function viewDocs() {
  const sel = (id, label, arr, val) => `<label class="f"><span>${label}</span><select id="${id}"><option>All</option>${options(arr, val)}</select></label>`;
  const sorts = [['name', 'Document Name'], ['due', 'Due Date'], ['priority', 'Priority'], ['status', 'Status'], ['updated', 'Last Updated']];
  return `<div class="toolbar"><div class="filters">
    ${sel('fStatus', 'Status', STATUSES, ui.status)}${sel('fPriority', 'Priority', PRIORITIES, ui.priority)}
    ${sel('fReviewer', 'Reviewer', reviewers.map(r => r.name), ui.reviewer)}${sel('fType', 'Type', TYPES, ui.type)}
    <label class="f"><span>Sort by</span><select id="fSort">${sorts.map(([v, l]) => `<option value="${v}" ${v === ui.sort ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <button class="btn" id="dirBtn" title="Toggle ascending / descending">${ui.dir === 'asc' ? '⬆ Ascending' : '⬇ Descending'}</button>
    <button class="btn" id="clearBtn" title="Reset filters">Clear</button></div>
    <button class="btn primary" data-act="add">+ Add Document</button></div>${tableHtml(rowsHtml(filtered()))}`;
}
// Reviewer workload is calculated from the documents (never hard-coded)
function reviewerStats(r) {
  const mine = docs.filter(d => d.reviewer === r.name), done = mine.filter(d => d.status === 'Completed').length;
  return { assigned: mine.length, done, pending: mine.length - done, pct: mine.length ? Math.round(done / mine.length * 100) : 0 };
}
function viewReviewers() {
  return `<div class="panel"><h3>Add Reviewer</h3><form id="revForm" class="inline-form"><label class="sr" for="rName">Name</label><input id="rName" placeholder="Full name" required><label class="sr" for="rEmail">Email</label><input id="rEmail" type="email" placeholder="Email address" required><button class="btn primary">Add</button></form></div>
  <div class="cards">${reviewers.map(r => { const s = reviewerStats(r); return `<div class="card reviewer"><span class="avatar lg">${initials(r.name)}</span><h3>${esc(r.name)}</h3><p>${esc(r.email)}</p>
    <div class="mini"><span><b>${s.assigned}</b>Assigned</span><span><b>${s.done}</b>Completed</span><span><b>${s.pending}</b>Pending</span></div>
    <div class="progress"><i style="width:${s.pct}%"></i></div><small>Progress: ${s.pct}%</small></div>`; }).join('')}</div>`;
}
function viewReports() {
  return statCards() + `<div class="two">${bars('Documents by Status', countBy(STATUSES, 'status'))}${bars('Documents by Priority', countBy(PRIORITIES, 'priority'))}
    ${bars('Reviewer Workload', reviewers.map(r => [r.name, docs.filter(d => d.reviewer === r.name).length, '']))}</div>`;
}
function viewSettings() {
  return `<div class="panel narrow"><h3>Profile</h3><form id="setForm" class="stack"><label for="uName">Your name (used for comments and history)</label><input id="uName" value="${esc(user)}" required><button class="btn primary">Save</button></form></div>
  <div class="panel narrow"><h3>Appearance & Data</h3><div class="row"><button class="btn" data-act="theme">Toggle dark / light mode</button><button class="btn danger" data-act="reset">Reset demo data</button></div></div>`;
}
const VIEWS = { dashboard: viewDashboard, documents: viewDocs, pending: viewDocs, completed: viewDocs, reviewers: viewReviewers, reports: viewReports, settings: viewSettings };

/* ---------- 7. RENDERING & NAVIGATION ---------- */
function render() {
  $('#pageTitle').textContent = TITLES[ui.view];
  document.querySelectorAll('#nav button').forEach(b => {
    const on = b.dataset.view === ui.view;
    b.classList.toggle('active', on);
    b.setAttribute('aria-current', on ? 'page' : 'false');
  });
  $('#view').innerHTML = VIEWS[ui.view]();
  $('#sidebar').classList.remove('open');
  renderNotifs();
}
const navigate = v => { ui.view = v; render(); };
const refreshTable = () => { const t = $('#tbody'); if (t && DOC_VIEWS.includes(ui.view)) t.innerHTML = rowsHtml(filtered()); };

/* ---------- 8. NOTIFICATIONS (generated from data) ---------- */
function renderNotifs() {
  const n = [], today = isoDate(), soon = docs.filter(d => d.status !== 'Completed' && d.due >= today && d.due <= isoDate(3)).length;
  if (soon) n.push(`${soon} document${soon > 1 ? 's are' : ' is'} due soon.`);
  const late = docs.filter(overdue).length;
  if (late) n.push(`${late} document${late > 1 ? 's are' : ' is'} overdue.`);
  const newest = docs.slice().sort((a, b) => b.created.localeCompare(a.created))[0];
  if (newest) n.push(`A new document "${newest.name}" has been assigned to ${newest.reviewer}.`);
  docs.filter(d => d.status === 'Changes Requested').slice(0, 3).forEach(d => n.push(`${d.name} requires changes.`));
  docs.filter(d => d.status === 'Completed').slice(0, 2).forEach(d => n.push(`${d.name} has been completed.`));
  $('#notifPanel').innerHTML = n.length ? n.map(t => `<p>${esc(t)}</p>`).join('') : '<p>No notifications.</p>';
  $('#notifCount').textContent = n.length || '';
}

/* ---------- 9. MODALS ---------- */
function openModal(html, wide = false) {
  $('#modalBox').className = 'modal' + (wide ? ' wide' : '');
  $('#modalBox').innerHTML = html;
  $('#modal').hidden = false;
}
function closeModal() { $('#modal').hidden = true; $('#modalBox').innerHTML = ''; currentId = null; }
const closeBtn = '<button type="button" class="icon-btn" data-act="close" aria-label="Close dialog">✕</button>';

// Add / Edit form
function openForm(id) {
  const d = getDoc(id) || { name: '', client: '', type: 'Contract', reviewer: reviewers[0].name, priority: 'Medium', status: 'Pending', due: isoDate(7), tags: [], description: '' };
  const fld = (i, label, ctl, full) => `<div class="fld ${full ? 'full' : ''}"><label for="${i}">${label}</label>${ctl}<small class="err" id="${i}Err"></small></div>`;
  const sel = (i, label, arr, val) => fld(i, label, `<select id="${i}">${options(arr, val)}</select>`);
  openModal(`<form id="docForm" data-id="${id || ''}" novalidate>
    <div class="modal-head"><h2>${id ? 'Edit' : 'Add'} Document</h2>${closeBtn}</div>
    <div class="grid2">
      ${fld('mName', 'Document Name *', `<input id="mName" value="${esc(d.name)}">`)}
      ${fld('mClient', 'Client Name *', `<input id="mClient" value="${esc(d.client)}">`)}
      ${sel('mType', 'Document Type', TYPES, d.type)}${sel('mReviewer', 'Reviewer', reviewers.map(r => r.name), d.reviewer)}
      ${sel('mPriority', 'Priority', PRIORITIES, d.priority)}${sel('mStatus', 'Status', STATUSES, d.status)}
      ${fld('mDue', 'Due Date *', `<input id="mDue" type="date" value="${d.due}">`)}
      ${fld('mTags', 'Tags (comma separated)', `<input id="mTags" value="${esc(d.tags.join(', '))}">`)}
      ${fld('mDesc', 'Description', `<textarea id="mDesc" rows="3">${esc(d.description)}</textarea>`, true)}
    </div>
    <div class="modal-foot"><button type="button" class="btn" data-act="close">Cancel</button><button class="btn primary">${id ? 'Save Changes' : 'Add Document'}</button></div></form>`);
  $('#mName').focus();
}
// Validate form, then create or update the document
function submitForm(form) {
  const v = i => $('#' + i, form).value.trim();
  let ok = true;
  [['mName', 'Document name is required.'], ['mClient', 'Client name is required.'], ['mDue', 'Due date is required.']].forEach(([i, msg]) => {
    const bad = !v(i); $('#' + i + 'Err', form).textContent = bad ? msg : ''; if (bad) ok = false;
  });
  if (!ok) return toast('Please fix the highlighted fields.', 'error');
  const data = { name: v('mName'), client: v('mClient'), type: v('mType'), reviewer: v('mReviewer'), priority: v('mPriority'), status: v('mStatus'), due: v('mDue'), description: v('mDesc'), tags: v('mTags').split(',').map(t => t.trim()).filter(Boolean) };
  const id = form.dataset.id;
  if (id) {
    const d = getDoc(id);
    if (d.status !== data.status) log(d, `Status changed from ${d.status} → ${data.status}`);
    if (d.reviewer !== data.reviewer) log(d, `${data.reviewer} assigned as reviewer`);
    if (d.priority !== data.priority) log(d, `Priority changed from ${d.priority} → ${data.priority}`);
    log(d, `Document details edited by ${user}`);
    Object.assign(d, data);
  } else {
    const now = new Date().toISOString(), next = Math.max(1000, ...docs.map(d => +d.id.slice(4))) + 1;
    docs.push({ id: 'DOC-' + next, ...data, comments: [], created: now, updated: now,
      history: [{ time: now, text: `${data.reviewer} assigned as reviewer` }, { time: now, text: `${user} uploaded the document` }] });
  }
  save(); closeModal(); render();
  toast(id ? 'Document updated successfully.' : 'Document successfully added.');
}
function confirmDelete(id) {
  openModal(`<div class="modal-head"><h2>Delete Document</h2>${closeBtn}</div><p>Are you sure you want to delete this document?</p>
    <div class="modal-foot"><button class="btn" data-act="close">Cancel</button><button class="btn danger" data-act="confirmdel" data-id="${id}">Delete</button></div>`);
}

// Detail / review panel – re-rendered after every change
function renderDetail() {
  const d = getDoc(currentId); if (!d) return closeModal();
  const pct = PROGRESS[d.status], done = STEPS_DONE[d.status];
  openModal(`<div class="modal-head"><div><h2>${esc(d.name)}</h2><small>${d.id}</small></div>${closeBtn}</div>
  <div class="detail-grid"><section>
    <h3>Document Information</h3>
    <dl class="info"><dt>Client</dt><dd>${esc(d.client)}</dd><dt>Type</dt><dd>${esc(d.type)}</dd><dt>Reviewer</dt><dd>${esc(d.reviewer)}</dd>
      <dt>Priority</dt><dd>${priBadge(d.priority)}</dd><dt>Status</dt><dd>${statusBadge(d.status)}</dd><dt>Due date</dt><dd>${fmt(d.due)}</dd>
      <dt>Created</dt><dd>${fmt(d.created)}</dd><dt>Updated</dt><dd>${fmtTime(d.updated)}</dd><dt>Notes</dt><dd>${esc(d.description) || '—'}</dd></dl>
    <div class="ctrls"><label>Status<select data-set="status">${options(STATUSES, d.status)}</select></label>
      <label>Priority<select data-set="priority">${options(PRIORITIES, d.priority)}</select></label>
      <label>Reviewer<select data-set="reviewer">${options(reviewers.map(r => r.name), d.reviewer)}</select></label></div>
    <h3>Tags</h3><div class="tags">${d.tags.map(t => `<span class="tag">${esc(t)}<button data-act="rmtag" data-tag="${esc(t)}" aria-label="Remove tag ${esc(t)}">×</button></span>`).join('') || '<small>No tags yet</small>'}</div>
    <form id="tagForm" class="inline-form"><label class="sr" for="newTag">New tag</label><input id="newTag" placeholder="Add a tag"><button class="btn sm">Add</button></form>
    <h3>Review Progress: ${pct}%</h3><div class="progress"><i style="width:${pct}%"></i></div>
    <ol class="steps">${STEPS.map((s, i) => `<li class="${i < done ? 'done' : ''}">${i < done ? '✓' : '○'} ${s}</li>`).join('')}</ol>
  </section><section>
    <h3>Comments (${d.comments.length})</h3>
    ${d.comments.map(c => `<div class="comment"><b>${esc(c.author)}</b><small>${fmtTime(c.time)}</small><p>${esc(c.text)}</p><button data-act="delcmt" data-cid="${c.id}">Delete</button></div>`).join('') || '<small>No comments yet.</small>'}
    <form id="cmtForm" class="stack"><label class="sr" for="cmtText">Comment</label><textarea id="cmtText" rows="2" placeholder="Write a comment…"></textarea><button class="btn primary sm">Add Comment</button></form>
    <h3>History</h3><ul class="timeline">${d.history.map(h => `<li><small>${fmtTime(h.time)}</small>${esc(h.text)}</li>`).join('')}</ul>
  </section></div>`, true);
}
// Change status / priority / reviewer from the detail panel
function changeField(field, value) {
  const d = getDoc(currentId);
  if (field === 'status') log(d, `Status changed from ${d.status} → ${value}`);
  if (field === 'priority') log(d, `Priority changed from ${d.priority} → ${value}`);
  if (field === 'reviewer') log(d, `${value} assigned as reviewer`);
  d[field] = value; save(); renderDetail(); render();
  toast(`${field[0].toUpperCase() + field.slice(1)} updated.`);
}
function addTag() {
  const d = getDoc(currentId), t = $('#newTag').value.trim();
  if (!t) return toast('Enter a tag first.', 'error');
  if (d.tags.some(x => x.toLowerCase() === t.toLowerCase())) return toast('Tag already exists.', 'error');
  d.tags.push(t); log(d, `Tag "${t}" added`); save(); renderDetail(); render(); toast('Tag added.');
}
function addComment() {
  const d = getDoc(currentId), text = $('#cmtText').value.trim();
  if (!text) return toast('Comment cannot be empty.', 'error');
  d.comments.push({ id: uid(), author: user, text, time: new Date().toISOString() });
  log(d, `Comment added by ${user}`); save(); renderDetail(); render(); toast('Comment added.');
}

/* ---------- 10. EVENT LISTENERS ---------- */
// Click actions use data-act attributes (event delegation)
document.addEventListener('click', e => {
  if (!e.target.closest('.notif-wrap')) $('#notifPanel').hidden = true;
  if (e.target === $('#modal')) return closeModal();
  const el = e.target.closest('[data-act]'); if (!el) return;
  const { act, id, tag, cid } = el.dataset;
  const actions = {
    add: () => openForm(), edit: () => openForm(id), view: () => { currentId = id; renderDetail(); },
    delete: () => confirmDelete(id), close: closeModal, theme: toggleTheme,
    confirmdel: () => { docs = docs.filter(d => d.id !== id); save(); closeModal(); render(); toast('Document deleted.'); },
    rmtag: () => { const d = getDoc(currentId); d.tags = d.tags.filter(t => t !== tag); log(d, `Tag "${tag}" removed`); save(); renderDetail(); render(); toast('Tag removed.'); },
    delcmt: () => { const d = getDoc(currentId); d.comments = d.comments.filter(c => c.id !== cid); log(d, 'Comment deleted'); save(); renderDetail(); render(); toast('Comment deleted.'); },
    reset: () => { if (confirm('Reset all data to the demo set?')) { seed(); save(); render(); toast('Demo data restored.'); } }
  };
  if (actions[act]) actions[act]();
});
document.addEventListener('submit', e => {
  e.preventDefault(); const f = e.target;
  if (f.id === 'docForm') submitForm(f);
  else if (f.id === 'tagForm') addTag();
  else if (f.id === 'cmtForm') addComment();
  else if (f.id === 'revForm') {
    const name = $('#rName').value.trim();
    if (reviewers.some(r => r.name.toLowerCase() === name.toLowerCase())) return toast('Reviewer already exists.', 'error');
    reviewers.push({ id: uid(), name, email: $('#rEmail').value.trim() }); save(); render(); toast('Reviewer added.');
  } else if (f.id === 'setForm') {
    user = $('#uName').value.trim() || user; localStorage.setItem(KEYS.user, user); updateUser(); toast('Settings saved.');
  }
});
// Filters, sorting, and detail-panel dropdowns
document.addEventListener('change', e => {
  const map = { fStatus: 'status', fPriority: 'priority', fReviewer: 'reviewer', fType: 'type', fSort: 'sort' }[e.target.id];
  if (map) { ui[map] = e.target.value; refreshTable(); }
  if (e.target.dataset.set) changeField(e.target.dataset.set, e.target.value);
});
document.addEventListener('click', e => {
  if (e.target.id === 'dirBtn') { ui.dir = ui.dir === 'asc' ? 'desc' : 'asc'; render(); }
  if (e.target.id === 'clearBtn') { Object.assign(ui, { q: '', status: 'All', priority: 'All', reviewer: 'All', type: 'All' }); $('#search').value = ''; render(); }
});
$('#nav').addEventListener('click', e => { const b = e.target.closest('button'); if (b) navigate(b.dataset.view); });
$('#search').addEventListener('input', e => { ui.q = e.target.value; DOC_VIEWS.includes(ui.view) ? refreshTable() : navigate('documents'); });
$('#themeBtn').addEventListener('click', toggleTheme);
$('#menuBtn').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
$('#notifBtn').addEventListener('click', () => { $('#notifPanel').hidden = !$('#notifPanel').hidden; });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); $('#notifPanel').hidden = true; } });

/* ---------- 11. START ---------- */
load();
updateUser();
$('#view').innerHTML = '<div class="loader" role="status" aria-label="Loading"></div>';
setTimeout(render, 400); // short loading animation