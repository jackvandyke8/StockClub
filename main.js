// Supabase is only available on pages that load the CDN script.
// Intentionally not named SUPABASE_URL/KEY to avoid redeclaration conflict
// with debate.js and blog.js which declare those same const names.
const _sb = (typeof window !== 'undefined' && window.supabase)
  ? window.supabase.createClient(
      'https://aegbhutfgyyzukferxnz.supabase.co',
      'sb_publishable_GdYba_EgD7uYAn5oFlSVcg_hP2lw2N4'
    )
  : null;

// --- Ticker ---
const tickerEl = document.getElementById('ticker');

function renderTicker(items) {
  if (!tickerEl) return;
  tickerEl.innerHTML = '';
  [...items, ...items].forEach(({ symbol, price, change_pct, change }) => {
    const up = change == null ? true : change >= 0;
    const el = document.createElement('span');
    el.className = 'ticker-item';
    el.innerHTML = `<span class="ticker-sym">${symbol}</span><span class="ticker-price">$${parseFloat(price).toFixed(2)}</span><span class="${up ? 'up' : 'down'}">${change_pct || '—'}</span>`;
    tickerEl.appendChild(el);
  });
}

function renderTickerFallback() {
  const fallback = [
    { symbol: 'AAPL', price: '218.40', change_pct: '+0.9%', change: 1 },
    { symbol: 'NVDA', price: '134.70', change_pct: '+2.4%', change: 1 },
    { symbol: 'TSLA', price: '178.20', change_pct: '-1.2%', change: -1 },
    { symbol: 'MSFT', price: '424.80', change_pct: '+0.6%', change: 1 },
    { symbol: 'AMZN', price: '198.60', change_pct: '+1.1%', change: 1 },
    { symbol: 'META', price: '556.30', change_pct: '+0.3%', change: 1 },
    { symbol: 'GOOG', price: '184.90', change_pct: '-0.4%', change: -1 },
    { symbol: 'AMD',  price: '162.40', change_pct: '+3.1%', change: 1 },
    { symbol: 'INTC', price: '21.80',  change_pct: '-0.8%', change: -1 },
    { symbol: 'SPY',  price: '548.20', change_pct: '+0.5%', change: 1 },
  ];
  renderTicker(fallback);
}

async function loadTicker() {
  if (!tickerEl) return;
  if (!_sb) { renderTickerFallback(); return; }

  try {
    const { data } = await _sb.from('quotes_cache').select('symbol,price,change,change_pct').order('symbol');
    if (data?.length) {
      renderTicker(data);
    } else {
      renderTickerFallback();
    }
  } catch {
    renderTickerFallback();
  }
}

// --- Recent Picks grid (homepage only) ---
const grid = document.getElementById('picks-grid');

function renderPicksFallback() {
  if (!grid) return;
  const picks = [
    { sym: 'NVDA', name: 'Nvidia Corp',    price: '$134.70', chg: '+24.1%', up: true,  bar: 82 },
    { sym: 'MSFT', name: 'Microsoft',      price: '$424.80', chg: '+11.3%', up: true,  bar: 67 },
    { sym: 'PLTR', name: 'Palantir Tech',  price: '$85.20',  chg: '+38.6%', up: true,  bar: 91 },
    { sym: 'TSLA', name: 'Tesla Inc',      price: '$178.20', chg: '-8.4%',  up: false, bar: 35 },
    { sym: 'AMZN', name: 'Amazon',         price: '$198.60', chg: '+15.7%', up: true,  bar: 74 },
    { sym: 'INTC', name: 'Intel Corp',     price: '$21.80',  chg: '-18.2%', up: false, bar: 22 },
  ];
  grid.innerHTML = picks.map(p => pickCard(p.sym, p.name, p.price, p.chg, p.up, p.bar)).join('');
}

function pickCard(sym, name, price, chg, up, bar) {
  return `<div class="pick-card">
    <div class="pick-top"><span class="pick-sym display">${sym}</span><span class="pick-change ${up ? 'up' : 'down'}">${chg}</span></div>
    <div class="pick-name">${name}</div>
    <div class="pick-price display">${price}</div>
    <div class="pick-bar-wrap"><div class="pick-bar ${up ? '' : 'red-bar'}" style="width:${bar}%"></div></div>
  </div>`;
}

async function loadPicks() {
  if (!grid) return;
  if (!_sb) { renderPicksFallback(); return; }

  try {
    const { data: portfolio } = await _sb.from('portfolio').select('symbol,company,shares,cost_basis').order('symbol').limit(6);
    const { data: quotes } = await _sb.from('quotes_cache').select('symbol,price,change,change_pct');

    if (!portfolio?.length) { renderPicksFallback(); return; }

    const quoteMap = Object.fromEntries((quotes || []).map(q => [q.symbol, q]));

    grid.innerHTML = portfolio.map(h => {
      const q = quoteMap[h.symbol] || {};
      const price = q.price ? `$${parseFloat(q.price).toFixed(2)}` : '—';
      const chgPct = q.change_pct || '—';
      const up = (q.change ?? 0) >= 0;

      // Bar width: map change_pct -30%…+30% → 10…90%
      let bar = 50;
      if (q.change_pct) {
        const pct = parseFloat(q.change_pct);
        if (!isNaN(pct)) bar = Math.min(90, Math.max(10, Math.round(50 + pct * (40 / 30))));
      }

      return pickCard(h.symbol, h.company || h.symbol, price, chgPct, up, bar);
    }).join('');
  } catch {
    renderPicksFallback();
  }
}

loadTicker();
loadPicks();

// --- Formspree Email Signup (homepage only) ---
const joinForm = document.getElementById('join-form');
if (joinForm) {
  const joinBtn = document.getElementById('join-btn');
  const formMsg = document.getElementById('form-msg');

  joinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('join-email').value.trim();
    if (!email) return;

    joinBtn.textContent = 'Sending...';
    joinBtn.disabled = true;
    formMsg.textContent = '';
    formMsg.className = 'form-msg';

    try {
      const res = await fetch('https://formspree.io/f/xvznowpr', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        formMsg.textContent = '✓ You\'re in! We\'ll be in touch before the next meeting.';
        formMsg.className = 'form-msg success';
        joinForm.reset();
      } else {
        throw new Error('Server error');
      }
    } catch {
      formMsg.textContent = '✗ Something went wrong. Try again or email us directly.';
      formMsg.className = 'form-msg error';
    } finally {
      joinBtn.textContent = 'Join Now';
      joinBtn.disabled = false;
    }
  });
}
