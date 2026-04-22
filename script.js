/* =============================================
   URBAN ANALYTICS MEXICO — script.js v3
   ============================================= */
'use strict';

const CONFIG = {
  TARGET: 380000,
  WEBHOOK_URL: '',
  TOKEN: 'UA-MX-2026-SEC',
  MAX_HISTORY: 20,
  STORAGE_KEY: 'ua_mx_dashboard_v3',
  HISTORY_KEY: 'ua_mx_history_v3',
};

const MEMBERS = ['Octavio', 'Roberto', 'Noé'];
const TOPICS  = ['AI', 'Demand Modeling', 'BigData', 'Urban Analytics', 'Financial Modeling', 'Transport', 'Other'];
const MOTIVES = ['Price', 'Technical', 'Price/Technical', 'Deadline', 'Corruption', 'Lack of Funds', 'Political Environment', 'Client Stepback', 'Administrative Issues', 'Decided not to go', 'Others'];
const MONTHS  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const DEFAULT_BILLABLE = { Octavio: 65, Roberto: 75, 'Noé': 85 };
const HOURS_PER_MONTH  = 160;

let isLoading = false;
let currentUtilMonth = new Date().getMonth();
let currentUtilYear  = new Date().getFullYear();
let utilData = {};
let billableTargets = { ...DEFAULT_BILLABLE };

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  initUtilizationControls();
  loadFromStorage();
  updateProgress();
  calcScore();
  setTimeout(() => { isLoading = false; }, 300);
});

// ===== TABS =====
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'utilization') { renderMonthTabs(); renderWeeklyEntrySection(); renderMonthlyView(); }
    });
  });
}

// ===== STORAGE =====
function saveToStorage(data) {
  try { localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data)); } catch(e) {}
}

function loadFromStorage() {
  isLoading = true;
  try {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
    if (!raw) { isLoading = false; return; }
    populateAll(JSON.parse(raw));
  } catch(e) { console.warn('Load failed:', e); }
  setTimeout(() => { isLoading = false; }, 150);
}

function getCurrentData() {
  return {
    timestamp: new Date().toISOString(),
    pipeline:  extractTableData('pipelineTable'),
    eoi:       extractTableData('eoiTable'),
    ongoing:   extractTableData('ongoingTable'),
    lost:      extractTableData('lostTable'),
    utilization: utilData,
    billableTargets: { ...billableTargets },
    gongo: {
      name: document.getElementById('opportunityName')?.value || '',
      rows: Array.from(document.querySelectorAll('.gongo-row')).map(r => ({
        weight: r.querySelector('.weight-input')?.value || '',
        score:  r.querySelector('.score-input')?.value  || '',
      }))
    }
  };
}

function extractTableData(tableId) {
  const rows = [];
  document.querySelectorAll('#' + tableId + ' tbody tr:not(.total-row)').forEach(row => {
    const rd = {};
    row.querySelectorAll('td').forEach((td, i) => {
      const inp = td.querySelector('input, select');
      rd['col_' + i] = inp ? inp.value : td.textContent.trim();
    });
    rows.push(rd);
  });
  return rows;
}

function populateAll(data) {
  if (!data) return;
  if (data.pipeline) restoreTable('pipelineTable', data.pipeline, addPipelineRow);
  if (data.eoi)      restoreTable('eoiTable',      data.eoi,      addEOIRow);
  if (data.ongoing)  restoreTable('ongoingTable',  data.ongoing,  addOngoingRow);
  if (data.lost)     restoreTable('lostTable',     data.lost,     addLostRow);
  if (data.utilization) { utilData = data.utilization; }
  if (data.billableTargets) billableTargets = { ...DEFAULT_BILLABLE, ...data.billableTargets };
  if (data.gongo) {
    const n = document.getElementById('opportunityName');
    if (n) n.value = data.gongo.name || '';
    document.querySelectorAll('.gongo-row').forEach((row, i) => {
      if (data.gongo.rows?.[i]) {
        const w = row.querySelector('.weight-input'); if (w) w.value = data.gongo.rows[i].weight;
        const s = row.querySelector('.score-input');  if (s) s.value = data.gongo.rows[i].score;
      }
    });
    calcScore();
  }
  setTimeout(() => {
    updatePipeline(); updateOngoing(); updateLost();
    refreshOngoingProjectDropdowns();
    renderMonthTabs(); renderWeeklyEntrySection(); renderMonthlyView();
    updateProgress();
  }, 80);
}

function restoreTable(tableId, rows, addFn) {
  const tbody = document.querySelector('#' + tableId + ' tbody');
  if (!tbody) return;
  tbody.querySelectorAll('tr:not(.total-row)').forEach(r => r.remove());
  rows.forEach(rowData => addFn(rowData));
}

// ===== SAVE =====
async function saveData() {
  const data = getCurrentData();
  saveToStorage(data);
  addToHistory(data);
  updateSyncStatus('saving');
  if (CONFIG.WEBHOOK_URL) {
    try {
      await fetch(CONFIG.WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: CONFIG.TOKEN, timestamp: data.timestamp, data }),
        mode: 'no-cors'
      });
      updateSyncStatus('synced');
      showToast('Saved & synced to Google Sheets ✓', 'success');
    } catch(e) { updateSyncStatus('error'); showToast('Saved locally. Webhook unreachable.', 'error'); }
  } else {
    updateSyncStatus('synced');
    showToast('Saved locally. Set WEBHOOK_URL to sync.', 'success');
  }
}

function updateSyncStatus(state) {
  const pill = document.getElementById('syncStatus');
  const txt  = document.getElementById('statusText');
  if (!pill || !txt) return;
  pill.className = 'status-pill' + (state !== 'synced' ? ' ' + state : '');
  txt.textContent = state === 'saving' ? 'Saving…' : state === 'error' ? 'Sync error' : 'Synced';
}

