// js/feed.js
let currentFilter = 'all';
let currentCommentPostId = null;
let editingPostId = null;

async function loadFeed(filter = 'all') {
  currentFilter = filter;
  const container = document.getElementById('feed-container');
  const hint = document.getElementById('refresh-hint');
  container.innerHTML = '<div class="skeleton-loader"><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div></div>';
  if (hint) hint.style.display = 'none';

  try {
    let query = supabase
      .from('posts_with_counts')
      .select('*')
      .eq('status', 'active')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(30);

    if (filter !== 'all') query = query.eq('type', filter);

    const { data: posts, error } = await query;
    if (error) throw error;

    container.innerHTML = '';

    if (!posts || posts.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><h3>No posts yet</h3><p>Be the first to post something!</p></div>';
      if (hint) hint.style.display = 'block';
      return;
    }

    posts.forEach(post => container.appendChild(renderPost(post)));

    if (currentUser) loadUserLikes(posts.map(p => p.id));
  } catch (err) {
    container.innerHTML = '<div class="no-results">Failed to load feed.</div>';
    if (hint) hint.style.display = 'block';
    console.error(err);
  }
}

function renderPost(post) {
  const card = document.createElement('div');
  card.className = 'post-card' + (post.type === 'confession' ? ' confession-card' : '');
  card.dataset.postId = post.id;

  const isConfession = post.type === 'confession';
  const isAnnouncement = post.type === 'announcement';
  const isEvent = post.type === 'event';
  const isOwner = currentUser && post.user_id === currentUser.id;

  const authorName = isConfession ? 'Anonymous 🎭' : (post.author_name || 'Student');
  const authorAvatar = isConfession ? '' : (post.author_avatar || '');

  const badgeHtml = isAnnouncement ? '<span class="card-badge badge-announcement">📌 Pinned</span>'
    : isEvent ? '<span class="card-badge badge-event">📅 Event</span>'
    : isConfession ? '<span class="card-badge badge-confession">🎭 Confession</span>' : '';

  const pinnedHtml = post.is_pinned ? '<div class="pinned-indicator">📌 Pinned announcement</div>' : '';

  const imagesHtml = (() => {
    if (!post.images || post.images.length === 0) return '';
    const cls = post.images.length === 1 ? 'one-img' : 'two-img';
    const imgs = post.images.map(url =>
      `<img src="${url}" alt="" loading="lazy" draggable="false" oncontextmenu="return false" />`
    ).join('');
    return `<div class="card-images ${cls}">${imgs}</div>`;
  })();

  const categoryHtml = (isConfession && post.confession_category)
    ? `<div class="card-category">${getCategoryLabel(post.confession_category)}</div>` : '';

  card.innerHTML = `
    ${pinnedHtml}
    <div class="card-header">
      <div class="card-avatar">${authorAvatar ? `<img src="${authorAvatar}" alt="" />` : '🎭'}</div>
      <div class="card-meta">
        <div class="card-name">${escapeHtml(authorName)}</div>
        <div class="card-time">${timeAgo(post.created_at)}</div>
      </div>
      ${badgeHtml}
      <button class="post-menu-btn" data-post-id="${post.id}">⋯</button>
    </div>
    ${imagesHtml}
    ${post.caption ? `<div class="card-caption">${escapeHtml(post.caption)}</div>` : ''}
    ${categoryHtml}
    <div class="card-actions">
      <button class="action-btn like-btn" data-id="${post.id}">
        ❤️ <span class="like-count">${post.like_count || 0}</span>
      </button>
      <button class="action-btn comment-btn" data-id="${post.id}">
        💬 <span>${post.comment_count || 0}</span>
      </button>
    </div>
  `;

  // 3-dot menu
  const menuBtn = card.querySelector('.post-menu-btn');
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    // Remove any existing dropdowns
    document.querySelectorAll('.post-menu-dropdown').forEach(d => d.remove());

    const dropdown = document.createElement('div');
    dropdown.className = 'post-menu-dropdown';

    if (isOwner) {
      dropdown.innerHTML = `
        <button class="edit-caption-btn">✏️ Edit Caption</button>
        <button class="delete-post-btn danger-opt">🗑️ Delete Post</button>
      `;
      dropdown.querySelector('.edit-caption-btn').addEventListener('click', () => {
        dropdown.remove();
        openEditCaption(post.id, post.caption);
      });
      dropdown.querySelector('.delete-post-btn').addEventListener('click', () => {
        dropdown.remove();
        deletePost(post.id, card);
      });
    } else {
      dropdown.innerHTML = `
        <button class="report-post-btn">🚩 Report Post</button>
        <button class="hide-post-btn">🙈 Hide Post</button>
      `;
      dropdown.querySelector('.report-post-btn').addEventListener('click', () => {
        dropdown.remove();
        reportPost(post.id);
      });
      dropdown.querySelector('.hide-post-btn').addEventListener('click', () => {
        dropdown.remove();
        card.style.display = 'none';
        showToast('Post hidden');
      });
    }

    card.appendChild(dropdown);
    setTimeout(() => document.addEventListener('click', () => dropdown.remove(), { once: true }), 0);
  });

  card.querySelector('.like-btn').addEventListener('click', () => {
    requireAuth(() => toggleLike(post.id));
  });

  card.querySelector('.comment-btn').addEventListener('click', () => {
    openComments(post.id);
  });

  return card;
}

