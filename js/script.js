/* ============================================================
   Expense Tracker — script.js
   Stack : Vanilla JS · LocalStorage · Canvas API (no CDN)
   ============================================================ */

// ── DOM References ───────────────────────────────────────────
const form          = document.getElementById('transaction-form');
const nameInput     = document.getElementById('item-name');
const amountInput   = document.getElementById('amount');
const categoryInput = document.getElementById('category');
const balanceEl     = document.getElementById('total-balance');
const listEl        = document.getElementById('transaction-list');
const listEmptyEl   = document.getElementById('list-empty');
const chartCanvas   = document.getElementById('spending-chart');
const chartEmptyEl  = document.getElementById('chart-empty');
const chartLegendEl = document.getElementById('chart-legend');
const sortSelect    = document.getElementById('sort-select');
const summaryEmpty  = document.getElementById('summary-empty');
const summaryTable  = document.getElementById('summary-table');
const summaryTbody  = document.getElementById('summary-tbody');
const themeToggle   = document.getElementById('theme-toggle');

// ── Constants ────────────────────────────────────────────────
const STORAGE_KEY   = 'expense_tracker_transactions';
const THEME_KEY     = 'expense_tracker_theme';

const CATEGORY_META = {
  food:      { label: 'Food',      badge: 'badge-food',      color: '#f97316' },
  transport: { label: 'Transport', badge: 'badge-transport', color: '#3b82f6' },
  fun:       { label: 'Fun',       badge: 'badge-fun',       color: '#a855f7' },
};

// ── State ────────────────────────────────────────────────────
let transactions = loadTransactions();

// ── Persistence ──────────────────────────────────────────────
function loadTransactions() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

