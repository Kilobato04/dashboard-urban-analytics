/* =============================================
   URBAN ANALYTICS MEXICO — script.js v3
   ============================================= */
'use strict';

const CONFIG = {
  TARGET: 380000,          // default; overridden by #billabilityTarget input at runtime
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

// ===== BILLABILITY TARGET =====
function getTarget() {
  const el = document.getElementById('billabilityTarget');
  return el ? (parseFloat(el.value) || CONFIG.TARGET) : CONFIG.TARGET;
}

function onTargetChange() {
  updateProgress();
  if (!isLoading) autoSave();
}

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
    billabilityTarget: getTarget(),
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
  // Restore target first so updateProgress uses the correct value
  if (data.billabilityTarget) {
    const el = document.getElementById('billabilityTarget');
    if (el) el.value = data.billabilityTarget;
  }
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
  const target    = getTarget();
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

// ==============================================
// ===== COLLECTIONS & PAYMENTS ================
// ==============================================

// Collection status options (receivable side)
const ESTATUS_COBRO  = ['Invoice Sent', 'Invoice Pending', 'Payment Received', 'Overdue', 'Other'];
// Payable status options (payable side)
const ESTATUS_PAGO_P = ['InterOpco Invoice', 'Invoice Received', 'Invoice Pending', 'Payment Sent', 'On Hold', 'Other'];
const TIPO_PAGO      = ['External', 'InterOpco'];

function addPagoRow(data) {
  const d        = data || {};
  const tbody    = document.querySelector('#pagosTable tbody');
  const totalRow = tbody.querySelector('.total-row');
  const n        = tbody.querySelectorAll('tr:not(.total-row)').length + 1;
  const projects = getOngoingProjectNames();

  const selProj = '<option value="">— Select Project —</option>' +
    projects.map(p => '<option value="' + htmlEsc(p) + '"' + (p === d.col_1 ? ' selected' : '') + '>' + htmlEsc(p) + '</option>').join('') +
    (d.col_1 && !projects.includes(d.col_1) ? '<option value="' + htmlEsc(d.col_1) + '" selected>' + htmlEsc(d.col_1) + ' (removed)</option>' : '');

  // col mapping:
  // col_1=project col_2=desc col_3=receivable col_4=collectionStatus
  // col_5=paymentType col_6=payable col_7=payableStatus col_8=date col_9=notes
  const selCollStatus = ESTATUS_COBRO.map(e =>
    '<option value="' + e + '"' + (e === (d.col_4 || 'Invoice Pending') ? ' selected' : '') + '>' + e + '</option>'
  ).join('');

  const selTipo = TIPO_PAGO.map(t =>
    '<option value="' + t + '"' + (t === (d.col_5 || 'External') ? ' selected' : '') + '>' + t + '</option>'
  ).join('');

  const selPayStatus = ESTATUS_PAGO_P.map(e =>
    '<option value="' + e + '"' + (e === (d.col_7 || 'Invoice Pending') ? ' selected' : '') + '>' + e + '</option>'
  ).join('');

  const tr = document.createElement('tr');
  // Columns: # | Project | Description | Receivable | CollStatus | PayType | Payable | PayStatus | Date | Notes | Del
  tr.innerHTML =
    '<td class="col-num" style="color:var(--gray-400);font-size:12px;">' + n + '</td>' +
    '<td style="min-width:150px"><select class="cell-select pagos-proj-sel" onchange="updatePagos()">' + selProj + '</select></td>' +
    '<td><input class="cell-input" value="' + htmlEsc(d.col_2 || '') + '" placeholder="Description / concept" style="min-width:140px"></td>' +
    '<td><input type="number" class="cell-input num" value="' + (d.col_3 || 0) + '" min="0" onchange="updatePagos()"></td>' +
    '<td><select class="cell-select coll-status-sel" onchange="styleStatusSel(this,\'coll\')">' + selCollStatus + '</select></td>' +
    '<td><select class="cell-select" onchange="updatePagos()">' + selTipo + '</select></td>' +
    '<td><input type="number" class="cell-input num" value="' + (d.col_6 || 0) + '" min="0" onchange="updatePagos()"></td>' +
    '<td><select class="cell-select pay-status-sel" onchange="styleStatusSel(this,\'pay\')">' + selPayStatus + '</select></td>' +
    '<td><input type="date" class="cell-input narrow-date" value="' + (d.col_8 || '') + '"></td>' +
    '<td><input class="cell-input" value="' + htmlEsc(d.col_9 || '') + '" placeholder="Notes..." style="min-width:140px"></td>' +
    '<td class="col-action"><button class="btn-del" onclick="deleteRow(this,updatePagos)">✕</button></td>';
  tbody.insertBefore(tr, totalRow);

  // Apply initial status colors
  const collSel = tr.querySelector('.coll-status-sel');
  const paySel  = tr.querySelector('.pay-status-sel');
  if (collSel) styleStatusSel(collSel, 'coll');
  if (paySel)  styleStatusSel(paySel,  'pay');

  if (!isLoading) updatePagos();
}

function styleStatusSel(sel, side) {
  if (!sel) return;
  const v = sel.value;
  // Collection side
  if (side === 'coll') {
    if (v === 'Payment Received')  { sel.style.color = '#15803d'; sel.style.fontWeight = '600'; }
    else if (v === 'Invoice Sent') { sel.style.color = '#2563eb'; sel.style.fontWeight = '500'; }
    else if (v === 'Overdue')      { sel.style.color = '#dc2626'; sel.style.fontWeight = '700'; }
    else if (v === 'Invoice Pending') { sel.style.color = '#b45309'; sel.style.fontWeight = '500'; }
    else { sel.style.color = ''; sel.style.fontWeight = ''; }
  }
  // Payable side
  if (side === 'pay') {
    if (v === 'Payment Sent')        { sel.style.color = '#15803d'; sel.style.fontWeight = '600'; }
    else if (v === 'Invoice Received'){ sel.style.color = '#2563eb'; sel.style.fontWeight = '500'; }
    else if (v === 'InterOpco Invoice'){ sel.style.color = '#7c3aed'; sel.style.fontWeight = '600'; }
    else if (v === 'Invoice Pending') { sel.style.color = '#b45309'; sel.style.fontWeight = '500'; }
    else if (v === 'On Hold')         { sel.style.color = '#dc2626'; sel.style.fontWeight = '500'; }
    else { sel.style.color = ''; sel.style.fontWeight = ''; }
  }
}

function updatePagos() {
  let totCobrar = 0, totPagar = 0;
  // Cols: 0=# 1=proj 2=desc 3=recv 4=collStatus 5=type 6=payable 7=payStatus 8=date 9=notes
  document.querySelectorAll('#pagosTable tbody tr:not(.total-row)').forEach((row, i) => {
    const c      = row.querySelectorAll('td');
    const cobrar = parseFloat(c[3]?.querySelector('input')?.value)  || 0;
    const pagar  = parseFloat(c[6]?.querySelector('input')?.value)  || 0;
    totCobrar += cobrar;
    totPagar  += pagar;
    c[0].textContent = i + 1;
    // Re-apply colors on each update
    styleStatusSel(c[4]?.querySelector('select'), 'coll');
    styleStatusSel(c[7]?.querySelector('select'), 'pay');
  });

  const fmt     = v => '$' + Math.round(v).toLocaleString('en-US');
  const balance = totCobrar - totPagar;

  setText('totalPorCobrar', fmt(totCobrar));
  setText('totalPorPagar',  fmt(totPagar));
  setText('totalBalance',   (balance < 0 ? '-$' : '$') + Math.abs(Math.round(balance)).toLocaleString('en-US'));

  const balCard = document.getElementById('balanceCard');
  if (balCard) balCard.className = 'pagos-summary-item ' + (balance >= 0 ? 'positive' : 'negative');

  setText('footerPorCobrar', fmt(totCobrar));
  setText('footerPorPagar',  fmt(totPagar));

  if (!isLoading) autoSave();
}

function refreshPagoProjectDropdowns() {
  const projects = getOngoingProjectNames();
  document.querySelectorAll('.pagos-proj-sel').forEach(sel => {
    const current = sel.value;
    sel.innerHTML = '<option value="">— Select Project —</option>' +
      projects.map(p => '<option value="' + htmlEsc(p) + '"' + (p === current ? ' selected' : '') + '>' + htmlEsc(p) + '</option>').join('') +
      (current && !projects.includes(current) ? '<option value="' + htmlEsc(current) + '" selected>' + htmlEsc(current) + ' (removed)</option>' : '');
  });
}

// ==============================================
// ===== TIME OFF ==============================
// ==============================================

const DEFAULT_VAC_CONFIG = {
  Octavio: { entryDate: '2020-01-01', annualDays: 20, priorYearDays: 0 },
  Roberto: { entryDate: '2021-06-01', annualDays: 18, priorYearDays: 0 },
  'Noé':   { entryDate: '2022-03-15', annualDays: 15, priorYearDays: 0 },
};

let vacConfig = JSON.parse(JSON.stringify(DEFAULT_VAC_CONFIG));

function renderVacCards() {
  const container = document.getElementById('vacCards');
  if (!container) return;

  const today     = new Date();
  const yearStart = new Date(today.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((today - yearStart) / 86400000) + 1;

  container.innerHTML = MEMBERS.map(m => {
    const cfg        = vacConfig[m] || { entryDate: '2020-01-01', annualDays: 15, priorYearDays: 0 };
    const entry      = new Date(cfg.entryDate + 'T12:00:00');
    const annualDays = cfg.annualDays    || 15;
    const priorDays  = cfg.priorYearDays || 0;

    const years      = Math.max(0, (today - entry) / (365.25 * 86400000));
    const accrued    = Math.floor(annualDays * (dayOfYear / 365));
    const totalPool  = priorDays + accrued;

    // Days taken this year
    const taken      = getVacTakenForMember(m);

    // Consume prior year first
    const priorUsed  = Math.min(taken, priorDays);
    const currentUsed= Math.max(0, taken - priorDays);
    const priorLeft  = Math.max(0, priorDays - priorUsed);
    const currentLeft= Math.max(0, accrued   - currentUsed);
    const totalLeft  = priorLeft + currentLeft;

    const usedPct    = totalPool > 0 ? Math.min((taken / totalPool) * 100, 100) : 0;
    const fillClass  = usedPct >= 80 ? 'high' : usedPct >= 50 ? 'mid' : 'low';

    const seniority  = years < 1
      ? Math.floor(years * 12) + ' mo'
      : years.toFixed(1) + ' yrs';

    return '<div class="vac-card">' +
      '<div class="vac-card-header">' +
        '<span class="vac-card-name">' + m + '</span>' +
        '<div style="text-align:right">' +
          '<div class="vac-days-remaining">' + totalLeft + '</div>' +
          '<div class="vac-days-label">days available</div>' +
        '</div>' +
      '</div>' +
      '<div class="vac-progress-track">' +
        '<div class="vac-progress-fill ' + fillClass + '" style="width:' + usedPct.toFixed(1) + '%"></div>' +
      '</div>' +
      // Prior year + current year breakdown
      '<div class="vac-balance-row">' +
        '<div class="vac-balance-item prior">' +
          '<span class="vac-balance-label">Prior Yr D/Off</span>' +
          '<span class="vac-balance-num">' + priorLeft + ' <small>/ ' + priorDays + ' d</small></span>' +
        '</div>' +
        '<div class="vac-balance-sep">+</div>' +
        '<div class="vac-balance-item current">' +
          '<span class="vac-balance-label">Current Yr Accrued</span>' +
          '<span class="vac-balance-num">' + currentLeft + ' <small>/ ' + accrued + ' d</small></span>' +
        '</div>' +
      '</div>' +
      '<div class="vac-meta-grid">' +
        '<div class="vac-meta-item"><span class="vac-meta-label">Taken this year</span><span class="vac-meta-value">' + taken + ' days</span></div>' +
        '<div class="vac-meta-item"><span class="vac-meta-label">Annual entitlement</span><span class="vac-meta-value">' + annualDays + ' days</span></div>' +
        '<div class="vac-meta-item"><span class="vac-meta-label">Seniority</span><span class="vac-meta-value">' + seniority + '</span></div>' +
        '<div class="vac-meta-item"><span class="vac-meta-label">Total pool</span><span class="vac-meta-value">' + totalPool + ' days</span></div>' +
      '</div>' +
      '<div class="vac-editable-row">' +
        '<div class="vac-field">' +
          '<label>Entry Date</label>' +
          '<input type="date" value="' + cfg.entryDate + '" onchange="setVacConfig(\'' + m + '\',\'entryDate\',this.value)">' +
        '</div>' +
        '<div class="vac-field">' +
          '<label>Annual Days</label>' +
          '<input type="number" value="' + annualDays + '" min="0" max="365" onchange="setVacConfig(\'' + m + '\',\'annualDays\',this.value)">' +
        '</div>' +
        '<div class="vac-field">' +
          '<label>Prior Yr D/Off</label>' +
          '<input type="number" value="' + priorDays + '" min="0" max="365" onchange="setVacConfig(\'' + m + '\',\'priorYearDays\',this.value)">' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function setVacConfig(member, field, value) {
  if (!vacConfig[member]) vacConfig[member] = { entryDate: '2020-01-01', annualDays: 15, priorYearDays: 0 };
  vacConfig[member][field] = field === 'entryDate' ? value : parseInt(value) || 0;
  renderVacCards();
  if (!isLoading) autoSave();
}

function getVacTakenForMember(member) {
  let total = 0;
  const currentYear = new Date().getFullYear();
  document.querySelectorAll('#vacacionesTable tbody tr').forEach(row => {
    const c    = row.querySelectorAll('td');
    const res  = c[1]?.querySelector('select')?.value;
    const from = c[2]?.querySelector('input')?.value;
    const tipo = c[5]?.querySelector('select')?.value || '';
    if (res !== member || !from) return;
    if (new Date(from + 'T12:00:00').getFullYear() !== currentYear) return;
    if (tipo === 'Leave / Absence') return;
    total += parseInt(c[4]?.querySelector('input')?.value) || 0;
  });
  return total;
}

function addVacacionRow(data) {
  const d     = data || {};
  const tbody = document.querySelector('#vacacionesTable tbody');
  const n     = tbody.querySelectorAll('tr').length + 1;
  const selMem = MEMBERS.map(m =>
    '<option value="' + m + '"' + (m === (d.col_1 || 'Octavio') ? ' selected' : '') + '>' + m + '</option>'
  ).join('');
  const TIPOS_VAC = ['Vacation', 'Leave / Absence', 'Personal Day'];
  const selTipo = TIPOS_VAC.map(t =>
    '<option value="' + t + '"' + (t === (d.col_5 || 'Vacation') ? ' selected' : '') + '>' + t + '</option>'
  ).join('');

  const from = d.col_2 || '';
  const to   = d.col_3 || '';
  const days = d.col_4 !== undefined ? d.col_4 : (from && to ? calcBusinessDays(from, to) : 0);

  const tr = document.createElement('tr');
  tr.innerHTML =
    '<td class="col-num" style="color:var(--gray-400);font-size:12px;">' + n + '</td>' +
    '<td><select class="cell-select" onchange="renderVacCards()">' + selMem + '</select></td>' +
    '<td><input type="date" class="cell-input narrow-date" value="' + from + '" onchange="calcVacRow(this);renderVacCards()"></td>' +
    '<td><input type="date" class="cell-input narrow-date" value="' + to   + '" onchange="calcVacRow(this);renderVacCards()"></td>' +
    '<td><input type="number" class="cell-input num" value="' + days + '" min="0" onchange="renderVacCards()" title="Business days (editable)"></td>' +
    '<td><select class="cell-select" onchange="renderVacCards()">' + selTipo + '</select></td>' +
    '<td><input class="cell-input" value="' + htmlEsc(d.col_6 || '') + '" placeholder="Notes..."></td>' +
    '<td class="col-action"><button class="btn-del" onclick="deleteVacRow(this)">✕</button></td>';
  tbody.appendChild(tr);
  if (!isLoading) { renderVacCards(); autoSave(); }
}

function calcVacRow(input) {
  const row  = input.closest('tr');
  const c    = row.querySelectorAll('td');
  const from = c[2]?.querySelector('input')?.value;
  const to   = c[3]?.querySelector('input')?.value;
  if (from && to) {
    const daysInput = c[4]?.querySelector('input');
    if (daysInput) daysInput.value = calcBusinessDays(from, to);
  }
}

function deleteVacRow(btn) {
  btn.closest('tr')?.remove();
  renderVacCards();
  if (!isLoading) autoSave();
}

function calcBusinessDays(fromStr, toStr) {
  const from = new Date(fromStr + 'T12:00:00');
  const to   = new Date(toStr   + 'T12:00:00');
  if (from > to) return 0;
  let count = 0;
  const cur = new Date(from);
  while (cur <= to) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function renderVacacionesTable() { /* rows restored from storage */ }

// ==============================================
// ===== PATCH getCurrentData & populateAll =====
// ==============================================

// Override getCurrentData to include new tabs
const _origGetCurrentData = getCurrentData;
getCurrentData = function() {
  const base = _origGetCurrentData();
  base.pagos      = extractTableData('pagosTable');
  base.vacaciones = extractTableData('vacacionesTable');
  base.vacConfig  = JSON.parse(JSON.stringify(vacConfig));
  return base;
};

// Override populateAll to restore new tabs
const _origPopulateAll = populateAll;
populateAll = function(data) {
  _origPopulateAll(data);
  if (data.pagos) {
    const tbody = document.querySelector('#pagosTable tbody');
    if (tbody) tbody.querySelectorAll('tr:not(.total-row)').forEach(r => r.remove());
    (data.pagos || []).forEach(r => addPagoRow(r));
  }
  if (data.vacaciones) {
    const tbody = document.querySelector('#vacacionesTable tbody');
    if (tbody) tbody.querySelectorAll('tr').forEach(r => r.remove());
    (data.vacaciones || []).forEach(r => addVacacionRow(r));
  }
  if (data.vacConfig) vacConfig = { ...JSON.parse(JSON.stringify(DEFAULT_VAC_CONFIG)), ...data.vacConfig };
  setTimeout(() => {
    updatePagos();
    refreshPagoProjectDropdowns();
    renderVacCards();
  }, 100);
};

// Hook ongoing updates to also refresh pagos dropdowns
const _origUpdateOngoing = updateOngoing;
updateOngoing = function() {
  _origUpdateOngoing();
  refreshPagoProjectDropdowns();
  refreshOngoingProjectDropdowns();
};

// Init vacaciones on DOMContentLoaded supplement
document.addEventListener('DOMContentLoaded', () => {
  renderVacCards();
  // Hook utilization tab switch to also init vac tab if needed
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.tab === 'vacaciones') renderVacCards();
      if (btn.dataset.tab === 'pagos') { updatePagos(); refreshPagoProjectDropdowns(); }
    });
  });
});

// ==============================================
// ===== EXPENSES ===============================
// ==============================================

const EXP_CATEGORIES = [
  'Transportation',
  'Accommodation',
  'Meals & Entertainment',
  'Office Supplies',
  'Software & Subscriptions',
  'Printing & Materials',
  'Communications',
  'Training & Conferences',
  'Business Development',
  'Other',
];

const RECEIPT_STATUS = ['Submitted', 'Pending', 'Missing'];

let expData  = {};        // expData[year-month] = array of row objects
let currentExpMonth = new Date().getMonth();
let currentExpYear  = new Date().getFullYear();

// ---- INIT ----
function initExpenses() {
  currentExpMonth = new Date().getMonth();
  currentExpYear  = new Date().getFullYear();
  renderExpMonthTabs();
  renderExpTable();
  renderExpSummaryBar();
  renderExpYTD();
}

function renderExpMonthTabs() {
  const container = document.getElementById('expMonthTabsRow');
  if (!container) return;
  container.innerHTML = MONTHS.map((m, i) =>
    '<button class="month-tab' + (i === currentExpMonth ? ' active' : '') +
    '" onclick="switchExpMonth(' + i + ')">' + m + '</button>'
  ).join('');
}

function switchExpMonth(idx) {
  currentExpMonth = idx;
  renderExpMonthTabs();
  renderExpTable();
  renderExpSummaryBar();
}

// ---- TABLE ----
function renderExpTable() {
  const label = document.getElementById('expMonthLabel');
  if (label) label.textContent = 'Expenses — ' + MONTHS[currentExpMonth] + ' ' + currentExpYear;

  // Clear existing data rows
  const tbody    = document.querySelector('#expensesTable tbody');
  const totalRow = tbody.querySelector('.total-row');
  tbody.querySelectorAll('tr:not(.total-row)').forEach(r => r.remove());

  // Reload from expData
  const monthKey = currentExpYear + '-' + currentExpMonth;
  (expData[monthKey] || []).forEach(r => addExpenseRow(r));
  updateExpTotals();
}

function addExpenseRow(data) {
  const d        = data || {};
  const tbody    = document.querySelector('#expensesTable tbody');
  if (!tbody) return;
  const totalRow = tbody.querySelector('.total-row');
  const n        = tbody.querySelectorAll('tr:not(.total-row)').length + 1;

  const selMember = MEMBERS.map(m =>
    '<option value="' + m + '"' + (m === (d.member || 'Octavio') ? ' selected' : '') + '>' + m + '</option>'
  ).join('');

  const selCat = EXP_CATEGORIES.map(c =>
    '<option value="' + c + '"' + (c === (d.category || 'Business Development') ? ' selected' : '') + '>' + c + '</option>'
  ).join('');

  // Project dropdown: ongoing projects + BD as first/default
  const projects = getOngoingProjectNames();
  const selProj  = '<option value="BD" ' + (!d.project || d.project === 'BD' ? 'selected' : '') + '>BD — Business Development</option>' +
    projects.map(p => '<option value="' + htmlEsc(p) + '"' + (p === d.project ? ' selected' : '') + '>' + htmlEsc(p) + '</option>').join('');

  const selReceipt = RECEIPT_STATUS.map(s =>
    '<option value="' + s + '"' + (s === (d.receipt || 'Pending') ? ' selected' : '') + '>' + s + '</option>'
  ).join('');

  const tr = document.createElement('tr');
  tr.innerHTML =
    '<td class="col-num" style="color:var(--gray-400);font-size:12px;">' + n + '</td>' +
    '<td><select class="cell-select exp-member-sel" onchange="saveExpRow(this)">' + selMember + '</select></td>' +
    '<td><input type="date" class="cell-input narrow-date" value="' + (d.date || todayISO()) + '" onchange="saveExpRow(this)"></td>' +
    '<td><select class="cell-select exp-cat-sel" onchange="saveExpRow(this)">' + selCat + '</select></td>' +
    '<td><select class="cell-select exp-proj-sel" onchange="saveExpRow(this)">' + selProj + '</select></td>' +
    '<td><input class="cell-input" value="' + htmlEsc(d.vendor || '') + '" placeholder="Vendor / description" style="min-width:160px" onchange="saveExpRow(this)"></td>' +
    '<td><input type="number" class="cell-input num exp-amount" value="' + (d.amount || 0) + '" min="0" step="0.01" onchange="saveExpRow(this)"></td>' +
    '<td><select class="cell-select exp-receipt-sel" onchange="styleReceiptSel(this);saveExpRow(this)">' + selReceipt + '</select></td>' +
    '<td><input class="cell-input" value="' + htmlEsc(d.notes || '') + '" placeholder="Notes..." style="min-width:120px" onchange="saveExpRow(this)"></td>' +
    '<td class="col-action"><button class="btn-del" onclick="deleteExpRow(this)">✕</button></td>';
  tbody.insertBefore(tr, totalRow);

  // Style receipt on load
  styleReceiptSel(tr.querySelector('.exp-receipt-sel'));
  if (!isLoading) { saveExpRow(tr.querySelector('.exp-amount')); }
}

function styleReceiptSel(sel) {
  if (!sel) return;
  const v = sel.value;
  if (v === 'Submitted')    { sel.style.color = '#15803d'; sel.style.fontWeight = '600'; }
  else if (v === 'Pending') { sel.style.color = '#b45309'; sel.style.fontWeight = '500'; }
  else if (v === 'Missing') { sel.style.color = '#dc2626'; sel.style.fontWeight = '700'; }
  else { sel.style.color = ''; sel.style.fontWeight = ''; }
}

function saveExpRow(el) {
  // Serialize all rows of current month back to expData
  const monthKey = currentExpYear + '-' + currentExpMonth;
  const tbody    = document.querySelector('#expensesTable tbody');
  if (!tbody) return;
  const rows = [];
  tbody.querySelectorAll('tr:not(.total-row)').forEach(row => {
    const c = row.querySelectorAll('td');
    rows.push({
      member:   c[1]?.querySelector('select')?.value  || '',
      date:     c[2]?.querySelector('input')?.value   || '',
      category: c[3]?.querySelector('select')?.value  || '',
      project:  c[4]?.querySelector('select')?.value  || 'BD',
      vendor:   c[5]?.querySelector('input')?.value   || '',
      amount:   parseFloat(c[6]?.querySelector('input')?.value)  || 0,
      receipt:  c[7]?.querySelector('select')?.value  || 'Pending',
      notes:    c[8]?.querySelector('input')?.value   || '',
    });
  });
  expData[monthKey] = rows;
  updateExpTotals();
  renderExpSummaryBar();
  renderExpYTD();
  if (!isLoading) autoSave();
}

function deleteExpRow(btn) {
  btn.closest('tr')?.remove();
  renumberExpRows();
  saveExpRow(btn); // triggers re-serialize
}

function renumberExpRows() {
  document.querySelectorAll('#expensesTable tbody tr:not(.total-row)').forEach((row, i) => {
    row.querySelector('td').textContent = i + 1;
  });
}

function updateExpTotals() {
  let total = 0;
  document.querySelectorAll('#expensesTable tbody tr:not(.total-row)').forEach(row => {
    total += parseFloat(row.querySelectorAll('td')[6]?.querySelector('input')?.value) || 0;
  });
  setText('expTotalMonth', '$' + total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
}

// ---- SUMMARY BAR (current month by member) ----
function renderExpSummaryBar() {
  const container = document.getElementById('expSummaryBar');
  if (!container) return;
  const monthKey  = currentExpYear + '-' + currentExpMonth;
  const rows      = expData[monthKey] || [];

  const memberTotals = {};
  MEMBERS.forEach(m => { memberTotals[m] = { amount: 0, count: 0 }; });
  let grandTotal = 0, grandCount = 0;

  rows.forEach(r => {
    if (memberTotals[r.member]) {
      memberTotals[r.member].amount += r.amount;
      memberTotals[r.member].count++;
    }
    grandTotal += r.amount;
    grandCount++;
  });

  const fmt = n => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  container.innerHTML = MEMBERS.map(m =>
    '<div class="exp-summary-card">' +
      '<span class="exp-summary-label">' + m + '</span>' +
      '<span class="exp-summary-amount">' + fmt(memberTotals[m].amount) + '</span>' +
      '<span class="exp-summary-count">' + memberTotals[m].count + ' item' + (memberTotals[m].count !== 1 ? 's' : '') + '</span>' +
    '</div>'
  ).join('') +
  '<div class="exp-summary-card total-card">' +
    '<span class="exp-summary-label">Month Total</span>' +
    '<span class="exp-summary-amount">' + fmt(grandTotal) + '</span>' +
    '<span class="exp-summary-count">' + grandCount + ' items · ' + MONTHS[currentExpMonth] + '</span>' +
  '</div>';
}

// ---- YTD GRID ----
function renderExpYTD() {
  const container = document.getElementById('expYTDGrid');
  if (!container) return;

  // Aggregate all months this year per member + category
  const memberStats = {};
  MEMBERS.forEach(m => { memberStats[m] = { total: 0, byCategory: {}, byProject: {} }; });

  Object.keys(expData).forEach(monthKey => {
    const parts = monthKey.split('-');
    if (parseInt(parts[0]) !== currentExpYear) return;
    (expData[monthKey] || []).forEach(r => {
      if (!memberStats[r.member]) return;
      const amt = r.amount || 0;
      memberStats[r.member].total += amt;
      // by category
      if (!memberStats[r.member].byCategory[r.category]) memberStats[r.member].byCategory[r.category] = 0;
      memberStats[r.member].byCategory[r.category] += amt;
      // by project
      const proj = r.project || 'BD';
      if (!memberStats[r.member].byProject[proj]) memberStats[r.member].byProject[proj] = 0;
      memberStats[r.member].byProject[proj] += amt;
    });
  });

  const fmt = n => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  container.innerHTML = MEMBERS.map(m => {
    const s = memberStats[m];
    const topCats = Object.entries(s.byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    const topProjs = Object.entries(s.byProject)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const catRows = topCats.map(([cat, amt]) =>
      '<div class="exp-ytd-row"><span>' + cat + '</span><span>' + fmt(amt) + '</span></div>'
    ).join('') || '<div class="exp-ytd-row" style="color:var(--gray-400);font-style:italic"><span>No expenses yet</span></div>';

    const projRows = topProjs.map(([proj, amt]) =>
      '<div class="exp-ytd-row"><span>' + proj + '</span><span>' + fmt(amt) + '</span></div>'
    ).join('');

    return '<div class="exp-ytd-card">' +
      '<div class="exp-ytd-name">' + m + '</div>' +
      '<div class="exp-ytd-total">' + fmt(s.total) + ' <small style="font-size:11px;color:var(--gray-400);font-weight:400">YTD</small></div>' +
      '<div class="exp-ytd-breakdown">' +
        '<div style="font-size:10px;font-weight:700;color:var(--gray-400);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">By Category</div>' +
        catRows +
        (projRows ? '<div style="font-size:10px;font-weight:700;color:var(--gray-400);text-transform:uppercase;letter-spacing:.06em;margin:8px 0 4px">By Project</div>' + projRows : '') +
      '</div>' +
    '</div>';
  }).join('');
}

// ---- REFRESH PROJECT DROPDOWNS IN EXPENSES ----
function refreshExpProjectDropdowns() {
  const projects = getOngoingProjectNames();
  document.querySelectorAll('.exp-proj-sel').forEach(sel => {
    const current = sel.value;
    sel.innerHTML = '<option value="BD"' + (current === 'BD' || !current ? ' selected' : '') + '>BD — Business Development</option>' +
      projects.map(p => '<option value="' + htmlEsc(p) + '"' + (p === current ? ' selected' : '') + '>' + htmlEsc(p) + '</option>').join('') +
      (current && current !== 'BD' && !projects.includes(current) ? '<option value="' + htmlEsc(current) + '" selected>' + htmlEsc(current) + ' (removed)</option>' : '');
  });
}

// ---- CSV EXPORT ----
function exportExpensesCSV() {
  let csv = '\uFEFFUrban Analytics Mexico — Expenses Export\nGenerated: ' + new Date().toLocaleString('es-MX') + '\n\n';

  MONTHS.forEach((m, mi) => {
    const monthKey = currentExpYear + '-' + mi;
    const rows     = expData[monthKey] || [];
    if (!rows.length) return;
    csv += m + ' ' + currentExpYear + '\n';
    csv += 'Staff Member,Date,Category,Project,Vendor / Description,Amount (USD),Receipt,Notes\n';
    let monthTotal = 0;
    rows.forEach(r => {
      monthTotal += r.amount || 0;
      csv += '"' + esc(r.member) + '","' + (r.date||'') + '","' + esc(r.category) + '","' +
        esc(r.project) + '","' + esc(r.vendor) + '",' + (r.amount||0) + ',"' +
        esc(r.receipt) + '","' + esc(r.notes) + '"\n';
    });
    csv += 'MONTH TOTAL,,,,,' + monthTotal.toFixed(2) + ',,\n\n';
  });

  // YTD summary
  csv += 'YEAR-TO-DATE SUMMARY BY STAFF MEMBER\nStaff,Category,Total (USD)\n';
  const ytd = {};
  MEMBERS.forEach(m => { ytd[m] = {}; });
  Object.keys(expData).forEach(mk => {
    const parts = mk.split('-');
    if (parseInt(parts[0]) !== currentExpYear) return;
    (expData[mk] || []).forEach(r => {
      if (!ytd[r.member]) return;
      if (!ytd[r.member][r.category]) ytd[r.member][r.category] = 0;
      ytd[r.member][r.category] += r.amount || 0;
    });
  });
  MEMBERS.forEach(m => {
    Object.entries(ytd[m]).forEach(([cat, amt]) => {
      csv += '"' + m + '","' + cat + '",' + amt.toFixed(2) + '\n';
    });
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'UA_MX_Expenses_' + currentExpYear + '_' + new Date().toISOString().split('T')[0] + '.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  showToast('Expenses CSV exported ✓', 'success');
}

// ---- HELPERS ----
function todayISO() { return new Date().toISOString().split('T')[0]; }

// ---- PATCH getCurrentData & populateAll ----
const _origGetDataExp = getCurrentData;
getCurrentData = function() {
  const base = _origGetDataExp();
  base.expenses = expData;
  return base;
};

const _origPopulateExp = populateAll;
populateAll = function(data) {
  _origPopulateExp(data);
  if (data.expenses) {
    expData = data.expenses;
    renderExpTable();
    renderExpSummaryBar();
    renderExpYTD();
  }
};

// Patch updateOngoing to also refresh expense project dropdowns
const _origUpdateOngoingExp = updateOngoing;
updateOngoing = function() {
  _origUpdateOngoingExp();
  refreshExpProjectDropdowns();
};

// Init on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  initExpenses();
  // Hook tab switch
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.tab === 'expenses') {
        renderExpMonthTabs();
        renderExpTable();
        renderExpSummaryBar();
        renderExpYTD();
      }
    });
  });
});
