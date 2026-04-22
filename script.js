/* =============================================
   URBAN ANALYTICS MEXICO — script.js
   Google Sheets webhook integration + local history
   ============================================= */

'use strict';

// ===== CONFIG =====
const CONFIG = {
  TARGET: 380000,
  WEBHOOK_URL: 'https://script.google.com/macros/s/AKfycbwatNhtMxATY02zjSYpkI8TeB7dNPTa0-gPaKtjH9Afp8siiAJSXYmw_IAeW08Jyxmy/exec', // Set your Google Apps Script Web App URL here
  TOKEN: 'UA-MX-2026-SEC', // Security token — change this
  MAX_HISTORY: 20,
  STORAGE_KEY: 'ua_mx_dashboard_v2',
  HISTORY_KEY: 'ua_mx_history_v2',
};

// Members list
const MEMBERS = ['Octavio', 'Roberto', 'Noé', 'Ricardo'];
const TOPICS = ['AI', 'Demand Modeling', 'BigData', 'Urban Analytics', 'Financial Modeling', 'Transport', 'Other'];
const MOTIVES = ['Price', 'Technical', 'Price/Technical', 'Deadline', 'Corruption', 'Lack of Funds', 'Political Environment', 'Client Stepback', 'Administrative Issues', 'Decided not to go', 'Others'];

let isLoading = false;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setDefaultWeek();
  loadFromStorage();
  updateProgress();
  calcScore();
  setTimeout(() => { isLoading = false; }, 200);
});

// ===== TABS =====
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${target}`).classList.add('active');
    });
  });
}

// ===== DATE =====
function setDefaultWeek() {
  const el = document.getElementById('utilizationWeek');
  if (el) {
    const d = new Date();
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    el.value = monday.toISOString().split('T')[0];
  }
}

// ===== STORAGE =====
function saveToStorage(data) {
  try {
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
  } catch (e) { console.warn('LocalStorage write failed:', e); }
}

function loadFromStorage() {
  isLoading = true;
  try {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
    if (!raw) { isLoading = false; return; }
    const data = JSON.parse(raw);
    populateAll(data);
  } catch (e) {
    console.warn('Failed to load saved data:', e);
  }
  setTimeout(() => { isLoading = false; }, 100);
}

function getCurrentData() {
  return {
    timestamp: new Date().toISOString(),
    pipeline: extractTableData('pipelineTable'),
    eoi: extractTableData('eoiTable'),
    ongoing: extractTableData('ongoingTable'),
    lost: extractTableData('lostTable'),
    utilization: extractTableData('utilizationTable'),
    gongo: {
      name: document.getElementById('opportunityName')?.value || '',
      rows: Array.from(document.querySelectorAll('.gongo-row')).map(row => ({
        weight: row.querySelector('.weight-input')?.value || '',
        score: row.querySelector('.score-input')?.value || '',
      }))
    },
    utilizationWeek: document.getElementById('utilizationWeek')?.value || ''
  };
}

function extractTableData(tableId) {
  const rows = [];
  document.querySelectorAll(`#${tableId} tbody tr:not(.total-row)`).forEach(row => {
    const rowData = {};
    row.querySelectorAll('td').forEach((td, i) => {
      const input = td.querySelector('input, select');
      rowData[`col_${i}`] = input ? input.value : td.textContent.trim();
    });
    rows.push(rowData);
  });
  return rows;
}

function populateAll(data) {
  if (!data) return;
  if (data.pipeline) restoreTable('pipelineTable', data.pipeline, addPipelineRow, true);
  if (data.eoi) restoreTable('eoiTable', data.eoi, addEOIRow, false);
  if (data.ongoing) restoreTable('ongoingTable', data.ongoing, addOngoingRow, true);
  if (data.lost) restoreTable('lostTable', data.lost, addLostRow, true);
  if (data.utilization) restoreTable('utilizationTable', data.utilization, addUtilizationRow, false);
  if (data.utilizationWeek) {
    const el = document.getElementById('utilizationWeek');
    if (el) el.value = data.utilizationWeek;
  }
  if (data.gongo) {
    const nameEl = document.getElementById('opportunityName');
    if (nameEl) nameEl.value = data.gongo.name || '';
    const gongoRows = document.querySelectorAll('.gongo-row');
    if (data.gongo.rows) {
      data.gongo.rows.forEach((r, i) => {
        if (gongoRows[i]) {
          const wi = gongoRows[i].querySelector('.weight-input');
          const si = gongoRows[i].querySelector('.score-input');
          if (wi) wi.value = r.weight;
          if (si) si.value = r.score;
        }
      });
    }
    calcScore();
  }
  setTimeout(() => {
    updatePipeline();
    updateOngoing();
    updateLost();
    updateUtilization();
    updateProgress();
  }, 50);
}

