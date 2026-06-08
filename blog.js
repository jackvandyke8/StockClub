const SUPABASE_URL = 'https://aegbhutfgyyzukferxnz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_GdYba_EgD7uYAn5oFlSVcg_hP2lw2N4';
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Editor toggle ---
const newBlogBtn     = document.getElementById('new-blog-btn');
const cancelBlogBtn  = document.getElementById('cancel-blog-btn');
const editorWrap     = document.getElementById('blog-editor-wrap');
const blogMsg        = document.getElementById('blog-msg');

newBlogBtn.addEventListener('click', () => {
  editorWrap.classList.add('open');
  editorWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.getElementById('blog-title').focus();
});

cancelBlogBtn.addEventListener('click', closeEditor);

function closeEditor() {
  editorWrap.classList.remove('open');
  document.getElementById('blog-title').value = '';
  document.getElementById('blog-author').value = '';
  document.getElementById('blog-content').innerHTML = '';
  blogMsg.textContent = '';
  blogMsg.className = 'blog-msg';
}

// --- Image upload ---
const imageInput    = document.getElementById('blog-image-input');
const imgLabel      = document.getElementById('toolbar-img-label');

imageInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  imgLabel.classList.add('uploading');
  imgLabel.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.09-4.96"/>
    </svg>
    Uploading…`;

  const ext = file.name.split('.').pop().toLowerCase();
  const filename = `${Date.now()}.${ext}`;

  const { error } = await _supabase.storage
    .from('blog-images')
    .upload(filename, file, { contentType: file.type, upsert: false });

  if (error) {
    console.error('Image upload error:', error);
    showBlogMsg('Image upload failed — make sure the blog-images bucket exists and is public.', 'error');
    resetImgLabel();
    imageInput.value = '';
    return;
  }

  const url = `${SUPABASE_URL}/storage/v1/object/public/blog-images/${filename}`;
  insertImageAtCursor(url, file.name);

  resetImgLabel();
  imageInput.value = '';
});

function insertImageAtCursor(url, alt) {
  const editor = document.getElementById('blog-content');
  editor.focus();

  const img = document.createElement('img');
  img.src = url;
  img.alt = alt;
  img.className = 'blog-inline-img';

  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    const inEditor = editor.contains(range.commonAncestorContainer) || editor === range.commonAncestorContainer;
    if (inEditor) {
      range.deleteContents();
      range.insertNode(img);
      range.setStartAfter(img);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
  }
  editor.appendChild(img);
}

function resetImgLabel() {
  imgLabel.classList.remove('uploading');
  imgLabel.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
    Add Image`;
}

// --- Publish ---
const publishBtn = document.getElementById('publish-btn');

publishBtn.addEventListener('click', async () => {
  const title     = document.getElementById('blog-title').value.trim();
  const author    = document.getElementById('blog-author').value.trim();
  const contentEl = document.getElementById('blog-content');
  const content   = contentEl.innerHTML.trim();
  const hasText   = contentEl.textContent.trim().length > 0 || contentEl.querySelector('img');

  if (!title || !author || !hasText) {
    showBlogMsg('Please fill in the title, your name, and some content.', 'error');
    return;
  }

  publishBtn.textContent = 'Publishing…';
  publishBtn.disabled = true;

  const { error } = await _supabase.from('blogs').insert({ title, author, content });

  if (error) {
    console.error('Publish error:', error);
    showBlogMsg('Something went wrong — try again.', 'error');
  } else {
    closeEditor();
    await loadBlogs();
    document.getElementById('blogs-feed').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  publishBtn.textContent = 'Publish';
  publishBtn.disabled = false;
});

function showBlogMsg(text, type) {
  blogMsg.textContent = type === 'success' ? `✓ ${text}` : `✗ ${text}`;
  blogMsg.className = `blog-msg ${type}`;
}

// --- Load blogs ---
async function loadBlogs() {
  const feed = document.getElementById('blogs-feed');

  const { data, error } = await _supabase
    .from('blogs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Load blogs error:', error);
    feed.innerHTML = '<div class="feed-empty">Could not load posts — check your Supabase setup.</div>';
    return;
  }

  if (!data || !data.length) {
    feed.innerHTML = '<div class="feed-empty">No posts yet — be the first to share your take.</div>';
    return;
  }

  feed.innerHTML = data.map(renderBlogCard).join('');

  feed.querySelectorAll('.read-more-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.blog-card');
      const full = card.querySelector('.blog-full');
      const open = full.classList.contains('visible');
      full.classList.toggle('visible', !open);
      btn.textContent = open ? 'Read more →' : 'Show less';
    });
  });
}

function textExcerpt(html, max = 200) {
  const div = document.createElement('div');
  div.innerHTML = html;
  const text = (div.textContent || '').trim();
  return text.length > max ? text.slice(0, max) + '…' : text;
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderBlogCard(blog) {
  const date    = new Date(blog.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const excerpt = textExcerpt(blog.content);
  const hasImages = /<img/i.test(blog.content);
  const longPost  = blog.content.length > 300 || hasImages;

  return `
    <div class="blog-card">
      <div class="blog-card-top">
        <h3 class="blog-card-title display">${escHtml(blog.title)}</h3>
        <div class="blog-card-meta">
          <span class="blog-card-author">${escHtml(blog.author)}</span>
          <span class="blog-card-sep">·</span>
          <span class="blog-card-date">${date}</span>
        </div>
      </div>
      ${longPost ? `
        <p class="blog-card-excerpt">${escHtml(excerpt)}</p>
        <button type="button" class="read-more-btn">Read more →</button>
        <div class="blog-full">${blog.content}</div>
      ` : `
        <div class="blog-full visible">${blog.content}</div>
      `}
    </div>
  `;
}

// --- Real-time ---
_supabase
  .channel('blogs-changes')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'blogs' }, () => {
    loadBlogs();
  })
  .subscribe();

// --- Init ---
loadBlogs();
