// --- Supabase Setup ---
const SUPABASE_URL = 'https://aegbhutfgyyzukferxnz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_GdYba_EgD7uYAn5oFlSVcg_hP2lw2N4';
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const DEFAULT_STOCKS = ['NVDA', 'MSFT', 'PLTR', 'TSLA', 'AMZN', 'INTC'];
let activeStock = DEFAULT_STOCKS[0];
let activeSide = 'bull';

// --- Custom Ticker Input ---
const tickerInput = document.getElementById('custom-ticker');
const tickerGoBtn = document.getElementById('ticker-go');

function setActiveStock(sym) {
  activeStock = sym.toUpperCase().trim();
  renderTabs();
  updateLabels();
  loadPosts();
}

function updateLabels() {
  document.getElementById('feed-title').textContent = `${activeStock} — Live Debate`;
  document.getElementById('form-ticker-label').innerHTML = `for <strong>${activeStock}</strong>`;
}

tickerGoBtn.addEventListener('click', () => {
  const val = tickerInput.value.trim();
  if (val) {
    setActiveStock(val);
    tickerInput.value = '';
  }
});

tickerInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const val = tickerInput.value.trim();
    if (val) {
      setActiveStock(val);
      tickerInput.value = '';
    }
  }
});

// --- Render Tabs ---
function renderTabs() {
  const tabs = document.getElementById('debate-tabs');
  const stocks = DEFAULT_STOCKS.includes(activeStock) ? DEFAULT_STOCKS : [...DEFAULT_STOCKS, activeStock];
  tabs.innerHTML = stocks.map(s => `
    <button type="button" class="debate-tab ${s === activeStock ? 'active' : ''}" data-stock="${s}">${s}</button>
  `).join('');
  tabs.querySelectorAll('.debate-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      tickerInput.value = '';
      setActiveStock(btn.dataset.stock);
    });
  });
}

// --- Escape HTML ---
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// --- Render single feed post ---
function renderFeedPost(post) {
  const isBull = post.side === 'bull';
  const time = new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `
    <div class="feed-post ${escapeHtml(post.side)}">
      <div class="feed-post-side-bar"></div>
      <div class="feed-post-body">
        <div class="feed-post-header">
          <span class="feed-post-badge ${escapeHtml(post.side)}">${isBull ? 'BULL' : 'BEAR'}</span>
          <span class="feed-post-name">${escapeHtml(post.name)}</span>
          <span class="feed-post-stock">${escapeHtml(post.stock)}</span>
          <span class="feed-post-date">${time}</span>
        </div>
        <p class="feed-post-thesis">${escapeHtml(post.thesis)}</p>
      </div>
    </div>
  `;
}

// --- Render full feed ---
function renderFeed(posts) {
  const feed = document.getElementById('debate-feed');
  const valid = posts.filter(p => p.name && p.thesis);
  const bullCount = valid.filter(p => p.side === 'bull').length;
  const bearCount = valid.filter(p => p.side === 'bear').length;

  document.getElementById('bull-count').textContent = `${bullCount} Bull`;
  document.getElementById('bear-count').textContent = `${bearCount} Bear`;

  if (!valid.length) {
    feed.innerHTML = '<div class="feed-empty">No debates yet for this ticker — be the first to make a case.</div>';
    return;
  }

  feed.innerHTML = valid.map(renderFeedPost).join('');
}

// --- Load Posts ---
async function loadPosts() {
  const { data, error } = await _supabase
    .from('posts')
    .select('*')
    .eq('stock', activeStock)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('loadPosts error:', error);
    return;
  }
  renderFeed(data);
}

// --- Real-time Subscription ---
_supabase
  .channel('posts-changes')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, () => {
    loadPosts();
  })
  .subscribe();

// --- Side Toggle ---
document.querySelectorAll('.side-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    activeSide = btn.dataset.side;
    document.querySelectorAll('.side-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// --- Form Submit ---
const debateForm = document.getElementById('debate-form');
const debateMsg  = document.getElementById('debate-msg');

debateForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name   = document.getElementById('debate-name').value.trim();
  const thesis = document.getElementById('debate-thesis').value.trim();

  if (!name || !thesis) {
    showMsg('Please fill in your name and your thesis.', 'error');
    return;
  }

  const submitBtn = debateForm.querySelector('button[type="submit"]');
  submitBtn.textContent = 'Posting...';
  submitBtn.disabled = true;
  debateMsg.textContent = '';
  debateMsg.className = 'debate-msg';

  const { error } = await _supabase.from('posts').insert({
    stock: activeStock,
    name,
    side: activeSide,
    thesis,
  });

  if (error) {
    console.error('Insert error:', error);
    showMsg('Something went wrong — try again.', 'error');
  } else {
    showMsg('Posted! Scroll up to see your debate.', 'success');
    debateForm.reset();
    activeSide = 'bull';
    document.querySelectorAll('.side-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.bull-btn').classList.add('active');
    await loadPosts();
    document.querySelector('.debate-feed-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  submitBtn.textContent = 'Post';
  submitBtn.disabled = false;
});

function showMsg(text, type) {
  debateMsg.textContent = type === 'success' ? `✓ ${text}` : `✗ ${text}`;
  debateMsg.className = `debate-msg ${type}`;
}

// --- Init ---
renderTabs();
updateLabels();
loadPosts();
