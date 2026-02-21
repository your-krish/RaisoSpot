// js/feed.js
let currentFilter = 'all';
let currentCommentPostId = null;
const postsCache = [];

async function loadFeed(filter = 'all') {
  const container = document.getElementById('feed-container');
  container.innerHTML = '<div class="skeleton-loader"><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div></div>';

  try {
    let query = supabase
      .from('posts_with_counts')
      .select('*')
      .eq('status', 'active')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(30);

    if (filter !== 'all') {
      query = query.eq('type', filter);
    }

    const { data: posts, error } = await query;
    if (error) throw error;

    container.innerHTML = '';
    if (!posts || posts.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><h3>No posts yet</h3><p>Be the first to post something!</p></div>';
      return;
    }

    posts.forEach(post => {
      container.appendChild(renderPost(post));
    });

    // Load like states if logged in
    if (currentUser) {
      loadUserLikes(posts.map(p => p.id));
    }
  } catch (err) {
    container.innerHTML = '<div class="no-results">Failed to load feed. Check your connection.</div>';
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

  const authorName = isConfession ? 'Anonymous 🎭' : (post.author_name || 'Student');
  const authorAvatar = isConfession ? '' : (post.author_avatar || '');

  const badgeHtml = isAnnouncement
    ? '<span class="card-badge badge-announcement">📌 Pinned</span>'
    : isEvent ? '<span class="card-badge badge-event">📅 Event</span>'
    : isConfession ? '<span class="card-badge badge-confession">🎭 Confession</span>'
    : '';

  const pinnedHtml = post.is_pinned ? '<div class="pinned-indicator">📌 Pinned announcement</div>' : '';

  const imagesHtml = (() => {
    if (!post.images || post.images.length === 0) return '';
    const cls = post.images.length === 1 ? 'one-img' : 'two-img';
    const imgs = post.images.map(url => `<img src="${url}" alt="" loading="lazy" />`).join('');
    return `<div class="card-images ${cls}">${imgs}</div>`;
  })();

  const categoryHtml = (isConfession && post.confession_category)
    ? `<div class="card-category">${getCategoryLabel(post.confession_category)}</div>` : '';

  card.innerHTML = `
    ${pinnedHtml}
    <div class="card-header">
      <div class="card-avatar">${authorAvatar ? `<img src="${authorAvatar}" alt="" />` : '🎭'}</div>
      <div class="card-meta">
        <div class="card-name">${authorName}</div>
        <div class="card-time">${timeAgo(post.created_at)}</div>
      </div>
      ${badgeHtml}
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

  // Like button
  card.querySelector('.like-btn').addEventListener('click', () => {
    requireAuth(() => toggleLike(post.id));
  });

  // Comment button
  card.querySelector('.comment-btn').addEventListener('click', () => {
    openComments(post.id);
  });

  return card;
}

async function loadUserLikes(postIds) {
  if (!currentUser || postIds.length === 0) return;
  const { data } = await supabase
    .from('likes')
    .select('post_id')
    .eq('user_id', currentUser.id)
    .in('post_id', postIds);

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

  // Optimistic update
  if (btn) btn.classList.toggle('liked');
  let count = parseInt(countEl?.textContent || '0');
  if (countEl) countEl.textContent = isLiked ? count - 1 : count + 1;

  if (isLiked) {
    await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', currentUser.id);
  } else {
    const { error } = await supabase.from('likes').insert({ post_id: postId, user_id: currentUser.id });
    if (error && error.code === '23505') {
      // Already liked, revert
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
    .from('comments_with_author')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  list.innerHTML = '';
  if (!comments || comments.length === 0) {
    list.innerHTML = '<p style="text-align:center;color:var(--text3);padding:20px">No comments yet. Be the first!</p>';
    return;
  }
  comments.forEach(c => {
    const el = document.createElement('div');
    el.className = 'comment-item';
    el.innerHTML = `
      <div class="comment-avatar">${c.author_avatar ? `<img src="${c.author_avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover" />` : '👤'}</div>
      <div class="comment-bubble">
        <div class="comment-author">${escapeHtml(c.author_name || 'Student')}</div>
        <div class="comment-text">${escapeHtml(c.content)}</div>
        <div class="comment-time">${timeAgo(c.created_at)}</div>
      </div>
    `;
    list.appendChild(el);
  });
}

async function submitComment() {
  if (!currentUser) return;
  const input = document.getElementById('comment-input');
  const content = input.value.trim();
  if (!content) return;

  input.value = '';
  const { error } = await supabase.from('comments').insert({
    post_id: currentCommentPostId,
    user_id: currentUser.id,
    content
  });
  if (!error) {
    openComments(currentCommentPostId);
    // Update comment count in feed
    const btn = document.querySelector(`.comment-btn[data-id="${currentCommentPostId}"] span`);
    if (btn) btn.textContent = parseInt(btn.textContent) + 1;
  }
}

async function submitImagePost() {
  if (!currentUser) return;
  const caption = document.getElementById('post-caption').value.trim();
  const files = window._selectedImages || [];

  if (!caption && files.length === 0) {
    showToast('Add a caption or image');
    return;
  }

  // Check daily limit
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from('posts')
    .select('id', { count: 'exact' })
    .eq('user_id', currentUser.id)
    .gte('created_at', today.toISOString());

  if (count >= MAX_POSTS_PER_DAY) {
    showToast(`Max ${MAX_POSTS_PER_DAY} posts per day reached`);
    return;
  }

  const btn = document.getElementById('submit-post');
  btn.textContent = 'Posting...';
  btn.disabled = true;

  try {
    // Upload images
    const imageUrls = [];
    for (const file of files) {
      const resized = await resizeImage(file);
      const path = `${currentUser.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from('post-images').upload(path, resized);
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from('post-images').getPublicUrl(path);
        imageUrls.push(publicUrl);
      }
    }

    const { data: post, error } = await supabase.from('posts').insert({
      user_id: currentUser.id,
      type: 'image',
      caption,
      images: imageUrls,
      status: 'active'
    }).select().single();

    if (error) throw error;

    closeAllModals();
    showToast('Post shared! 🚀');
    loadFeed(currentFilter);
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
      user_id: currentUser.id,
      type: 'confession',
      caption: text,
      confession_category: category,
      status: 'active'
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

// Image resize utility
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

function getCategoryLabel(cat) {
  const map = {
    crush: '💕 Crush / Love', rant: '😤 College Rant', funny: '😂 Funny / Embarrassing',
    academic: '📚 Academic Stress', social: '👥 Friends / Social Life',
    secret: '🤫 Secret / Guilt', motivation: '💪 Motivation / Positivity', other: '💬 Other'
  };
  return map[cat] || cat;
}