// ===== HISTORY =====
function addToHistory(data) {
  try {
    const h = JSON.parse(localStorage.getItem(CONFIG.HISTORY_KEY) || '[]');
    h.unshift({ timestamp: data.timestamp, snapshot: data });
    if (h.length > CONFIG.MAX_HISTORY) h.length = CONFIG.MAX_HISTORY;
    localStorage.setItem(CONFIG.HISTORY_KEY, JSON.stringify(h));
  } catch(e) {}
}

function showHistory() {
  const modal = document.getElementById('historyModal');
  const list  = document.getElementById('historyList');
  if (!modal || !list) return;
  try {
    const h = JSON.parse(localStorage.getItem(CONFIG.HISTORY_KEY) || '[]');
    if (!h.length) { list.innerHTML = '<p class="empty-state">No saves yet.</p>'; }
    else {
      list.innerHTML = h.map((item, i) => {
        const d = new Date(item.timestamp);
        return '<div class="history-item" onclick="restoreFromHistory(' + i + ')">' +
          '<div class="history-item-date">' + d.toLocaleDateString('es-MX',{weekday:'short',month:'short',day:'numeric',year:'numeric'}) + ' · ' + d.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}) + '</div>' +
          '<div class="history-item-meta">' + (item.snapshot.pipeline||[]).length + ' proposals · ' + (item.snapshot.ongoing||[]).length + ' ongoing</div>' +
          '<span class="history-item-badge">' + (i===0?'Latest':'Save #'+(h.length-i)) + '</span></div>';
      }).join('');
    }
  } catch(e) { list.innerHTML = '<p class="empty-state">Could not load history.</p>'; }
  modal.classList.add('open');
}

function restoreFromHistory(index) {
  try {
    const h = JSON.parse(localStorage.getItem(CONFIG.HISTORY_KEY) || '[]');
    if (!h[index]) return;
    if (!confirm('Restore this saved state? Current unsaved changes will be lost.')) return;
    isLoading = true;
    populateAll(h[index].snapshot);
    closeHistoryModal();
    showToast('State restored ✓', 'success');
  } catch(e) { showToast('Failed to restore.', 'error'); }
}

function closeHistoryModal() { document.getElementById('historyModal')?.classList.remove('open'); }
function closeModal(e) { if (e.target.id === 'historyModal') closeHistoryModal(); }

// ===== TOAST =====
function showToast(msg, type) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' ' + type : '');
  setTimeout(() => { t.className = 'toast'; }, 3500);
}

// ===== PROGRESS BAR =====
function getOngoingUAFees(statusFilter) {
  let total = 0;
  document.querySelectorAll('#ongoingTable tbody tr:not(.total-row)').forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 8) return;
    const ua = parseFloat(cells[6].querySelector('input')?.value) || 0;
    const st = cells[7].querySelector('select')?.value;
    if (!statusFilter || st === statusFilter) total += ua;
  });
  return total;
}

function getPipelineWeighted() {
  let total = 0;
  document.querySelectorAll('#pipelineTable tbody tr:not(.total-row)').forEach(row => {
    const amt  = parseFloat(row.querySelector('.amt-input')?.value)  || 0;
    const prob = parseFloat(row.querySelector('.prob-input')?.value) || 0;
    total += (amt * prob) / 100;
  });
  return total;
}

function updateProgress() {
  const exercised = getOngoingUAFees('Completed');
  const backlog   = getOngoingUAFees('In Progress');
  const potential = getPipelineWeighted();
  const target    = CONFIG.TARGET;
  const total     = exercised + backlog + potential;
  const remaining = Math.max(0, target - total);
  const fmt = n => '$' + Math.round(n).toLocaleString('en-US');

  setText('exercisedAmount', fmt(exercised));
  setText('backlogAmount',   fmt(backlog));
  setText('potentialAmount', fmt(potential));

  const gap   = target - total;
  const gapEl = document.getElementById('gapAmount');
  if (gapEl) {
    gapEl.textContent = (gap < 0 ? '-' : '') + '$' + Math.abs(Math.round(gap)).toLocaleString('en-US');
    gapEl.className   = 'metric-value' + (gap <= 0 ? ' green' : '');
  }

  const pct = v => Math.min((v / target) * 100, 100).toFixed(2) + '%';
  setStyle('progExercised', 'width', pct(exercised));
  setStyle('progBacklog',   'width', pct(backlog));
  setStyle('progPotential', 'width', pct(potential));
  setStyle('progRemaining', 'width', pct(remaining));

  const now = new Date();
  const monthPct = ((now.getMonth() + now.getDate() / 31) / 12 * 100).toFixed(2);
  setStyle('progressNeedle', 'left', monthPct + '%');
}

function setText(id, v) { const e = document.getElementById(id); if (e) e.textContent = v; }
function setStyle(id, p, v) { const e = document.getElementById(id); if (e) e.style[p] = v; }

// ===== PIPELINE =====
function selOpts(opts, val) {
  return opts.map(o => '<option value="' + o + '"' + (o === val ? ' selected' : '') + '>' + o + '</option>').join('');
}

