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
  loadPosts();
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

// --- Render Posts ---
function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderPost(post) {
  const time = new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `
    <div class="debate-post ${post.side}">
      <div class="post-header">
        <span class="post-name">${escapeHtml(post.name)}</span>
        <span class="post-date">${time}</span>
      </div>
      <p class="post-thesis">${escapeHtml(post.thesis)}</p>
    </div>
  `;
}

function renderPosts(posts) {
  const bullEl = document.getElementById('bull-posts');
  const bearEl = document.getElementById('bear-posts');
  const bulls = posts.filter(p => p.side === 'bull');
  const bears = posts.filter(p => p.side === 'bear');

  bullEl.innerHTML = bulls.length
    ? bulls.map(renderPost).join('')
    : '<p class="no-posts">No bulls yet — be the first.</p>';

  bearEl.innerHTML = bears.length
    ? bears.map(renderPost).join('')
    : '<p class="no-posts">No bears yet — make your case.</p>';
}

// --- Load Posts ---
async function loadPosts() {
  const bullEl = document.getElementById('bull-posts');
  const bearEl = document.getElementById('bear-posts');
  bullEl.innerHTML = '<p class="no-posts">Loading...</p>';
  bearEl.innerHTML = '<p class="no-posts">Loading...</p>';

  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('stock', activeStock)
    .order('created_at', { ascending: false });

  if (error) { console.error(error); return; }
  renderPosts(data);
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
    loadPosts();
  }

  submitBtn.textContent = 'Post';
  submitBtn.disabled = false;
});

// --- Init ---
renderTabs();
loadPosts();