function openEditCaption(postId, currentCaption) {
  editingPostId = postId;
  document.getElementById('edit-caption-text').value = currentCaption || '';
  showModal('edit-caption-modal');
}

async function saveEditedCaption() {
  if (!editingPostId || !currentUser) return;
  const text = document.getElementById('edit-caption-text').value.trim();
  const { error } = await supabase.from('posts')
    .update({ caption: text })
    .eq('id', editingPostId)
    .eq('user_id', currentUser.id);
  if (!error) {
    closeAllModals();
    showToast('Caption updated ✅');
    loadFeed(currentFilter);
  } else {
    showToast('Failed to update: ' + error.message);
  }
}

async function deletePost(postId, cardEl) {
  if (!currentUser) return;
  if (!confirm('Delete this post?')) return;
  const { error } = await supabase.from('posts')
    .update({ status: 'removed' })
    .eq('id', postId)
    .eq('user_id', currentUser.id);
  if (!error) {
    cardEl.style.opacity = '0';
    cardEl.style.transition = 'opacity 0.3s';
    setTimeout(() => cardEl.remove(), 300);
    showToast('Post deleted');
  }
}

async function reportPost(postId) {
  requireAuth(async () => {
    await supabase.from('reports').insert({ reporter_id: currentUser.id, post_id: postId, reason: 'User report' });
    showToast('Post reported 🚩');
  });
}

async function loadUserLikes(postIds) {
  if (!currentUser || postIds.length === 0) return;
  const { data } = await supabase.from('likes').select('post_id').eq('user_id', currentUser.id).in('post_id', postIds);
  if (data) {
    data.forEach(like => {
      const btn = document.querySelector(`.like-btn[data-id="${like.post_id}"]`);
      if (btn) btn.classList.add('liked');
    });
  }
}

async function toggleLike(postId) {
  const btn = document.querySelector(`.like-btn[data-id="${postId}"]`);
  const countEl = btn?.querySelector('.like-count');
  const isLiked = btn?.classList.contains('liked');
  if (btn) btn.classList.toggle('liked');
  let count = parseInt(countEl?.textContent || '0');
  if (countEl) countEl.textContent = isLiked ? count - 1 : count + 1;
  if (isLiked) {
    await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', currentUser.id);
  } else {
    const { error } = await supabase.from('likes').insert({ post_id: postId, user_id: currentUser.id });
    if (error && error.code === '23505') {
      if (btn) btn.classList.add('liked');
      if (countEl) countEl.textContent = count;
    }
  }
}