function addPipelineRow(data) {
  const d = data || {};
  const tbody    = document.querySelector('#pipelineTable tbody');
  const totalRow = tbody.querySelector('.total-row');
  const n = tbody.querySelectorAll('tr:not(.total-row)').length + 1;
  const tr = document.createElement('tr');
  tr.innerHTML =
    '<td class="col-num" style="color:var(--gray-400);font-size:12px;">' + n + '</td>' +
    '<td><input class="cell-input" value="' + htmlEsc(d.col_1||'New Project') + '" onchange="updatePipeline()"></td>' +
    '<td><select class="cell-select">' + selOpts(TOPICS, d.col_2||'Urban Analytics') + '</select></td>' +
    '<td><input class="cell-input" value="' + htmlEsc(d.col_3||'Client') + '" onchange="updatePipeline()"></td>' +
    '<td><select class="cell-select">' + selOpts(MEMBERS, d.col_4||'Octavio') + '</select></td>' +
    '<td><select class="cell-select"><option value="None"' + (!d.col_5||d.col_5==='None'?' selected':'') + '>None</option>' + selOpts(MEMBERS, d.col_5||'') + '</select></td>' +
    '<td><input type="date" class="cell-input narrow-date" value="' + (d.col_6||'2026-12-31') + '" onchange="updatePipeline()"></td>' +
    '<td><input type="number" class="cell-input num amt-input" value="' + (d.col_7||0) + '" onchange="updatePipeline()"></td>' +
    '<td><input type="number" class="cell-input num prob-input" value="' + (d.col_8||0) + '" min="0" max="100" onchange="updatePipeline()"></td>' +
    '<td class="col-num" style="font-family:var(--mono);font-size:12px;">$0</td>' +
    '<td class="col-action"><button class="btn-del" onclick="deleteRow(this,updatePipeline)">✕</button></td>';
  tbody.insertBefore(tr, totalRow);
  if (!isLoading) updatePipeline();
}

function updatePipeline() {
  let tA = 0, tW = 0;
  document.querySelectorAll('#pipelineTable tbody tr:not(.total-row)').forEach((row, i) => {
    const amt  = parseFloat(row.querySelector('.amt-input')?.value)  || 0;
    const prob = parseFloat(row.querySelector('.prob-input')?.value) || 0;
    const w    = (amt * prob) / 100;
    const wc   = row.querySelectorAll('td')[9];
    if (wc) wc.textContent = '$' + Math.round(w).toLocaleString('en-US');
    tA += amt; tW += w;
    row.querySelector('td').textContent = i + 1;
  });
  setText('totalPipeline', '$' + Math.round(tA).toLocaleString('en-US'));
  setText('totalWeighted',  '$' + Math.round(tW).toLocaleString('en-US'));
  updatePipelineLeadSummary();
  updateProgress();
  if (!isLoading) autoSave();
}

function updatePipelineLeadSummary() {
  const stats = {};
  MEMBERS.forEach(m => { stats[m] = { lead: 0, support: 0 }; });
  document.querySelectorAll('#pipelineTable tbody tr:not(.total-row)').forEach(row => {
    const c = row.querySelectorAll('td');
    const lead = c[4]?.querySelector('select')?.value;
    const sup  = c[5]?.querySelector('select')?.value;
    if (lead && stats[lead]) stats[lead].lead++;
    if (sup && sup !== 'None' && stats[sup]) stats[sup].support++;
  });
  const cnt = document.getElementById('pipelineLeadSummary');
  if (!cnt) return;
  cnt.innerHTML = MEMBERS.map(m =>
    '<div class="summary-card">' +
    '<div class="summary-card-name">' + m + '</div>' +
    '<div class="summary-card-stats">' + stats[m].lead + ' Lead · ' + stats[m].support + ' Support</div>' +
    '<div class="summary-card-total">' + (stats[m].lead + stats[m].support) + ' total opps</div>' +
    '</div>'
  ).join('');
}

// ===== EOI =====
function addEOIRow(data) {
  const d = data || {};
  const tbody = document.querySelector('#eoiTable tbody');
  const n = tbody.querySelectorAll('tr').length + 1;
  const tr = document.createElement('tr');
  tr.innerHTML =
    '<td class="col-num" style="color:var(--gray-400);font-size:12px;">' + n + '</td>' +
    '<td><input class="cell-input" value="' + htmlEsc(d.col_1||'New EOI') + '"></td>' +
    '<td><input class="cell-input" value="' + htmlEsc(d.col_2||'Client') + '"></td>' +
    '<td><select class="cell-select">' + selOpts(MEMBERS, d.col_3||'Octavio') + '</select></td>' +
    '<td><select class="cell-select"><option value="None"' + (!d.col_4||d.col_4==='None'?' selected':'') + '>None</option>' + selOpts(MEMBERS, d.col_4||'') + '</select></td>' +
    '<td><input type="date" class="cell-input narrow-date" value="' + (d.col_5||'2026-12-31') + '"></td>' +
    '<td><input class="cell-input" value="' + htmlEsc(d.col_6||'') + '"></td>' +
    '<td class="col-action"><button class="btn-del" onclick="deleteRow(this)">✕</button></td>';
  tbody.appendChild(tr);
  if (!isLoading) autoSave();
}

// ===== ONGOING =====
function addOngoingRow(data) {
  const d = data || {};
  const tbody    = document.querySelector('#ongoingTable tbody');
  const totalRow = tbody.querySelector('.total-row');
  const n = tbody.querySelectorAll('tr:not(.total-row)').length + 1;
  const status = d.col_7 || 'In Progress';
  const tr = document.createElement('tr');
  tr.innerHTML =
    '<td class="col-num" style="color:var(--gray-400);font-size:12px;">' + n + '</td>' +
    '<td><input class="cell-input" value="' + htmlEsc(d.col_1||'New Project') + '" onchange="updateOngoing();refreshOngoingProjectDropdowns()"></td>' +
    '<td><input class="cell-input" value="' + htmlEsc(d.col_2||'Client') + '" onchange="updateOngoing()"></td>' +
    '<td><input type="date" class="cell-input narrow-date" value="' + (d.col_3||'2026-12-31') + '" onchange="updateOngoing()"></td>' +
    '<td><input class="cell-input" value="' + htmlEsc(d.col_4||'BST001') + '" style="font-family:var(--mono);width:90px;text-transform:uppercase"></td>' +
    '<td><input type="number" class="cell-input num" value="' + (d.col_5||0) + '" onchange="updateOngoing()"></td>' +
    '<td><input type="number" class="cell-input num ua-fee-input" value="' + (d.col_6||0) + '" onchange="updateOngoing()" style="color:var(--orange);font-weight:600"></td>' +
    '<td><select class="cell-select" onchange="updateOngoing()">' +
      '<option value="In Progress"' + (status==='In Progress'?' selected':'') + '>In Progress</option>' +
      '<option value="On Hold"'     + (status==='On Hold'    ?' selected':'') + '>On Hold</option>' +
      '<option value="Completed"'   + (status==='Completed'  ?' selected':'') + '>Completed</option>' +
    '</select></td>' +
    '<td class="col-action"><button class="btn-del" onclick="deleteRow(this,updateOngoing);refreshOngoingProjectDropdowns()">✕</button></td>';
  tbody.insertBefore(tr, totalRow);
  if (!isLoading) { updateOngoing(); refreshOngoingProjectDropdowns(); }
}

