// js/app.js
// ===== UTILITIES =====
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function showToast(msg, duration = 3000) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), duration);
}

function showModal(id) {
  document.getElementById(id)?.classList.remove('hidden');
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
}

// ===== NAVIGATION =====
function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');

  const navBtn = document.querySelector(`.nav-btn[data-page="${page}"]`);
  if (navBtn) navBtn.classList.add('active');

  // Load page content
  if (page === 'feed') loadFeed(currentFilter);
  if (page === 'academics') loadAcademics(currentYear || '1');
  if (page === 'opportunities') loadOpportunities();
  if (page === 'settings') loadLostFound('lost');
}

// ===== ONBOARDING =====
function initOnboarding() {
  const seen = localStorage.getItem('raisospot_onboarding');
  if (!seen) {
    document.getElementById('onboarding').classList.remove('hidden');
  }

  let slide = 0;
  const slides = document.querySelectorAll('.slide');
  const dots = document.querySelectorAll('.dot');
  const nextBtn = document.getElementById('ob-next');

  function goTo(n) {
    slides.forEach(s => s.classList.remove('active'));
    dots.forEach(d => d.classList.remove('active'));
    slides[n].classList.add('active');
    dots[n].classList.add('active');
    nextBtn.textContent = n === slides.length - 1 ? 'Get Started' : 'Next →';
  }

  nextBtn.addEventListener('click', () => {
    if (slide < slides.length - 1) { slide++; goTo(slide); }
    else { finishOnboarding(); }
  });

  document.getElementById('ob-google-btn').addEventListener('click', signInWithGoogle);
  document.getElementById('ob-skip-btn').addEventListener('click', finishOnboarding);
}

function finishOnboarding() {
  localStorage.setItem('raisospot_onboarding', '1');
  document.getElementById('onboarding').classList.add('hidden');
}

// ===== IMAGE UPLOAD =====
let _selectedImages = [];
window._selectedImages = _selectedImages;

function initImageUpload() {
  const dropZone = document.getElementById('image-drop-zone');
  const input = document.getElementById('image-input');

  dropZone?.addEventListener('click', () => input.click());
  input?.addEventListener('change', e => handleImageFiles(e.target.files));
}

function handleImageFiles(files) {
  const arr = Array.from(files);
  if (arr.length + _selectedImages.length > MAX_IMAGES_PER_POST) {
    showToast(`Max ${MAX_IMAGES_PER_POST} images allowed`);
  }
  const toAdd = arr.slice(0, MAX_IMAGES_PER_POST - _selectedImages.length);
  _selectedImages.push(...toAdd);
  window._selectedImages = _selectedImages;
  renderPreviews();
}

function renderPreviews() {
  const container = document.getElementById('image-previews');
  container.innerHTML = '';
  _selectedImages.forEach((file, i) => {
    const url = URL.createObjectURL(file);
    const wrap = document.createElement('div');
    wrap.className = 'preview-wrap';
    wrap.innerHTML = `<img src="${url}" /><button class="preview-remove" data-i="${i}">✕</button>`;
    wrap.querySelector('.preview-remove').addEventListener('click', () => {
      _selectedImages.splice(i, 1);
      window._selectedImages = _selectedImages;
      renderPreviews();
    });
    container.appendChild(wrap);
  });
}

// ===== SEARCH =====
let searchTimeout;
function initSearch() {
  const input = document.getElementById('search-input');
  input?.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => performSearch(input.value.trim()), 400);
  });
}