function restoreTable(tableId, rows, addFn, hasTotal) {
  // Clear existing data rows
  const tbody = document.querySelector(`#${tableId} tbody`);
  if (!tbody) return;
  const existingRows = tbody.querySelectorAll('tr:not(.total-row)');
  existingRows.forEach(r => r.remove());

  // Add rows from data
  rows.forEach(rowData => {
    addFn(rowData);
  });
}

// ===== SAVE =====
async function saveData() {
  const data = getCurrentData();
  saveToStorage(data);
  addToHistory(data);
  updateSyncStatus('saving');

  if (CONFIG.WEBHOOK_URL) {
    try {
      const payload = {
        token: CONFIG.TOKEN,
        timestamp: data.timestamp,
        data: data
      };
      const res = await fetch(CONFIG.WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'no-cors'
      });
      updateSyncStatus('synced');
      showToast('Data saved and synced to Google Sheets ✓', 'success');
    } catch (e) {
      updateSyncStatus('error');
      showToast('Saved locally. Webhook unreachable.', 'error');
    }
  } else {
    updateSyncStatus('synced');
    showToast('Saved locally. Configure WEBHOOK_URL to sync.', 'success');
  }
}

function updateSyncStatus(state) {
  const pill = document.getElementById('syncStatus');
  const txt = document.getElementById('statusText');
  if (!pill || !txt) return;
  pill.className = 'status-pill';
  if (state === 'saving') { pill.classList.add('saving'); txt.textContent = 'Saving…'; }
  else if (state === 'synced') { txt.textContent = 'Synced'; }
  else if (state === 'error') { pill.classList.add('error'); txt.textContent = 'Sync error'; }
}

// ===== HISTORY =====
function addToHistory(data) {
  try {
    const raw = localStorage.getItem(CONFIG.HISTORY_KEY);
    const history = raw ? JSON.parse(raw) : [];
    history.unshift({ timestamp: data.timestamp, snapshot: data });
    if (history.length > CONFIG.MAX_HISTORY) history.length = CONFIG.MAX_HISTORY;
    localStorage.setItem(CONFIG.HISTORY_KEY, JSON.stringify(history));
  } catch (e) { console.warn('History write failed:', e); }
}