function updateOngoing() {
  let tF = 0, tU = 0;
  document.querySelectorAll('#ongoingTable tbody tr:not(.total-row)').forEach((row, i) => {
    const c = row.querySelectorAll('td');
    tF += parseFloat(c[5]?.querySelector('input')?.value) || 0;
    tU += parseFloat(c[6]?.querySelector('input')?.value) || 0;
    c[0].textContent = i + 1;
  });
  setText('totalProjectFees', '$' + Math.round(tF).toLocaleString('en-US'));
  setText('totalOngoing',     '$' + Math.round(tU).toLocaleString('en-US'));
  updateProgress();
  if (!isLoading) autoSave();
}

function getOngoingProjectNames() {
  const names = [];
  document.querySelectorAll('#ongoingTable tbody tr:not(.total-row)').forEach(row => {
    const v = row.querySelectorAll('td')[1]?.querySelector('input')?.value?.trim();
    if (v) names.push(v);
  });
  return names;
}

function refreshOngoingProjectDropdowns() {
  const projects = getOngoingProjectNames();
  document.querySelectorAll('.util-project-sel').forEach(sel => {
    const current = sel.value;
    sel.innerHTML = '<option value="">— Select Project —</option>' +
      projects.map(p => '<option value="' + htmlEsc(p) + '"' + (p === current ? ' selected' : '') + '>' + htmlEsc(p) + '</option>').join('') +
      (current && !projects.includes(current) ? '<option value="' + htmlEsc(current) + '" selected>' + htmlEsc(current) + ' (removed)</option>' : '');
  });
}

// ===== LOST =====
function addLostRow(data) {
  const d = data || {};
  const tbody    = document.querySelector('#lostTable tbody');
  const totalRow = tbody.querySelector('.total-row');
  const n = tbody.querySelectorAll('tr:not(.total-row)').length + 1;
  const tr = document.createElement('tr');
  tr.innerHTML =
    '<td class="col-num" style="color:var(--gray-400);font-size:12px;">' + n + '</td>' +
    '<td><input class="cell-input" value="' + htmlEsc(d.col_1||'Lost Project') + '"></td>' +
    '<td><input class="cell-input" value="' + htmlEsc(d.col_2||'Client') + '"></td>' +
    '<td><select class="cell-select">' + selOpts(MEMBERS, d.col_3||'Octavio') + '</select></td>' +
    '<td><select class="cell-select"><option value="None"' + (!d.col_4||d.col_4==='None'?' selected':'') + '>None</option>' + selOpts(MEMBERS, d.col_4||'') + '</select></td>' +
    '<td><input type="date" class="cell-input narrow-date" value="' + (d.col_5||'2026-01-01') + '"></td>' +
    '<td><input type="number" class="cell-input num" value="' + (d.col_6||0) + '" onchange="updateLost()"></td>' +
    '<td><select class="cell-select" onchange="updateLossAnalysis()">' + selOpts(MOTIVES, d.col_7||'Others') + '</select></td>' +
    '<td><input class="cell-input" value="' + htmlEsc(d.col_8||'') + '"></td>' +
    '<td class="col-action"><button class="btn-del" onclick="deleteRow(this,updateLost)">✕</button></td>';
  tbody.insertBefore(tr, totalRow);
  if (!isLoading) updateLost();
}

function updateLost() {
  let total = 0;
  document.querySelectorAll('#lostTable tbody tr:not(.total-row)').forEach((row, i) => {
    const c = row.querySelectorAll('td');
    total += parseFloat(c[6]?.querySelector('input')?.value) || 0;
    c[0].textContent = i + 1;
  });
  setText('totalLost', '$' + Math.round(total).toLocaleString('en-US'));
  updateLossAnalysis();
  if (!isLoading) autoSave();
}

function updateLossAnalysis() {
  const motives = {};
  let totalVal = 0;
  document.querySelectorAll('#lostTable tbody tr:not(.total-row)').forEach(row => {
    const c = row.querySelectorAll('td');
    const m = c[7]?.querySelector('select')?.value || 'Unknown';
    const v = parseFloat(c[6]?.querySelector('input')?.value) || 0;
    if (!motives[m]) motives[m] = { count: 0, value: 0 };
    motives[m].count++; motives[m].value += v; totalVal += v;
  });
  const cnt = document.getElementById('lossAnalysis');
  if (!cnt) return;
  const entries = Object.entries(motives).sort((a, b) => b[1].value - a[1].value);
  cnt.innerHTML = entries.map(([m, s]) => {
    const pct = totalVal > 0 ? ((s.value / totalVal) * 100).toFixed(1) : '0';
    return '<div class="summary-card" style="border-left-color:var(--red)">' +
      '<div class="summary-card-name" style="color:var(--red)">' + m + '</div>' +
      '<div class="summary-card-stats">' + s.count + ' opp' + (s.count !== 1 ? 's' : '') + ' · ' + pct + '%</div>' +
      '<div class="summary-card-total">$' + s.value.toLocaleString('en-US') + '</div></div>';
  }).join('');
}