async function performSearch(query) {
  if (!query) return;
  const { data } = await supabase
    .from('posts')
    .select('*')
    .eq('status', 'active')
    .ilike('caption', `%${query}%`)
    .limit(20);

  // Navigate to feed and show results
  navigateTo('feed');
  document.getElementById('search-bar').classList.add('hidden');
  const container = document.getElementById('feed-container');
  container.innerHTML = '';
  if (!data || data.length === 0) {
    container.innerHTML = `<div class="no-results">No results for "${escapeHtml(query)}"</div>`;
    return;
  }
  data.forEach(p => container.appendChild(renderPost(p)));
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  await initAuth();
  initOnboarding();
  initImageUpload();
  initSearch();
  loadFeed('all');

  // Nav buttons
  document.querySelectorAll('.nav-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });

  // Create button
  document.getElementById('create-btn').addEventListener('click', () => {
    requireAuth(() => showModal('create-modal'));
  });

  // Create options
  document.querySelectorAll('.create-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      closeAllModals();
      if (opt.dataset.type === 'image') {
        _selectedImages = [];
        window._selectedImages = _selectedImages;
        document.getElementById('post-caption').value = '';
        document.getElementById('image-previews').innerHTML = '';
        showModal('image-post-modal');
      } else if (opt.dataset.type === 'confession') {
        document.getElementById('confession-text').value = '';
        document.getElementById('confession-category').value = '';
        showModal('confession-modal');
      }
    });
  });

  // Feed filters
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      loadFeed(currentFilter);
    });
  });

  // Year tabs (academics)
  document.querySelectorAll('.year-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.year-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      loadAcademics(tab.dataset.year);
    });
  });

  // Opportunity filters
  document.getElementById('opp-type-filter')?.addEventListener('change', () => {
    loadOpportunities(
      document.getElementById('opp-type-filter').value,
      document.getElementById('opp-year-filter').value
    );
  });
  document.getElementById('opp-year-filter')?.addEventListener('change', () => {
    loadOpportunities(
      document.getElementById('opp-type-filter').value,
      document.getElementById('opp-year-filter').value
    );
  });

  // Modal close buttons
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });
  document.querySelectorAll('.modal-backdrop').forEach(bd => {
    bd.addEventListener('click', closeAllModals);
  });

  // Auth buttons
  ['ob-google-btn', 'modal-google-btn', 'settings-login-btn'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', signInWithGoogle);
  });
  document.getElementById('header-login-btn')?.addEventListener('click', () => showModal('login-modal'));
  document.getElementById('logout-btn')?.addEventListener('click', signOut);

  // Post submissions
  document.getElementById('submit-post')?.addEventListener('click', submitImagePost);
  document.getElementById('submit-confession')?.addEventListener('click', submitConfession);
  document.getElementById('submit-comment')?.addEventListener('click', () => requireAuth(submitComment));
  document.getElementById('comment-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') requireAuth(submitComment);
  });

  // Bug report
  document.getElementById('report-bug-btn')?.addEventListener('click', () => showModal('bug-modal'));
  document.getElementById('submit-bug')?.addEventListener('click', submitBugReport);

  // Lost & Found tabs
  document.querySelectorAll('.lf-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.lf-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      loadLostFound(tab.dataset.tab);
    });
  });
  document.getElementById('report-item-btn')?.addEventListener('click', () => {
    requireAuth(() => showModal('lost-item-modal'));
  });
  document.getElementById('submit-item')?.addEventListener('click', submitLostItem);

  // Search
  document.getElementById('search-btn')?.addEventListener('click', () => {
    document.getElementById('search-bar').classList.toggle('hidden');
    if (!document.getElementById('search-bar').classList.contains('hidden')) {
      document.getElementById('search-input').focus();
    }
  });
  document.getElementById('search-close')?.addEventListener('click', () => {
    document.getElementById('search-bar').classList.add('hidden');
    document.getElementById('search-input').value = '';
  });

  // Settings toggles
  const darkToggle = document.getElementById('dark-toggle');
  const animToggle = document.getElementById('anim-toggle');

  if (localStorage.getItem('dark') === '1') {
    document.body.classList.add('dark');
    if (darkToggle) darkToggle.checked = true;
  }
  if (localStorage.getItem('reduce-anim') === '1') {
    document.body.classList.add('reduce-motion');
    if (animToggle) animToggle.checked = true;
  }

  darkToggle?.addEventListener('change', () => {
    document.body.classList.toggle('dark', darkToggle.checked);
    localStorage.setItem('dark', darkToggle.checked ? '1' : '0');
  });
  animToggle?.addEventListener('change', () => {
    document.body.classList.toggle('reduce-motion', animToggle.checked);
    localStorage.setItem('reduce-anim', animToggle.checked ? '1' : '0');
  });
});