// ── Formatting ───────────────────────────────────────────────
function formatUSD(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHTML(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

// ── Validation ───────────────────────────────────────────────
function setError(inputEl, errorId, show) {
  document.getElementById(errorId).classList.toggle('visible', show);
  inputEl.classList.toggle('is-error', show);
}

function validateForm() {
  const nameVal     = nameInput.value.trim();
  const amountVal   = parseFloat(amountInput.value);
  const categoryVal = categoryInput.value;

  const nameInvalid     = nameVal === '';
  const amountInvalid   = !amountInput.value || isNaN(amountVal) || amountVal <= 0;
  const categoryInvalid = categoryVal === '';

  setError(nameInput,     'name-error',     nameInvalid);
  setError(amountInput,   'amount-error',   amountInvalid);
  setError(categoryInput, 'category-error', categoryInvalid);

  if (nameInvalid || amountInvalid || categoryInvalid) return null;
  return { nameVal, amountVal, categoryVal };
}

// ── Sort ─────────────────────────────────────────────────────
function getSorted(list) {
  return [...list].sort((a, b) => {
    switch (sortSelect.value) {
      case 'date-asc':    return new Date(a.date) - new Date(b.date);
      case 'date-desc':   return new Date(b.date) - new Date(a.date);
      case 'amount-asc':  return a.amount - b.amount;
      case 'amount-desc': return b.amount - a.amount;
      case 'category':    return a.category.localeCompare(b.category);
      default:            return 0;
    }
  });
}

// ── Balance ──────────────────────────────────────────────────
function updateBalance() {
  balanceEl.textContent = formatUSD(transactions.reduce((s, t) => s + t.amount, 0));
}

// ── Transaction List ─────────────────────────────────────────
function renderList() {
  listEl.querySelectorAll('.tx-item').forEach(el => el.remove());

  if (transactions.length === 0) { listEmptyEl.style.display = ''; return; }
  listEmptyEl.style.display = 'none';

  getSorted(transactions).forEach(t => {
    const meta = CATEGORY_META[t.category] || { label: t.category, badge: '', color: '#94a3b8' };
    const li   = document.createElement('li');
    li.className = 'tx-item';
    li.innerHTML = `
      <div class="tx-info">
        <p class="tx-name">${escapeHTML(t.name)}</p>
        <div class="tx-meta">
          <span class="tx-badge ${meta.badge}">${meta.label}</span>
          <span class="tx-date">${formatDate(t.date)}</span>
        </div>
      </div>
      <div class="tx-right">
        <span class="tx-amount">-${formatUSD(t.amount)}</span>
        <button class="btn-delete" data-id="${t.id}" aria-label="Delete ${escapeHTML(t.name)}">&times;</button>
      </div>`;
    listEl.appendChild(li);
  });
}

// ── Pie Chart (Canvas API — no library) ──────────────────────
function renderChart() {
  const categories = Object.keys(CATEGORY_META);
  const totals     = categories.map(cat =>
    transactions.filter(t => t.category === cat).reduce((s, t) => s + t.amount, 0)
  );
  const grandTotal = totals.reduce((a, b) => a + b, 0);
  const hasData    = grandTotal > 0;

  chartEmptyEl.style.display  = hasData ? 'none' : '';
  chartCanvas.style.display   = hasData ? ''     : 'none';
  chartLegendEl.style.display = hasData ? ''     : 'none';

  if (!hasData) return;

  const ctx = chartCanvas.getContext('2d');
  const W   = chartCanvas.width;
  const H   = chartCanvas.height;
  const cx  = W / 2;
  const cy  = H / 2;
  const r   = Math.min(W, H) / 2 - 10;

  ctx.clearRect(0, 0, W, H);

  let startAngle = -Math.PI / 2;   // start at top

  categories.forEach((cat, i) => {
    if (totals[i] === 0) return;
    const slice = (totals[i] / grandTotal) * 2 * Math.PI;
    const endAngle = startAngle + slice;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = CATEGORY_META[cat].color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 3;
    ctx.stroke();

    startAngle = endAngle;
  });

  // Legend
  chartLegendEl.innerHTML = categories
    .filter((_, i) => totals[i] > 0)
    .map(cat => {
      const idx = categories.indexOf(cat);
      const pct = ((totals[idx] / grandTotal) * 100).toFixed(1);
      return `<span class="legend-item">
        <span class="legend-dot" style="background:${CATEGORY_META[cat].color}"></span>
        ${CATEGORY_META[cat].label} <span class="legend-pct">${pct}%</span>
      </span>`;
    })
    .join('');
}

// ── Monthly Summary ───────────────────────────────────────────
function renderMonthlySummary() {
  if (transactions.length === 0) {
    summaryEmpty.style.display = '';
    summaryTable.hidden = true;
    return;
  }

  const monthMap = {};
  transactions.forEach(t => {
    const d   = new Date(t.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthMap[key]) monthMap[key] = { food: 0, transport: 0, fun: 0 };
    monthMap[key][t.category] = (monthMap[key][t.category] || 0) + t.amount;
  });

  summaryTbody.innerHTML = '';
  Object.keys(monthMap).sort((a, b) => b.localeCompare(a)).forEach(key => {
    const [yr, mo] = key.split('-');
    const label    = new Date(yr, mo - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const row      = monthMap[key];
    const total    = (row.food || 0) + (row.transport || 0) + (row.fun || 0);
    const tr       = document.createElement('tr');
    tr.innerHTML = `
      <td>${label}</td>
      <td>${row.food      ? formatUSD(row.food)      : '—'}</td>
      <td>${row.transport ? formatUSD(row.transport) : '—'}</td>
      <td>${row.fun       ? formatUSD(row.fun)       : '—'}</td>
      <td class="summary-total">${formatUSD(total)}</td>`;
    summaryTbody.appendChild(tr);
  });

  summaryEmpty.style.display = 'none';
  summaryTable.hidden = false;
}

// ── Full Render Cycle ────────────────────────────────────────
function render() {
  updateBalance();
  renderList();
  renderChart();
  renderMonthlySummary();
}

// ── Dark / Light Mode ────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggle.textContent = theme === 'dark' ? 'Light' : 'Dark';
  localStorage.setItem(THEME_KEY, theme);
  // Redraw chart so slice borders match new background
  renderChart();
}

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

// ── Events ───────────────────────────────────────────────────
form.addEventListener('submit', e => {
  e.preventDefault();
  const data = validateForm();
  if (!data) return;
  transactions.push({
    id:       crypto.randomUUID(),
    name:     data.nameVal,
    amount:   data.amountVal,
    category: data.categoryVal,
    date:     new Date().toISOString(),
  });
  saveTransactions();
  render();
  form.reset();
});

listEl.addEventListener('click', e => {
  const btn = e.target.closest('.btn-delete');
  if (!btn) return;
  transactions = transactions.filter(t => t.id !== btn.dataset.id);
  saveTransactions();
  render();
});

sortSelect.addEventListener('change', renderList);

// ── Boot ─────────────────────────────────────────────────────
applyTheme(localStorage.getItem(THEME_KEY) || 'light');
render();