// ===== DELETE ROW =====
function deleteRow(btn, updateFn) {
  btn.closest('tr')?.remove();
  if (typeof updateFn === 'function') updateFn();
  else { updatePipeline(); updateOngoing(); updateLost(); }
}

// ==============================================
// ===== UTILIZATION — MONTHLY SYSTEM ==========
// ==============================================

function initUtilizationControls() {
  currentUtilMonth = new Date().getMonth();
  currentUtilYear  = new Date().getFullYear();
  renderMonthTabs();
  renderWeeklyEntrySection();
  renderMonthlyView();
}

function renderMonthTabs() {
  const container = document.getElementById('monthTabsRow');
  if (!container) return;
  container.innerHTML = MONTHS.map((m, i) =>
    '<button class="month-tab' + (i === currentUtilMonth ? ' active' : '') + '" onclick="switchMonth(' + i + ')">' + m + '</button>'
  ).join('');
}

function switchMonth(monthIndex) {
  currentUtilMonth = monthIndex;
  renderMonthTabs();
  renderWeeklyEntrySection();
  renderMonthlyView();
}

// ---- WEEKLY ENTRY ----
function renderWeeklyEntrySection() {
  const container = document.getElementById('weeklyEntrySection');
  if (!container) return;

  const weeks    = getWeeksOfMonth(currentUtilYear, currentUtilMonth);
  const monthKey = currentUtilYear + '-' + currentUtilMonth;
  if (!utilData[monthKey]) utilData[monthKey] = {};

  container.innerHTML = weeks.map((week, wi) => {
    const weekKey = week.start;
    if (!utilData[monthKey][weekKey]) utilData[monthKey][weekKey] = [];
    const safeKey = monthKey.replace(/-/g,'_') + '__' + weekKey.replace(/-/g,'_');
    return '<div class="week-block">' +
      '<div class="week-block-header">' +
        '<span class="week-label">Week ' + (wi+1) + ' · ' + fmtDate(week.start) + ' – ' + fmtDate(week.end) + '</span>' +
        '<button class="btn btn-add" onclick="addUtilRow(\'' + monthKey + '\',\'' + weekKey + '\')">+ Add Row</button>' +
      '</div>' +
      '<div class="table-wrap">' +
        '<table class="util-week-table">' +
          '<thead><tr>' +
            '<th>#</th><th>Resource</th><th>Project</th>' +
            '<th class="col-num">Hours</th>' +
            '<th class="col-num">Base Rate/hr (USD)</th>' +
            '<th class="col-num">Multiplier</th>' +
            '<th class="col-num">Rate/hr (USD)</th>' +
            '<th class="col-num">Fee (USD)</th>' +
            '<th class="col-action"></th>' +
          '</tr></thead>' +
          '<tbody id="util-tbody-' + safeKey + '"></tbody>' +
        '</table>' +
      '</div></div>';
  }).join('');

  // Re-populate stored rows
  weeks.forEach(week => {
    const weekKey  = week.start;
    const safeKey  = monthKey.replace(/-/g,'_') + '__' + weekKey.replace(/-/g,'_');
    const rows     = (utilData[monthKey][weekKey]) || [];
    rows.forEach(r => addUtilRow(monthKey, weekKey, r, safeKey));
  });
}

function addUtilRow(monthKey, weekKey, data, safeKey) {
  if (!safeKey) safeKey = monthKey.replace(/-/g,'_') + '__' + weekKey.replace(/-/g,'_');
  const tbody = document.getElementById('util-tbody-' + safeKey);
  if (!tbody) return;
  const n = tbody.querySelectorAll('tr').length + 1;
  const d = data || {};
  const projects = getOngoingProjectNames();
  const selMem  = MEMBERS.map(m => '<option value="' + m + '"' + (m === (d.resource||'Octavio') ? ' selected' : '') + '>' + m + '</option>').join('');
  const selProj = '<option value="">— Select Project —</option>' +
    projects.map(p => '<option value="' + htmlEsc(p) + '"' + (p === d.project ? ' selected' : '') + '>' + htmlEsc(p) + '</option>').join('') +
    (d.project && !projects.includes(d.project) ? '<option value="' + htmlEsc(d.project) + '" selected>' + htmlEsc(d.project) + ' (removed)</option>' : '');

  const tr = document.createElement('tr');
  tr.setAttribute('data-mk', monthKey);
  tr.setAttribute('data-wk', weekKey);
  tr.innerHTML =
    '<td class="col-num" style="color:var(--gray-400);font-size:12px;">' + n + '</td>' +
    '<td><select class="cell-select util-resource-sel" onchange="calcUtilRow(this)">' + selMem + '</select></td>' +
    '<td><select class="cell-select util-project-sel" onchange="saveUtilData(this)">' + selProj + '</select></td>' +
    '<td><input type="number" class="cell-input num util-hours"     value="' + (d.hours||0)      + '" min="0"       onchange="calcUtilRow(this)"></td>' +
    '<td><input type="number" class="cell-input num util-base-rate" value="' + (d.baseRate||150)  + '" min="0"       onchange="calcUtilRow(this)" title="Base rate before multiplier"></td>' +
    '<td><input type="number" class="cell-input num util-mult"      value="' + (d.multiplier||1)  + '" min="0" step="0.1" onchange="calcUtilRow(this)"></td>' +
    '<td class="col-num util-rate-cell" style="font-family:var(--mono);font-size:12px;color:var(--gray-500)">$' + ((d.baseRate||150)*(d.multiplier||1)).toFixed(2) + '</td>' +
    '<td class="col-num util-fee-cell"  style="font-family:var(--mono);font-size:12px;font-weight:600;color:var(--orange)">$0</td>' +
    '<td class="col-action"><button class="btn-del" onclick="deleteUtilRow(this)">✕</button></td>';
  tbody.appendChild(tr);
  calcUtilRow(tr.querySelector('.util-hours'), false);
}

