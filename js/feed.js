// js/feed.js
let currentFilter = 'all';
let currentCommentPostId = null;

// ================= LOAD FEED =================
async function loadFeed(filter = 'all') {
  const container = document.getElementById('feed-container');
  container.innerHTML = `
    <div class="skeleton-loader">
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    </div>
  `;

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
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <h3>No posts yet</h3>
          <p>Be the first to post something!</p>
        </div>
      `;
      return;
    }

    posts.forEach(post => container.appendChild(renderPost(post)));

    if (currentUser) {
      loadUserLikes(posts.map(p => p.id));
    }
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="no-results">Failed to load feed.</div>`;
  }
}

// ================= RENDER POST =================
function renderPost(post) {
  const card = document.createElement('div');
  card.className = 'post-card' + (post.type === 'confession' ? ' confession-card' : '');
  card.dataset.postId = post.id;

  const isConfession = post.type === 'confession';
  const authorName = isConfession ? 'Anonymous 🎭' : (post.author_name || 'Student');
  const authorAvatar = isConfession ? '' : (post.author_avatar || '');

  const imagesHtml = (() => {
    if (!post.images || post.images.length === 0) return '';
    const cls = post.images.length === 1 ? 'one-img' : 'two-img';
    return `
      <div class="card-images ${cls}">
        ${post.images.map(u => `<img src="${u}" loading="lazy" />`).join('')}
      </div>
    `;
  })();

  card.innerHTML = `
    <div class="card-header">
      <div class="card-avatar">
        ${authorAvatar ? `<img src="${authorAvatar}" />` : '🎭'}
      </div>
      <div class="card-meta">
        <div class="card-name">${authorName}</div>
        <div class="card-time">${timeAgo(post.created_at)}</div>
      </div>
    </div>

    ${imagesHtml}
    ${post.caption ? `<div class="card-caption">${escapeHtml(post.caption)}</div>` : ''}

    <div class="card-actions">
      <!-- LIKE BUTTON -->
      <div class="tooltip sizer">
        <button 
          class="trigger like-trigger"
          data-id="${post.id}"
          aria-label="Like post"
        >
          <svg class="heart" width="24" height="24" viewBox="0 0 24 24">
            <path class="outline"
              d="M12 21s-6.7-4.6-9.3-8.2C.6 9.7 2.2 5.9 6 5.9c2 0 3.4 1.1 4 2.1.6-1 2-2.1 4-2.1 3.8 0 5.4 3.8 3.3 6.9C18.7 16.4 12 21 12 21z"
              fill="none" stroke="currentColor" stroke-width="2"/>
            <path class="fill"
              d="M12 21s-6.7-4.6-9.3-8.2C.6 9.7 2.2 5.9 6 5.9c2 0 3.4 1.1 4 2.1.6-1 2-2.1 4-2.1 3.8 0 5.4 3.8 3.3 6.9C18.7 16.4 12 21 12 21z"
              fill="currentColor"/>
          </svg>
        </button>
        <div class="content">
          <span class="like-count">${post.like_count || 0}</span>
        </div>
      </div>

      <!-- COMMENT -->
      <button class="action-btn comment-btn" data-id="${post.id}">
        💬 <span>${post.comment_count || 0}</span>
      </button>
    </div>
  `;

  // Like handler
  card.querySelector('.like-trigger').addEventListener('click', () => {
    requireAuth(() => toggleLike(post.id));
  });

  // Comment handler
  card.querySelector('.comment-btn').addEventListener('click', () => {
    openComments(post.id);
  });

  return card;
}

// ================= LIKE STATE =================
async function loadUserLikes(postIds) {
  if (!currentUser || postIds.length === 0) return;

  const { data } = await supabase
    .from('likes')
    .select('post_id')
    .eq('user_id', currentUser.id)
    .in('post_id', postIds);

  if (data) {
    data.forEach(like => {
      const btn = document.querySelector(`.like-trigger[data-id="${like.post_id}"]`);
      if (btn) btn.classList.add('liked');
    });
  }
}

// ================= TOGGLE LIKE =================
async function toggleLike(postId) {
  const btn = document.querySelector(`.like-trigger[data-id="${postId}"]`);
  const countEl = btn?.parentElement.querySelector('.like-count');
  const isLiked = btn?.classList.contains('liked');

  if (btn) btn.classList.toggle('liked');

  let count = parseInt(countEl?.textContent || '0');
  if (countEl) countEl.textContent = isLiked ? count - 1 : count + 1;

  if (isLiked) {
    await supabase
      .from('likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', currentUser.id);
  } else {
    const { error } = await supabase
      .from('likes')
      .insert({ post_id: postId, user_id: currentUser.id });

    if (error && error.code === '23505') {
      if (btn) btn.classList.add('liked');
      if (countEl) countEl.textContent = count;
    }
  }
}

// ================= COMMENTS =================
async function openComments(postId) {
  currentCommentPostId = postId;
  showModal('comment-modal');

  const list = document.getElementById('comments-list');
  list.innerHTML = '<p style="text-align:center">Loading...</p>';

  const { data: comments } = await supabase
    .from('comments_with_author')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  list.innerHTML = '';
  if (!comments || comments.length === 0) {
    list.innerHTML = '<p style="text-align:center">No comments yet.</p>';
    return;
  }

  comments.forEach(c => {
    const el = document.createElement('div');
    el.className = 'comment-item';
    el.innerHTML = `
      <div class="comment-avatar">
        ${c.author_avatar ? `<img src="${c.author_avatar}" />` : '👤'}
      </div>
      <div class="comment-bubble">
        <div class="comment-author">${escapeHtml(c.author_name || 'Student')}</div>
        <div class="comment-text">${escapeHtml(c.content)}</div>
        <div class="comment-time">${timeAgo(c.created_at)}</div>
      </div>
    `;
    list.appendChild(el);
  });
}