function showHistory() {
  const modal = document.getElementById('historyModal');
  const list = document.getElementById('historyList');
  if (!modal || !list) return;

  try {
    const raw = localStorage.getItem(CONFIG.HISTORY_KEY);
    const history = raw ? JSON.parse(raw) : [];
    if (history.length === 0) {
      list.innerHTML = '<p class="empty-state">No saves yet. Click Save to start building history.</p>';
    } else {
      list.innerHTML = history.map((h, i) => {
        const d = new Date(h.timestamp);
        const dateStr = d.toLocaleDateString('en-MX', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = d.toLocaleTimeString('en-MX', { hour: '2-digit', minute: '2-digit' });
        const pipeCount = (h.snapshot.pipeline || []).length;
        const ongoingCount = (h.snapshot.ongoing || []).length;
        return `
          <div class="history-item" onclick="restoreFromHistory(${i})">
            <div class="history-item-date">${dateStr} · ${timeStr}</div>
            <div class="history-item-meta">${pipeCount} proposals · ${ongoingCount} ongoing projects</div>
            <span class="history-item-badge">${i === 0 ? 'Latest' : `Save #${history.length - i}`}</span>
          </div>`;
      }).join('');
    }
  } catch (e) {
    list.innerHTML = '<p class="empty-state">Could not load history.</p>';
  }

  modal.classList.add('open');
}

function restoreFromHistory(index) {
  try {
    const raw = localStorage.getItem(CONFIG.HISTORY_KEY);
    const history = raw ? JSON.parse(raw) : [];
    if (!history[index]) return;
    if (!confirm('Restore this saved state? Current unsaved changes will be lost.')) return;
    isLoading = true;
    populateAll(history[index].snapshot);
    closeHistoryModal();
    showToast('State restored from history ✓', 'success');
  } catch (e) {
    showToast('Failed to restore state.', 'error');
  }
}

function closeHistoryModal() {
  document.getElementById('historyModal')?.classList.remove('open');
}

function closeModal(e) {
  if (e.target.id === 'historyModal') closeHistoryModal();
}

// ===== TOAST =====
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => { t.className = 'toast'; }, 3500);
}

// ===== PROGRESS BAR =====
function getOngoingUAFees(statusFilter = null) {
  let total = 0;
  document.querySelectorAll('#ongoingTable tbody tr:not(.total-row)').forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 8) return;
    const uaInput = cells[6].querySelector('input');
    const statusSel = cells[7].querySelector('select');
    const val = parseFloat(uaInput?.value) || 0;
    if (!statusFilter || (statusSel && statusSel.value === statusFilter)) total += val;
  });
  return total;
}

function getPipelineWeighted() {
  let total = 0;
  document.querySelectorAll('#pipelineTable tbody tr:not(.total-row)').forEach(row => {
    const amt = parseFloat(row.querySelector('.amt-input')?.value) || 0;
    const prob = parseFloat(row.querySelector('.prob-input')?.value) || 0;
    total += (amt * prob) / 100;
  });
  return total;
}

function updateProgress() {
  const exercised = getOngoingUAFees('Completed');
  const backlog = getOngoingUAFees('In Progress');
  const potential = getPipelineWeighted();
  const target = CONFIG.TARGET;
  const total = exercised + backlog + potential;
  const remaining = Math.max(0, target - total);

  // Update metric displays
  const fmt = n => '$' + Math.round(n).toLocaleString('en-US');
  setText('exercisedAmount', fmt(exercised));
  setText('backlogAmount', fmt(backlog));
  setText('potentialAmount', fmt(potential));
  const gap = target - total;
  const gapEl = document.getElementById('gapAmount');
  if (gapEl) {
    gapEl.textContent = (gap < 0 ? '-' : '') + '$' + Math.abs(Math.round(gap)).toLocaleString('en-US');
    gapEl.className = `metric-value ${gap <= 0 ? 'green' : ''}`;
  }

  // Progress bar
  const pct = v => Math.min((v / target) * 100, 100).toFixed(2) + '%';
  setStyle('progExercised', 'width', pct(exercised));
  setStyle('progBacklog', 'width', pct(backlog));
  setStyle('progPotential', 'width', pct(potential));
  setStyle('progRemaining', 'width', pct(remaining));

  // Month needle
  const now = new Date();
  const monthPct = ((now.getMonth() + (now.getDate() / 31)) / 12 * 100).toFixed(2);
  setStyle('progressNeedle', 'left', monthPct + '%');
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function setStyle(id, prop, val) {
  const el = document.getElementById(id);
  if (el) el.style[prop] = val;
}

// ===== PIPELINE TABLE =====
function addPipelineRow(data = null) {
  const tbody = document.querySelector('#pipelineTable tbody');
  const totalRow = tbody.querySelector('.total-row');
  const n = tbody.querySelectorAll('tr:not(.total-row)').length + 1;
  const tr = document.createElement('tr');
  const d = data || {};

  const selOpts = (opts, val) => opts.map(o => `<option value="${o}" ${o === val ? 'selected' : ''}>${o}</option>`).join('');

  tr.innerHTML = `
    <td class="col-num" style="color:var(--gray-400);font-size:12px;">${n}</td>
    <td><input class="cell-input" value="${d.col_1 || 'New Project'}" onchange="updatePipeline()"></td>
    <td><select class="cell-select">${selOpts(TOPICS, d.col_2 || 'Urban Analytics')}</select></td>
    <td><input class="cell-input" value="${d.col_3 || 'Client'}" onchange="updatePipeline()"></td>
    <td><select class="cell-select">${selOpts(MEMBERS, d.col_4 || 'Octavio')}</select></td>
    <td><select class="cell-select"><option value="None" ${!d.col_5 || d.col_5 === 'None' ? 'selected' : ''}>None</option>${selOpts(MEMBERS, d.col_5)}</select></td>
    <td><input type="date" class="cell-input narrow-date" value="${d.col_6 || '2026-12-31'}" onchange="updatePipeline()"></td>
    <td><input type="number" class="cell-input num amt-input" value="${d.col_7 || 0}" onchange="updatePipeline()"></td>
    <td><input type="number" class="cell-input num prob-input" value="${d.col_8 || 0}" min="0" max="100" onchange="updatePipeline()"></td>
    <td class="col-num" style="font-family:var(--mono);font-size:12px;" id="wv${n}">$0</td>
    <td class="col-action"><button class="btn-del" onclick="deleteRow(this, updatePipeline)">✕</button></td>
  `;
  tbody.insertBefore(tr, totalRow);
  if (!isLoading) updatePipeline();
}

function updatePipeline() {
  let totalAmt = 0, totalW = 0;
  document.querySelectorAll('#pipelineTable tbody tr:not(.total-row)').forEach((row, i) => {
    const amt = parseFloat(row.querySelector('.amt-input')?.value) || 0;
    const prob = parseFloat(row.querySelector('.prob-input')?.value) || 0;
    const w = (amt * prob) / 100;
    const wCell = row.querySelectorAll('td')[9];
    if (wCell) wCell.textContent = '$' + Math.round(w).toLocaleString('en-US');
    totalAmt += amt;
    totalW += w;
    // renumber
    const numCell = row.querySelector('td');
    if (numCell) numCell.textContent = i + 1;
  });
  setText('totalPipeline', '$' + Math.round(totalAmt).toLocaleString('en-US'));
  setText('totalWeighted', '$' + Math.round(totalW).toLocaleString('en-US'));
  updatePipelineLeadSummary();
  updateProgress();
  if (!isLoading) autoSave();
}

function updatePipelineLeadSummary() {
  const stats = {};
  MEMBERS.forEach(m => { stats[m] = { lead: 0, support: 0 }; });
  document.querySelectorAll('#pipelineTable tbody tr:not(.total-row)').forEach(row => {
    const cells = row.querySelectorAll('td');
    const lead = cells[4]?.querySelector('select')?.value;
    const support = cells[5]?.querySelector('select')?.value;
    if (lead && stats[lead]) stats[lead].lead++;
    if (support && support !== 'None' && stats[support]) stats[support].support++;
  });
  const container = document.getElementById('pipelineLeadSummary');
  if (!container) return;
  container.innerHTML = MEMBERS.map(m => `
    <div class="summary-card">
      <div class="summary-card-name">${m}</div>
      <div class="summary-card-stats">${stats[m].lead} Lead · ${stats[m].support} Support</div>
      <div class="summary-card-total">${stats[m].lead + stats[m].support} total opps</div>
    </div>`).join('');
}

// ===== EOI TABLE =====
function addEOIRow(data = null) {
  const tbody = document.querySelector('#eoiTable tbody');
  const n = tbody.querySelectorAll('tr').length + 1;
  const tr = document.createElement('tr');
  const d = data || {};
  const selOpts = (opts, val) => opts.map(o => `<option value="${o}" ${o === val ? 'selected' : ''}>${o}</option>`).join('');
  tr.innerHTML = `
    <td class="col-num" style="color:var(--gray-400);font-size:12px;">${n}</td>
    <td><input class="cell-input" value="${d.col_1 || 'New EOI'}"></td>
    <td><input class="cell-input" value="${d.col_2 || 'Client'}"></td>
    <td><select class="cell-select">${selOpts(MEMBERS, d.col_3 || 'Octavio')}</select></td>
    <td><select class="cell-select"><option value="None" ${!d.col_4 || d.col_4 === 'None' ? 'selected' : ''}>None</option>${selOpts(MEMBERS, d.col_4)}</select></td>
    <td><input type="date" class="cell-input narrow-date" value="${d.col_5 || '2026-12-31'}"></td>
    <td><input class="cell-input" value="${d.col_6 || ''}"></td>
    <td class="col-action"><button class="btn-del" onclick="deleteRow(this)">✕</button></td>
  `;
  tbody.appendChild(tr);
  if (!isLoading) autoSave();
}

// ===== ONGOING TABLE =====
function addOngoingRow(data = null) {
  const tbody = document.querySelector('#ongoingTable tbody');
  const totalRow = tbody.querySelector('.total-row');
  const n = tbody.querySelectorAll('tr:not(.total-row)').length + 1;
  const tr = document.createElement('tr');
  const d = data || {};
  const status = d.col_7 || 'In Progress';
  tr.innerHTML = `
    <td class="col-num" style="color:var(--gray-400);font-size:12px;">${n}</td>
    <td><input class="cell-input" value="${d.col_1 || 'New Project'}" onchange="updateOngoing()"></td>
    <td><input class="cell-input" value="${d.col_2 || 'Client'}" onchange="updateOngoing()"></td>
    <td><input type="date" class="cell-input narrow-date" value="${d.col_3 || '2026-12-31'}" onchange="updateOngoing()"></td>
    <td><input class="cell-input" value="${d.col_4 || 'BST001'}" style="font-family:var(--mono);width:90px;text-transform:uppercase"></td>
    <td><input type="number" class="cell-input num" value="${d.col_5 || 0}" onchange="updateOngoing()"></td>
    <td><input type="number" class="cell-input num ua-fee-input" value="${d.col_6 || 0}" onchange="updateOngoing()" style="color:var(--orange);font-weight:600"></td>
    <td>
      <select class="cell-select" onchange="updateOngoing()">
        <option value="In Progress" ${status === 'In Progress' ? 'selected' : ''}>In Progress</option>
        <option value="On Hold" ${status === 'On Hold' ? 'selected' : ''}>On Hold</option>
        <option value="Completed" ${status === 'Completed' ? 'selected' : ''}>Completed</option>
      </select>
    </td>
    <td class="col-action"><button class="btn-del" onclick="deleteRow(this, updateOngoing)">✕</button></td>
  `;
  tbody.insertBefore(tr, totalRow);
  if (!isLoading) updateOngoing();
}

function updateOngoing() {
  let totalFees = 0, totalUA = 0;
  document.querySelectorAll('#ongoingTable tbody tr:not(.total-row)').forEach((row, i) => {
    const cells = row.querySelectorAll('td');
    const fees = parseFloat(cells[5]?.querySelector('input')?.value) || 0;
    const ua = parseFloat(cells[6]?.querySelector('input')?.value) || 0;
    totalFees += fees;
    totalUA += ua;
    const numCell = cells[0];
    if (numCell) numCell.textContent = i + 1;
  });
  setText('totalProjectFees', '$' + Math.round(totalFees).toLocaleString('en-US'));
  setText('totalOngoing', '$' + Math.round(totalUA).toLocaleString('en-US'));
  updateProgress();
  if (!isLoading) autoSave();
}

// ===== LOST TABLE =====
function addLostRow(data = null) {
  const tbody = document.querySelector('#lostTable tbody');
  const totalRow = tbody.querySelector('.total-row');
  const n = tbody.querySelectorAll('tr:not(.total-row)').length + 1;
  const tr = document.createElement('tr');
  const d = data || {};
  const selOpts = (opts, val) => opts.map(o => `<option value="${o}" ${o === val ? 'selected' : ''}>${o}</option>`).join('');
  const motive = d.col_7 || 'Others';
  tr.innerHTML = `
    <td class="col-num" style="color:var(--gray-400);font-size:12px;">${n}</td>
    <td><input class="cell-input" value="${d.col_1 || 'Lost Project'}"></td>
    <td><input class="cell-input" value="${d.col_2 || 'Client'}"></td>
    <td><select class="cell-select">${selOpts(MEMBERS, d.col_3 || 'Octavio')}</select></td>
    <td><select class="cell-select"><option value="None" ${!d.col_4 || d.col_4 === 'None' ? 'selected' : ''}>None</option>${selOpts(MEMBERS, d.col_4)}</select></td>
    <td><input type="date" class="cell-input narrow-date" value="${d.col_5 || '2026-01-01'}"></td>
    <td><input type="number" class="cell-input num" value="${d.col_6 || 0}" onchange="updateLost()"></td>
    <td><select class="cell-select" onchange="updateLossAnalysis()">${selOpts(MOTIVES, motive)}</select></td>
    <td><input class="cell-input" value="${d.col_8 || ''}"></td>
    <td class="col-action"><button class="btn-del" onclick="deleteRow(this, updateLost)">✕</button></td>
  `;
  tbody.insertBefore(tr, totalRow);
  if (!isLoading) updateLost();
}

function updateLost() {
  let total = 0;
  document.querySelectorAll('#lostTable tbody tr:not(.total-row)').forEach((row, i) => {
    const cells = row.querySelectorAll('td');
    total += parseFloat(cells[6]?.querySelector('input')?.value) || 0;
    const numCell = cells[0];
    if (numCell) numCell.textContent = i + 1;
  });
  setText('totalLost', '$' + Math.round(total).toLocaleString('en-US'));
  updateLossAnalysis();
  if (!isLoading) autoSave();
}

function updateLossAnalysis() {
  const motives = {};
  let totalVal = 0;
  document.querySelectorAll('#lostTable tbody tr:not(.total-row)').forEach(row => {
    const cells = row.querySelectorAll('td');
    const m = cells[7]?.querySelector('select')?.value || 'Unknown';
    const v = parseFloat(cells[6]?.querySelector('input')?.value) || 0;
    if (!motives[m]) motives[m] = { count: 0, value: 0 };
    motives[m].count++;
    motives[m].value += v;
    totalVal += v;
  });
  const container = document.getElementById('lossAnalysis');
  if (!container) return;
  const entries = Object.entries(motives).sort((a, b) => b[1].value - a[1].value);
  if (!entries.length) { container.innerHTML = ''; return; }
  container.innerHTML = entries.map(([m, s]) => {
    const pct = totalVal > 0 ? ((s.value / totalVal) * 100).toFixed(1) : '0';
    return `<div class="summary-card" style="border-left-color:var(--red)">
      <div class="summary-card-name" style="color:var(--red)">${m}</div>
      <div class="summary-card-stats">${s.count} opp${s.count !== 1 ? 's' : ''} · ${pct}%</div>
      <div class="summary-card-total">$${s.value.toLocaleString('en-US')}</div>
    </div>`;
  }).join('');
}

// ===== UTILIZATION TABLE =====
function addUtilizationRow(data = null) {
  const tbody = document.querySelector('#utilizationTable tbody');
  const totalRow = tbody.querySelector('.total-row');
  const n = tbody.querySelectorAll('tr:not(.total-row)').length + 1;
  const tr = document.createElement('tr');
  const d = data || {};
  const selOpts = (opts, val) => opts.map(o => `<option value="${o}" ${o === val ? 'selected' : ''}>${o}</option>`).join('');
  tr.innerHTML = `
    <td class="col-num" style="color:var(--gray-400);font-size:12px;">${n}</td>
    <td><select class="cell-select util-sel">${selOpts(MEMBERS, d.col_1 || 'Octavio')}</select></td>
    <td><input class="cell-input" value="${d.col_2 || 'Project Name'}" onchange="updateUtilization()"></td>
    <td><input type="number" class="cell-input num util-hours" value="${d.col_3 || 0}" min="0" onchange="updateUtilization()"></td>
    <td><input type="number" class="cell-input num util-rate" value="${d.col_4 || 150}" min="0" onchange="updateUtilization()"></td>
    <td><input type="number" class="cell-input num util-mult" value="${d.col_5 || 1}" min="0" step="0.1" onchange="updateUtilization()"></td>
    <td class="col-num util-bill" style="font-family:var(--mono);font-size:12px;font-weight:600;color:var(--orange)">$0</td>
    <td class="col-action"><button class="btn-del" onclick="deleteRow(this, updateUtilization)">✕</button></td>
  `;
  tbody.insertBefore(tr, totalRow);
  if (!isLoading) updateUtilization();
}

function updateUtilization() {
  let totalBill = 0;
  const resourceTotals = {};
  document.querySelectorAll('#utilizationTable tbody tr:not(.total-row)').forEach((row, i) => {
    const cells = row.querySelectorAll('td');
    const resource = cells[1]?.querySelector('select')?.value || '';
    const hours = parseFloat(cells[3]?.querySelector('input')?.value) || 0;
    const rate = parseFloat(cells[4]?.querySelector('input')?.value) || 0;
    const mult = parseFloat(cells[5]?.querySelector('input')?.value) || 1;
    const bill = hours * rate * mult;
    const billCell = cells[6];
    if (billCell) billCell.textContent = '$' + Math.round(bill).toLocaleString('en-US');
    totalBill += bill;
    if (!resourceTotals[resource]) resourceTotals[resource] = { hours: 0, bill: 0 };
    resourceTotals[resource].hours += hours;
    resourceTotals[resource].bill += bill;
    const numCell = cells[0];
    if (numCell) numCell.textContent = i + 1;
  });
  setText('totalUtilization', '$' + Math.round(totalBill).toLocaleString('en-US'));

  const summary = document.getElementById('utilizationSummary');
  if (summary && Object.keys(resourceTotals).length) {
    summary.innerHTML = Object.entries(resourceTotals).map(([name, s]) =>
      `<div class="summary-card">
        <div class="summary-card-name">${name}</div>
        <div class="summary-card-stats">${s.hours} hrs this week</div>
        <div class="summary-card-total">$${Math.round(s.bill).toLocaleString('en-US')}</div>
      </div>`).join('');
  } else if (summary) {
    summary.innerHTML = '';
  }
  if (!isLoading) autoSave();
}

function renderUtilizationTable() { /* week change hook — could filter view */ }

// ===== DELETE ROW =====
function deleteRow(btn, updateFn) {
  const row = btn.closest('tr');
  if (!row) return;
  row.remove();
  if (typeof updateFn === 'function') updateFn();
  else { updatePipeline(); updateOngoing(); updateLost(); updateUtilization(); }
}

// ===== GO/NO GO =====
function calcScore() {
  const rows = document.querySelectorAll('.gongo-row');
  let totalWeight = 0, totalWeightedScore = 0;
  rows.forEach((row, i) => {
    const w = parseFloat(row.querySelector('.weight-input')?.value) || 0;
    const s = parseFloat(row.querySelector('.score-input')?.value) || 0;
    const ws = (w * s) / 100;
    totalWeight += w;
    totalWeightedScore += ws;
    const cell = document.getElementById(`w${i + 1}`);
    if (cell) cell.textContent = ws.toFixed(2);
  });
  setText('totalWeight', Math.round(totalWeight));
  const finalScore = totalWeight > 0 ? (totalWeightedScore / totalWeight * 10).toFixed(2) : '0.00';
  setText('finalScore', finalScore);
  const result = document.getElementById('gongoResult');
  const decision = document.getElementById('gongoDecision');
  const rec = document.getElementById('gongoRec');
  if (!result) return;
  result.className = 'gongo-result';
  const score = parseFloat(finalScore);
  if (score >= 7.5) {
    result.classList.add('result-go');
    if (decision) decision.textContent = '— GO —';
    if (rec) rec.textContent = 'Excellent opportunity with strong strategic alignment';
  } else if (score >= 6.0) {
    result.classList.add('result-conditional');
    if (decision) decision.textContent = '— CONDITIONAL GO —';
    if (rec) rec.textContent = 'Good opportunity — review key concerns before committing';
  } else {
    result.classList.add('result-nogo');
    if (decision) decision.textContent = '— NO GO —';
    if (rec) rec.textContent = 'High risk, poor strategic alignment';
  }
}

// ===== PDF =====
function generatePDF() {
  const name = document.getElementById('opportunityName')?.value || 'Unknown';
  const score = document.getElementById('finalScore')?.textContent || '0';
  const decision = document.getElementById('gongoDecision')?.textContent || '';
  // Build printable content
  const content = `
    <html><head><title>Go/No Go — ${name}</title>
    <style>
      body{font-family:sans-serif;padding:40px;color:#1a1a1a}
      h1{font-size:22px;border-bottom:3px solid #E3610F;padding-bottom:10px;margin-bottom:20px}
      .score{font-size:48px;font-weight:700;color:#E3610F;margin:20px 0}
      table{width:100%;border-collapse:collapse;margin-top:20px}
      th{background:#1a1a1a;color:white;padding:8px;font-size:11px;text-align:left}
      td{padding:8px;border-bottom:1px solid #eee;font-size:12px}
      .meta{color:#666;font-size:12px;margin-bottom:20px}
    </style></head><body>
    <h1>Go / No Go Evaluation</h1>
    <p class="meta">Urban Analytics Mexico · ${new Date().toLocaleDateString('en-MX', {year:'numeric',month:'long',day:'numeric'})}</p>
    <p><strong>Opportunity:</strong> ${name}</p>
    <div class="score">${score}</div>
    <p><strong>${decision}</strong></p>
    <table>
      <tr><th>Criterion</th><th>Weight %</th><th>Score</th><th>Weighted</th></tr>
      ${Array.from(document.querySelectorAll('.gongo-row')).map((row, i) => {
        const title = row.querySelector('.criterion-title')?.textContent || '';
        const w = row.querySelector('.weight-input')?.value || '';
        const s = row.querySelector('.score-input')?.value || '';
        const ws = document.getElementById(`w${i+1}`)?.textContent || '';
        return `<tr><td>${title}</td><td>${w}%</td><td>${s}</td><td>${ws}</td></tr>`;
      }).join('')}
    </table>
    </body></html>`;
  const win = window.open('', '_blank');
  if (win) { win.document.write(content); win.document.close(); setTimeout(() => win.print(), 500); }
}

// ===== CSV EXPORT =====
function exportPipelineToCSV() {
  let csv = '\uFEFFUrban Analytics Mexico — Pipeline Export\n';
  csv += `Generated: ${new Date().toLocaleString('en-MX')}\n\n`;

  // Pipeline
  csv += 'CURRENT PROPOSAL PIPELINE\n';
  csv += '#,Project,Topic,Client,Lead,Support,Date,Price USD,Probability %,Weighted USD\n';
  let tAmt = 0, tW = 0;
  document.querySelectorAll('#pipelineTable tbody tr:not(.total-row)').forEach((row, i) => {
    const c = row.querySelectorAll('td');
    const amt = parseFloat(c[7]?.querySelector('input')?.value) || 0;
    const prob = parseFloat(c[8]?.querySelector('input')?.value) || 0;
    const w = (amt * prob) / 100;
    tAmt += amt; tW += w;
    csv += `${i+1},"${esc(c[1]?.querySelector('input')?.value)}","${esc(c[2]?.querySelector('select')?.value)}","${esc(c[3]?.querySelector('input')?.value)}","${esc(c[4]?.querySelector('select')?.value)}","${esc(c[5]?.querySelector('select')?.value)}",${c[6]?.querySelector('input')?.value},${amt},${prob},${w.toFixed(2)}\n`;
  });
  csv += `TOTAL,,,,,,,${tAmt},,${tW.toFixed(2)}\n\n`;

  // Ongoing
  csv += 'ONGOING PROJECTS\n';
  csv += '#,Project,Client,Date,BST,Fees USD,UA Fees USD,Status\n';
  let tFees = 0, tUA = 0;
  document.querySelectorAll('#ongoingTable tbody tr:not(.total-row)').forEach((row, i) => {
    const c = row.querySelectorAll('td');
    const fees = parseFloat(c[5]?.querySelector('input')?.value) || 0;
    const ua = parseFloat(c[6]?.querySelector('input')?.value) || 0;
    tFees += fees; tUA += ua;
    csv += `${i+1},"${esc(c[1]?.querySelector('input')?.value)}","${esc(c[2]?.querySelector('input')?.value)}",${c[3]?.querySelector('input')?.value},"${esc(c[4]?.querySelector('input')?.value)}",${fees},${ua},"${esc(c[7]?.querySelector('select')?.value)}"\n`;
  });
  csv += `TOTAL,,,,,${tFees},${tUA},\n\n`;

  // Lost
  csv += 'LOST OPPORTUNITIES\n';
  csv += '#,Project,Client,Lead,Support,Date,Value USD,Motive,Comments\n';
  let tLost = 0;
  document.querySelectorAll('#lostTable tbody tr:not(.total-row)').forEach((row, i) => {
    const c = row.querySelectorAll('td');
    const v = parseFloat(c[6]?.querySelector('input')?.value) || 0;
    tLost += v;
    csv += `${i+1},"${esc(c[1]?.querySelector('input')?.value)}","${esc(c[2]?.querySelector('input')?.value)}","${esc(c[3]?.querySelector('select')?.value)}","${esc(c[4]?.querySelector('select')?.value)}",${c[5]?.querySelector('input')?.value},${v},"${esc(c[7]?.querySelector('select')?.value)}","${esc(c[8]?.querySelector('input')?.value)}"\n`;
  });
  csv += `TOTAL,,,,,,${tLost},,\n\n`;

  // Utilization
  csv += 'RESOURCE UTILIZATION\n';
  csv += `Week: ${document.getElementById('utilizationWeek')?.value || ''}\n`;
  csv += '#,Resource,Project,Hours,Rate USD/hr,Multiplier,Billable USD\n';
  document.querySelectorAll('#utilizationTable tbody tr:not(.total-row)').forEach((row, i) => {
    const c = row.querySelectorAll('td');
    csv += `${i+1},"${esc(c[1]?.querySelector('select')?.value)}","${esc(c[2]?.querySelector('input')?.value)}",${c[3]?.querySelector('input')?.value},${c[4]?.querySelector('input')?.value},${c[5]?.querySelector('input')?.value},${c[6]?.textContent}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `UA_MX_Pipeline_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('CSV exported ✓', 'success');
}

function esc(v) { return typeof v === 'string' ? v.replace(/"/g, '""') : (v || ''); }

// ===== AUTO-SAVE (debounced) =====
let autoSaveTimer = null;
function autoSave() {
  if (isLoading) return;
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    saveToStorage(getCurrentData());
  }, 1500);
}