function calcUtilRow(input, doSave) {
  if (doSave === undefined) doSave = true;
  const row = input.closest('tr');
  if (!row) return;
  const hours    = parseFloat(row.querySelector('.util-hours')?.value)     || 0;
  const baseRate = parseFloat(row.querySelector('.util-base-rate')?.value) || 0;
  const mult     = parseFloat(row.querySelector('.util-mult')?.value)      || 1;
  const rateHr   = baseRate * mult;
  const fee      = hours * rateHr;
  const rateCell = row.querySelector('.util-rate-cell');
  const feeCell  = row.querySelector('.util-fee-cell');
  if (rateCell) rateCell.textContent = '$' + rateHr.toFixed(2);
  if (feeCell)  feeCell.textContent  = '$' + Math.round(fee).toLocaleString('en-US');
  if (doSave) saveUtilData(input);
}

function saveUtilData(el) {
  const row     = el.closest('tr');
  const monthKey = row?.getAttribute('data-mk');
  const weekKey  = row?.getAttribute('data-wk');
  if (!monthKey || !weekKey) return;
  const safeKey  = monthKey.replace(/-/g,'_') + '__' + weekKey.replace(/-/g,'_');
  const tbody    = document.getElementById('util-tbody-' + safeKey);
  if (!tbody) return;
  if (!utilData[monthKey]) utilData[monthKey] = {};
  const rows = [];
  tbody.querySelectorAll('tr').forEach(r => {
    rows.push({
      resource:   r.querySelector('.util-resource-sel')?.value || '',
      project:    r.querySelector('.util-project-sel')?.value  || '',
      hours:      parseFloat(r.querySelector('.util-hours')?.value)     || 0,
      baseRate:   parseFloat(r.querySelector('.util-base-rate')?.value) || 0,
      multiplier: parseFloat(r.querySelector('.util-mult')?.value)      || 1,
    });
  });
  utilData[monthKey][weekKey] = rows;
  renderMonthlyView();
  if (!isLoading) autoSave();
}

function deleteUtilRow(btn) {
  const row      = btn.closest('tr');
  const monthKey = row?.getAttribute('data-mk');
  const weekKey  = row?.getAttribute('data-wk');
  row?.remove();
  if (monthKey && weekKey) {
    const safeKey = monthKey.replace(/-/g,'_') + '__' + weekKey.replace(/-/g,'_');
    const tbody   = document.getElementById('util-tbody-' + safeKey);
    if (tbody && utilData[monthKey]) {
      const rows = [];
      tbody.querySelectorAll('tr').forEach(r => {
        rows.push({
          resource:   r.querySelector('.util-resource-sel')?.value || '',
          project:    r.querySelector('.util-project-sel')?.value  || '',
          hours:      parseFloat(r.querySelector('.util-hours')?.value)     || 0,
          baseRate:   parseFloat(r.querySelector('.util-base-rate')?.value) || 0,
          multiplier: parseFloat(r.querySelector('.util-mult')?.value)      || 1,
        });
      });
      utilData[monthKey][weekKey] = rows;
    }
  }
  renderMonthlyView();
  if (!isLoading) autoSave();
}

// ---- MONTHLY SUMMARY VIEW ----
function renderMonthlyView() {
  const container = document.getElementById('monthlySummaryView');
  if (!container) return;

  const monthKey  = currentUtilYear + '-' + currentUtilMonth;
  const monthData = utilData[monthKey] || {};

  // Aggregate
  const memberStats = {};
  MEMBERS.forEach(m => {
    memberStats[m] = { hours: 0, fee: 0, billableTarget: getBillableTargetFor(m), projects: {} };
  });

  Object.values(monthData).forEach(weekRows => {
    weekRows.forEach(r => {
      if (!r.resource || !MEMBERS.includes(r.resource)) return;
      const rateHr = (r.baseRate || 0) * (r.multiplier || 1);
      const fee    = (r.hours || 0) * rateHr;
      memberStats[r.resource].hours += (r.hours || 0);
      memberStats[r.resource].fee   += fee;
      if (r.project) {
        if (!memberStats[r.resource].projects[r.project])
          memberStats[r.resource].projects[r.project] = { hours: 0, fee: 0 };
        memberStats[r.resource].projects[r.project].hours += (r.hours || 0);
        memberStats[r.resource].projects[r.project].fee   += fee;
      }
    });
  });

  const monthName = MONTHS[currentUtilMonth];
  let html = '<div class="monthly-summary-header"><h3>Monthly Summary — ' + monthName + ' ' + currentUtilYear + '</h3></div>';
  html += '<div class="member-summary-grid">';

  MEMBERS.forEach(m => {
    const s = memberStats[m];
    const billableHours      = HOURS_PER_MONTH * (s.billableTarget / 100);
    const actualPct          = Math.min((s.hours / HOURS_PER_MONTH) * 100, 100);
    const onTargetPct        = billableHours > 0 ? Math.min((s.hours / billableHours) * 100, 100) : 0;
    const statusColor        = onTargetPct >= 90 ? 'var(--green)' : onTargetPct >= 60 ? 'var(--orange)' : 'var(--red)';
    const projectRows = Object.entries(s.projects).map(([proj, ps]) =>
      '<div class="proj-row"><span>' + htmlEsc(proj) + '</span><span style="font-family:var(--mono)">' + ps.hours + 'h · $' + Math.round(ps.fee).toLocaleString('en-US') + '</span></div>'
    ).join('') || '<div class="proj-row empty-proj">No entries this month</div>';

    html +=
      '<div class="member-card">' +
        '<div class="member-card-header">' +
          '<span class="member-card-name">' + m + '</span>' +
          '<span class="member-card-fee">$' + Math.round(s.fee).toLocaleString('en-US') + '</span>' +
        '</div>' +
        '<div class="billable-bar-wrap">' +
          '<div class="billable-bar-track">' +
            '<div class="billable-bar-fill" style="width:' + actualPct.toFixed(1) + '%;background:' + statusColor + '"></div>' +
            '<div class="billable-target-marker" style="left:' + s.billableTarget.toFixed(1) + '%"></div>' +
          '</div>' +
          '<div class="billable-bar-labels">' +
            '<span style="color:' + statusColor + ';font-weight:600">' + actualPct.toFixed(0) + '% actual</span>' +
            '<span>Target: <input type="number" class="billable-target-input" value="' + s.billableTarget + '" min="0" max="100" onchange="setBillableTarget(\'' + m + '\',this.value)" title="Edit billable % target for ' + m + '">%</span>' +
          '</div>' +
        '</div>' +
        '<div class="member-hours-row">' +
          '<span>' + s.hours + 'h logged</span>' +
          '<span>' + billableHours.toFixed(0) + 'h target (' + s.billableTarget + '% of ' + HOURS_PER_MONTH + 'h)</span>' +
        '</div>' +
        '<div class="proj-breakdown">' + projectRows + '</div>' +
      '</div>';
  });

  html += '</div>';

  // Month totals
  const totHours = MEMBERS.reduce((a, m) => a + memberStats[m].hours, 0);
  const totFee   = MEMBERS.reduce((a, m) => a + memberStats[m].fee,   0);
  html +=
    '<div class="month-totals">' +
      '<div class="month-total-item"><span class="month-total-label">Total Hours</span><span class="month-total-value">' + totHours + '</span></div>' +
      '<div class="month-total-item"><span class="month-total-label">Total Fee</span><span class="month-total-value orange">$' + Math.round(totFee).toLocaleString('en-US') + '</span></div>' +
      '<div class="month-total-item"><span class="month-total-label">Month</span><span class="month-total-value">' + monthName + ' ' + currentUtilYear + '</span></div>' +
    '</div>';

  container.innerHTML = html;
}

