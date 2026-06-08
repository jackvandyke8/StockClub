// --- Supabase Setup ---
const SUPABASE_URL = 'https://aegbhutfgyyzukferxnz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_GdYba_EgD7uYAn5oFlSVcg_hP2lw2N4';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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
  if (val) setActiveStock(val);
});

tickerInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const val = tickerInput.value.trim();
    if (val) setActiveStock(val);
  }
});

// --- Render Tabs ---
function renderTabs() {
  const tabs = document.getElementById('debate-tabs');
  const stocks = DEFAULT_STOCKS.includes(activeStock) ? DEFAULT_STOCKS : [...DEFAULT_STOCKS, activeStock];
  tabs.innerHTML = stocks.map(s => `
    <button class="debate-tab ${s === activeStock ? 'active' : ''}" data-stock="${s}">${s}</button>
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
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// --- Render single feed post ---
function renderFeedPost(post) {
  const isBull = post.side === 'bull';
  const time = new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `
    <div class="feed-post ${post.side}">
      <div class="feed-post-side-bar"></div>
      <div class="feed-post-body">
        <div class="feed-post-header">
          <span class="feed-post-badge ${post.side}">${isBull ? 'BULL' : 'BEAR'}</span>
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
  const bullCount = posts.filter(p => p.side === 'bull').length;
  const bearCount = posts.filter(p => p.side === 'bear').length;

  document.getElementById('bull-count').textContent = `${bullCount} Bull`;
  document.getElementById('bear-count').textContent = `${bearCount} Bear`;

  if (!posts.length) {
    feed.innerHTML = '<div class="feed-empty">No debates yet for this ticker — be the first to make a case.</div>';
    return;
  }

  feed.innerHTML = posts.map(renderFeedPost).join('');
}

// --- Load Posts ---
async function loadPosts() {
  const feed = document.getElementById('debate-feed');
  feed.innerHTML = '<div class="feed-loading">Loading posts...</div>';

  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('stock', activeStock)
    .order('created_at', { ascending: false });

  if (error) { console.error(error); return; }
  renderFeed(data);
}

// --- Real-time Subscription ---
supabase
  .channel('posts-changes')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, payload => {
    if (payload.new.stock === activeStock) loadPosts();
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
    debateMsg.textContent = 'Please fill in your name and thesis.';
    debateMsg.className = 'debate-msg error';
    return;
  }

  const submitBtn = debateForm.querySelector('button[type="submit"]');
  submitBtn.textContent = 'Posting...';
  submitBtn.disabled = true;
  debateMsg.textContent = '';
  debateMsg.className = 'debate-msg';

  const { error } = await supabase.from('posts').insert({
    stock: activeStock,
    name,
    side: activeSide,
    thesis,
  });

  if (error) {
    debateMsg.textContent = '✗ Something went wrong. Try again.';
    debateMsg.className = 'debate-msg error';
  } else {
    debateMsg.textContent = '✓ Post submitted!';
    debateMsg.className = 'debate-msg success';
    debateForm.reset();
    activeSide = 'bull';
    document.querySelectorAll('.side-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.bull-btn').classList.add('active');
    // Scroll to feed so user sees their post
    document.querySelector('.debate-feed-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
    loadPosts();
  }

  submitBtn.textContent = 'Post';
  submitBtn.disabled = false;
});

// --- Init ---
renderTabs();
updateLabels();
loadPosts();