async function openComments(postId) {
  currentCommentPostId = postId;
  showModal('comment-modal');
  const list = document.getElementById('comments-list');
  list.innerHTML = '<p style="text-align:center;color:var(--text3)">Loading...</p>';

  const { data: comments } = await supabase
    .from('comments_with_author').select('*').eq('post_id', postId).order('created_at', { ascending: true });

  list.innerHTML = '';
  if (!comments || comments.length === 0) {
    list.innerHTML = '<p style="text-align:center;color:var(--text3);padding:20px">No comments yet. Be the first!</p>';
    return;
  }
  comments.forEach(c => {
    const el = document.createElement('div');
    el.className = 'comment-item';
    el.innerHTML = `
      <div class="comment-avatar">${c.author_avatar ? `<img src="${c.author_avatar}" />` : '👤'}</div>
      <div class="comment-bubble">
        <div class="comment-author">${escapeHtml(c.author_name || 'Student')}</div>
        <div class="comment-text">${escapeHtml(c.content)}</div>
        <div class="comment-time">${timeAgo(c.created_at)}</div>
      </div>`;
    list.appendChild(el);
  });
}

async function submitComment() {
  if (!currentUser) return;
  const input = document.getElementById('comment-input');
  const content = input.value.trim();
  if (!content) return;
  input.value = '';
  const { error } = await supabase.from('comments').insert({ post_id: currentCommentPostId, user_id: currentUser.id, content });
  if (!error) {
    openComments(currentCommentPostId);
    const btn = document.querySelector(`.comment-btn[data-id="${currentCommentPostId}"] span`);
    if (btn) btn.textContent = parseInt(btn.textContent) + 1;
  }
}

// ===== IMAGE UPLOAD (mobile-fixed) =====
let _selectedImages = [];
window._selectedImages = _selectedImages;

function initImageUpload() {
  const dropZone = document.getElementById('image-drop-zone');
  const input = document.getElementById('image-input');
  if (!dropZone || !input) return;

  // Style the input for mobile
  input.style.position = 'absolute';
  input.style.opacity = '0';
  input.style.width = '100%';
  input.style.height = '100%';
  input.style.top = '0';
  input.style.left = '0';
  input.style.cursor = 'pointer';
  dropZone.style.position = 'relative';

  input.addEventListener('change', function(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    handleImageFiles(files);
    // Reset input so same file can be reselected
    input.value = '';
  });
}

function handleImageFiles(files) {
  const arr = Array.from(files);
  if (_selectedImages.length >= 2) {
    showToast('Max 2 images allowed');
    return;
  }
  const toAdd = arr.slice(0, 2 - _selectedImages.length);
  toAdd.forEach(file => {
    if (file.type.startsWith('image/')) {
      _selectedImages.push(file);
    }
  });
  window._selectedImages = _selectedImages;
  renderPreviews();
}

function renderPreviews() {
  const container = document.getElementById('image-previews');
  if (!container) return;
  container.innerHTML = '';
  _selectedImages.forEach((file, i) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const wrap = document.createElement('div');
      wrap.className = 'preview-wrap';
      const img = document.createElement('img');
      img.src = e.target.result;
      const removeBtn = document.createElement('button');
      removeBtn.className = 'preview-remove';
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        _selectedImages.splice(i, 1);
        window._selectedImages = _selectedImages;
        renderPreviews();
      });
      wrap.appendChild(img);
      wrap.appendChild(removeBtn);
      container.appendChild(wrap);
    };
    reader.readAsDataURL(file);
  });
}