// ---- BILLABLE TARGETS ----
function getBillableTargetFor(member) {
  return billableTargets[member] !== undefined ? billableTargets[member] : (DEFAULT_BILLABLE[member] || 75);
}
function setBillableTarget(member, val) {
  billableTargets[member] = parseFloat(val) || 0;
  renderMonthlyView();
  if (!isLoading) autoSave();
}

// ---- WEEK CALCULATOR ----
function getWeeksOfMonth(year, month) {
  const weeks   = [];
  const first   = new Date(year, month, 1);
  const dayOfW  = first.getDay();
  const offset  = dayOfW === 0 ? -6 : 1 - dayOfW;
  const monday  = new Date(first);
  monday.setDate(first.getDate() + offset);
  let cur = new Date(monday);
  while (weeks.length < 6) {
    const start = new Date(cur);
    const end   = new Date(cur); end.setDate(end.getDate() + 6);
    if (start.getMonth() > month && start.getFullYear() >= year) break;
    if (start.getMonth() === month || end.getMonth() === month) {
      weeks.push({ start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] });
    }
    cur.setDate(cur.getDate() + 7);
  }
  return weeks;
}

function fmtDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-MX', { month: 'short', day: 'numeric' });
}

// ===== GO / NO GO =====
function calcScore() {
  const rows = document.querySelectorAll('.gongo-row');
  let totW = 0, totWS = 0;
  rows.forEach((row, i) => {
    const w  = parseFloat(row.querySelector('.weight-input')?.value) || 0;
    const s  = parseFloat(row.querySelector('.score-input')?.value)  || 0;
    const ws = (w * s) / 100;
    totW += w; totWS += ws;
    const c = document.getElementById('w' + (i+1)); if (c) c.textContent = ws.toFixed(2);
  });
  setText('totalWeight', Math.round(totW));
  const score = totW > 0 ? (totWS / totW * 10).toFixed(2) : '0.00';
  setText('finalScore', score);
  const result   = document.getElementById('gongoResult');
  const decision = document.getElementById('gongoDecision');
  const rec      = document.getElementById('gongoRec');
  if (!result) return;
  result.className = 'gongo-result';
  const f = parseFloat(score);
  if (f >= 7.5) {
    result.classList.add('result-go');
    if (decision) decision.textContent = '— GO —';
    if (rec)      rec.textContent      = 'Excellent opportunity with strong strategic alignment';
  } else if (f >= 6) {
    result.classList.add('result-conditional');
    if (decision) decision.textContent = '— CONDITIONAL GO —';
    if (rec)      rec.textContent      = 'Good opportunity — review key concerns before committing';
  } else {
    result.classList.add('result-nogo');
    if (decision) decision.textContent = '— NO GO —';
    if (rec)      rec.textContent      = 'High risk, poor strategic alignment';
  }
}

// ===== PDF =====
function generatePDF() {
  const name     = document.getElementById('opportunityName')?.value || 'Unknown';
  const score    = document.getElementById('finalScore')?.textContent || '0';
  const decision = document.getElementById('gongoDecision')?.textContent || '';
  const rows = Array.from(document.querySelectorAll('.gongo-row')).map((row, i) => ({
    title: row.querySelector('.criterion-title')?.textContent || '',
    w: row.querySelector('.weight-input')?.value || '',
    s: row.querySelector('.score-input')?.value  || '',
    ws: document.getElementById('w' + (i+1))?.textContent || ''
  }));
  const content = '<html><head><title>Go/No Go — ' + name + '</title>' +
    '<style>body{font-family:sans-serif;padding:40px;color:#1a1a1a}h1{font-size:22px;border-bottom:3px solid #E3610F;padding-bottom:10px}' +
    '.score{font-size:48px;font-weight:700;color:#E3610F;margin:20px 0}.meta{color:#666;font-size:12px}' +
    'table{width:100%;border-collapse:collapse;margin-top:20px}th{background:#1a1a1a;color:#fff;padding:8px;font-size:11px;text-align:left}' +
    'td{padding:8px;border-bottom:1px solid #eee;font-size:12px}</style></head><body>' +
    '<h1>Go / No Go Evaluation</h1>' +
    '<p class="meta">Urban Analytics Mexico · ' + new Date().toLocaleDateString('es-MX',{year:'numeric',month:'long',day:'numeric'}) + '</p>' +
    '<p><strong>Opportunity:</strong> ' + name + '</p>' +
    '<div class="score">' + score + '</div><p><strong>' + decision + '</strong></p>' +
    '<table><tr><th>Criterion</th><th>Weight %</th><th>Score</th><th>Weighted</th></tr>' +
    rows.map(r => '<tr><td>' + r.title + '</td><td>' + r.w + '%</td><td>' + r.s + '</td><td>' + r.ws + '</td></tr>').join('') +
    '</table></body></html>';
  const w = window.open('', '_blank');
  if (w) { w.document.write(content); w.document.close(); setTimeout(() => w.print(), 500); }
}

