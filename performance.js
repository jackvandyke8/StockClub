const SUPABASE_URL = 'https://aegbhutfgyyzukferxnz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_GdYba_EgD7uYAn5oFlSVcg_hP2lw2N4';
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- CSV Parsing ---
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());

  // Flexible column mapping
  const col = name => {
    const aliases = {
      symbol: ['symbol', 'ticker', 'sym'],
      company: ['company', 'name', 'security', 'description'],
      shares: ['shares', 'quantity', 'qty', 'units'],
      cost: ['cost basis', 'cost/share', 'avg cost', 'cost', 'average cost', 'purchase price'],
    };
    for (const alias of aliases[name]) {
      const idx = headers.findIndex(h => h.includes(alias));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const symIdx = col('symbol');
  const nameIdx = col('company');
  const sharesIdx = col('shares');
  const costIdx = col('cost');

  if (symIdx === -1) return null; // can't proceed without symbol

  return lines.slice(1)
    .map(line => {
      // Handle quoted fields with commas inside
      const fields = [];
      let inQuote = false, cur = '';
      for (const ch of line) {
        if (ch === '"') { inQuote = !inQuote; continue; }
        if (ch === ',' && !inQuote) { fields.push(cur.trim()); cur = ''; continue; }
        cur += ch;
      }
      fields.push(cur.trim());

      const sym = fields[symIdx]?.toUpperCase().replace(/[^A-Z.]/g, '');
      if (!sym) return null;

      const shares = sharesIdx !== -1 ? parseFloat(fields[sharesIdx]?.replace(/[$,]/g, '')) : null;
      const cost = costIdx !== -1 ? parseFloat(fields[costIdx]?.replace(/[$,]/g, '')) : null;
      const company = nameIdx !== -1 ? fields[nameIdx] : '';

      return { symbol: sym, company, shares: shares || null, cost_basis: cost || null };
    })
    .filter(Boolean);
}

// --- Upload Holdings to Supabase ---
async function importHoldings(rows) {
  // Wipe existing and replace — simple full-refresh approach
  await _supabase.from('portfolio').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  const { error } = await _supabase.from('portfolio').insert(
    rows.map(r => ({ ...r, updated_at: new Date().toISOString() }))
  );
  return error;
}

// --- Fetch Live Quotes ---
async function fetchQuotes(symbols) {
  const res = await fetch(`/api/quotes?symbols=${symbols.join(',')}`);
  if (!res.ok) return {};
  return res.json();
}

// --- Render Table ---
function fmt(n, prefix = '') {
  if (n == null || isNaN(n)) return '—';
  return prefix + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderTable(holdings, quotes) {
  const tbody = document.getElementById('perf-tbody');
  const table = document.getElementById('perf-table');
  const empty = document.getElementById('perf-empty');
  const statsBar = document.getElementById('perf-stats');

  if (!holdings.length) {
    table.style.display = 'none';
    empty.style.display = 'block';
    statsBar.style.display = 'none';
    return;
  }

  table.style.display = 'table';
  empty.style.display = 'none';
  statsBar.style.display = 'flex';

  let totalValue = 0, totalCost = 0;

  tbody.innerHTML = holdings.map(h => {
    const q = quotes[h.symbol] || {};
    const price = q.price ?? null;
    const todayPct = q.change_pct ?? '—';
    const isUp = q.change >= 0;

    const marketVal = (price != null && h.shares) ? price * h.shares : null;
    const costTotal = (h.cost_basis && h.shares) ? h.cost_basis * h.shares : null;
    const gain = (marketVal != null && costTotal != null) ? marketVal - costTotal : null;
    const gainPct = (gain != null && costTotal) ? (gain / costTotal) * 100 : null;
    const gainUp = gain == null ? true : gain >= 0;

    if (marketVal) totalValue += marketVal;
    if (costTotal) totalCost += costTotal;

    return `<tr>
      <td class="sym display">${h.symbol}</td>
      <td class="name">${h.company || '—'}</td>
      <td class="num">${h.shares != null ? h.shares.toLocaleString() : '—'}</td>
      <td class="num">${fmt(h.cost_basis, '$')}</td>
      <td class="num">${price != null ? fmt(price, '$') : '<span class="muted">—</span>'}</td>
      <td class="num">${marketVal != null ? fmt(marketVal, '$') : '<span class="muted">—</span>'}</td>
      <td class="num ${gainUp ? 'up' : 'down'}">${gain != null ? (gainUp ? '+' : '') + fmt(gain, '$') : '—'}</td>
      <td class="num ${gainUp ? 'up' : 'down'}">${gainPct != null ? (gainUp ? '+' : '') + gainPct.toFixed(1) + '%' : '—'}</td>
      <td class="num ${isUp ? 'up' : 'down'}">${todayPct}</td>
    </tr>`;
  }).join('');

  const totalGain = totalCost ? totalValue - totalCost : null;
  const totalPct = (totalGain != null && totalCost) ? (totalGain / totalCost) * 100 : null;
  const gainUp = totalGain == null || totalGain >= 0;

  document.getElementById('stat-total-value').textContent = totalValue ? fmt(totalValue, '$') : '—';
  document.getElementById('stat-total-gain').className = `stat-num ${gainUp ? 'up' : 'down'}`;
  document.getElementById('stat-total-gain').textContent = totalGain != null ? (gainUp ? '+' : '') + fmt(totalGain, '$') : '—';
  document.getElementById('stat-total-pct').className = `stat-num ${gainUp ? 'up' : 'down'}`;
  document.getElementById('stat-total-pct').textContent = totalPct != null ? (gainUp ? '+' : '') + totalPct.toFixed(1) + '%' : '—';
  document.getElementById('stat-positions').textContent = holdings.length;
}

// --- Load Portfolio from Supabase + Quotes ---
async function loadPortfolio() {
  const { data: holdings, error } = await _supabase
    .from('portfolio')
    .select('*')
    .order('symbol');

  if (error || !holdings?.length) {
    renderTable([], {});
    return;
  }

  const syms = holdings.map(h => h.symbol);
  let quotes = {};
  try { quotes = await fetchQuotes(syms); } catch {}

  renderTable(holdings, quotes);
}

// --- CSV Upload UI ---
const csvInput = document.getElementById('csv-input');
const uploadZone = document.getElementById('upload-zone');
const uploadHint = document.getElementById('upload-hint');
const uploadBtn = document.getElementById('upload-btn');
const uploadMsg = document.getElementById('upload-msg');

let parsedRows = [];

function handleFile(file) {
  if (!file || !file.name.endsWith('.csv')) {
    uploadHint.textContent = 'Please select a .csv file';
    return;
  }
  uploadHint.textContent = file.name;
  const reader = new FileReader();
  reader.onload = e => {
    parsedRows = parseCSV(e.target.result) || [];
    if (parsedRows === null || parsedRows.length === 0) {
      uploadMsg.textContent = 'Could not parse CSV — check that it has a Symbol column.';
      uploadMsg.className = 'upload-msg error';
      uploadBtn.disabled = true;
    } else {
      uploadMsg.textContent = `Parsed ${parsedRows.length} holding${parsedRows.length !== 1 ? 's' : ''} — ready to import.`;
      uploadMsg.className = 'upload-msg success';
      uploadBtn.disabled = false;
    }
  };
  reader.readAsText(file);
}

csvInput.addEventListener('change', e => handleFile(e.target.files[0]));

uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  handleFile(e.dataTransfer.files[0]);
});

uploadBtn.addEventListener('click', async () => {
  if (!parsedRows.length) return;
  uploadBtn.disabled = true;
  uploadBtn.textContent = 'Importing...';
  uploadMsg.textContent = '';

  const err = await importHoldings(parsedRows);
  if (err) {
    uploadMsg.textContent = 'Import failed: ' + err.message;
    uploadMsg.className = 'upload-msg error';
    uploadBtn.disabled = false;
    uploadBtn.textContent = 'Import Holdings';
  } else {
    uploadMsg.textContent = `Imported ${parsedRows.length} holdings successfully.`;
    uploadMsg.className = 'upload-msg success';
    uploadBtn.textContent = 'Import Holdings';
    await loadPortfolio();
  }
});

// --- Init ---
loadPortfolio();