async function submitImagePost() {
  if (!currentUser) return;
  const caption = document.getElementById('post-caption').value.trim();
  const files = window._selectedImages || [];

  if (!caption && files.length === 0) { showToast('Add a caption or image'); return; }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { count } = await supabase.from('posts').select('id', { count: 'exact' })
    .eq('user_id', currentUser.id).gte('created_at', today.toISOString());
  if (count >= 4) { showToast('Max 4 posts per day reached'); return; }

  const btn = document.getElementById('submit-post');
  btn.textContent = 'Posting...';
  btn.disabled = true;

  try {
    const imageUrls = [];
    for (const file of files) {
      const resized = await resizeImage(file);
      const path = `${currentUser.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const { error: upErr } = await supabase.storage.from('post-images').upload(path, resized, { contentType: 'image/jpeg' });
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from('post-images').getPublicUrl(path);
        imageUrls.push(publicUrl);
      }
    }

    const { error } = await supabase.from('posts').insert({
      user_id: currentUser.id, type: 'image', caption, images: imageUrls, status: 'active'
    });
    if (error) throw error;

    _selectedImages = [];
    window._selectedImages = _selectedImages;
    closeAllModals();
    showToast('Post shared! 🚀');
    loadFeed(currentFilter);
    if (currentUser) loadProfilePosts();
  } catch (err) {
    showToast('Failed to post: ' + err.message);
  } finally {
    btn.textContent = 'Post 🚀';
    btn.disabled = false;
  }
}

async function submitConfession() {
  if (!currentUser) return;
  const text = document.getElementById('confession-text').value.trim();
  const category = document.getElementById('confession-category').value;
  if (!text) { showToast('Write your confession first'); return; }
  if (!category) { showToast('Select a category'); return; }

  const btn = document.getElementById('submit-confession');
  btn.textContent = 'Submitting...';
  btn.disabled = true;

  try {
    const { error } = await supabase.from('posts').insert({
      user_id: currentUser.id, type: 'confession', caption: text, confession_category: category, status: 'active'
    });
    if (error) throw error;
    closeAllModals();
    showToast('Confession submitted anonymously 🎭');
    loadFeed(currentFilter);
  } catch (err) {
    showToast('Failed: ' + err.message);
  } finally {
    btn.textContent = 'Confess Anonymously 🎭';
    btn.disabled = false;
  }
}

function resizeImage(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxW = 1200;
        let w = img.width, h = img.height;
        if (w > maxW) { h = h * maxW / w; w = maxW; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.85);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Profile posts
async function loadProfilePosts() {
  if (!currentUser) return;
  const grid = document.getElementById('profile-grid');
  const emptyState = document.getElementById('profile-empty');
  if (!grid) return;
  grid.innerHTML = '';

  const { data: posts } = await supabase.from('posts')
    .select('*, likes(count)')
    .eq('user_id', currentUser.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  const postCount = document.getElementById('profile-post-count');
  if (postCount) postCount.textContent = posts?.length || 0;

  const totalLikes = posts?.reduce((sum, p) => sum + (p.likes?.[0]?.count || 0), 0) || 0;
  const likeCount = document.getElementById('profile-like-count');
  if (likeCount) likeCount.textContent = totalLikes;

  if (!posts || posts.length === 0) {
    emptyState?.classList.remove('hidden');
    return;
  }
  emptyState?.classList.add('hidden');

  posts.forEach(post => {
    const item = document.createElement('div');
    item.className = 'profile-grid-item';
    if (post.images && post.images.length > 0) {
      const img = document.createElement('img');
      img.src = post.images[0];
      img.alt = '';
      img.loading = 'lazy';
      item.appendChild(img);
    } else {
      const text = document.createElement('div');
      text.className = 'profile-grid-text';
      text.textContent = post.type === 'confession' ? '🎭 Confession' : (post.caption?.slice(0, 40) || '');
      item.appendChild(text);
    }
    grid.appendChild(item);
  });
}

function getCategoryLabel(cat) {
  const map = {
    crush: '💕 Crush / Love', rant: '😤 College Rant', funny: '😂 Funny / Embarrassing',
    academic: '📚 Academic Stress', social: '👥 Friends / Social Life',
    secret: '🤫 Secret / Guilt', motivation: '💪 Motivation / Positivity', other: '💬 Other'
  };
  return map[cat] || cat;
}