// ===== CSV EXPORT =====
function exportPipelineToCSV() {
  let csv = '\uFEFFUrban Analytics Mexico — Export\nGenerated: ' + new Date().toLocaleString('es-MX') + '\n\n';

  csv += 'CURRENT PROPOSAL PIPELINE\n#,Project,Topic,Client,Lead,Support,Date,Price USD,Probability %,Weighted USD\n';
  let tA=0,tW=0;
  document.querySelectorAll('#pipelineTable tbody tr:not(.total-row)').forEach((row,i)=>{
    const c=row.querySelectorAll('td');
    const amt=parseFloat(c[7]?.querySelector('input')?.value)||0;
    const prob=parseFloat(c[8]?.querySelector('input')?.value)||0;
    const w=(amt*prob)/100; tA+=amt; tW+=w;
    csv+=i+1+',"'+esc(c[1]?.querySelector('input')?.value)+'","'+esc(c[2]?.querySelector('select')?.value)+'","'+esc(c[3]?.querySelector('input')?.value)+'","'+esc(c[4]?.querySelector('select')?.value)+'","'+esc(c[5]?.querySelector('select')?.value)+'",'+( c[6]?.querySelector('input')?.value||'')+','+amt+','+prob+','+w.toFixed(2)+'\n';
  });
  csv+='TOTAL,,,,,,,'+tA+',,'+tW.toFixed(2)+'\n\n';

  csv+='ONGOING PROJECTS\n#,Project,Client,Date,BST,Fees USD,UA Fees USD,Status\n';
  let tF=0,tU=0;
  document.querySelectorAll('#ongoingTable tbody tr:not(.total-row)').forEach((row,i)=>{
    const c=row.querySelectorAll('td');
    const f=parseFloat(c[5]?.querySelector('input')?.value)||0;
    const u=parseFloat(c[6]?.querySelector('input')?.value)||0; tF+=f; tU+=u;
    csv+=i+1+',"'+esc(c[1]?.querySelector('input')?.value)+'","'+esc(c[2]?.querySelector('input')?.value)+'",'+( c[3]?.querySelector('input')?.value||'')+',"'+esc(c[4]?.querySelector('input')?.value)+'",'+f+','+u+',"'+esc(c[7]?.querySelector('select')?.value)+'"\n';
  });
  csv+='TOTAL,,,,,'+tF+','+tU+',\n\n';

  csv+='LOST OPPORTUNITIES\n#,Project,Client,Lead,Support,Date,Value USD,Motive,Comments\n';
  let tL=0;
  document.querySelectorAll('#lostTable tbody tr:not(.total-row)').forEach((row,i)=>{
    const c=row.querySelectorAll('td');
    const v=parseFloat(c[6]?.querySelector('input')?.value)||0; tL+=v;
    csv+=i+1+',"'+esc(c[1]?.querySelector('input')?.value)+'","'+esc(c[2]?.querySelector('input')?.value)+'","'+esc(c[3]?.querySelector('select')?.value)+'","'+esc(c[4]?.querySelector('select')?.value)+'",'+( c[5]?.querySelector('input')?.value||'')+','+v+',"'+esc(c[7]?.querySelector('select')?.value)+'","'+esc(c[8]?.querySelector('input')?.value)+'"\n';
  });
  csv+='TOTAL,,,,,,'+tL+',,\n\n';

  csv+='RESOURCE UTILIZATION — MONTHLY\n';
  MONTHS.forEach((m,mi)=>{
    const mKey=currentUtilYear+'-'+mi;
    const mData=utilData[mKey]||{};
    const allRows=[]; Object.values(mData).forEach(wRows=>allRows.push(...wRows));
    if (!allRows.length) return;
    csv+='\n'+m+' '+currentUtilYear+'\nResource,Project,Hours,Base Rate,Multiplier,Rate/hr,Fee USD\n';
    allRows.forEach(r=>{
      const rHr=(r.baseRate||0)*(r.multiplier||1);
      csv+='"'+esc(r.resource)+'","'+esc(r.project)+'",'+r.hours+','+r.baseRate+','+r.multiplier+','+rHr.toFixed(2)+','+(((r.hours||0)*rHr).toFixed(2))+'\n';
    });
  });

  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download='UA_MX_'+currentUtilYear+'_'+new Date().toISOString().split('T')[0]+'.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  showToast('CSV exported ✓','success');
}

function esc(v)     { return typeof v==='string' ? v.replace(/"/g,'""')   : (v||''); }
function htmlEsc(v) { return typeof v==='string' ? v.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : (v||''); }

// ===== AUTO-SAVE =====
let _asSave = null;
function autoSave() {
  if (isLoading) return;
  clearTimeout(_asSave);
  _asSave = setTimeout(() => { saveToStorage(getCurrentData()); }, 1500);
}
