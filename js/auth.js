// js/auth.js
let currentUser = null;
let currentProfile = null;

async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) await handleSession(session);

  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session) {
      await handleSession(session);
      // Navigate to profile after login
      navigateTo('profile');
    } else {
      currentUser = null;
      currentProfile = null;
      updateAuthUI(false);
    }
  });
}

async function handleSession(session) {
  currentUser = session.user;
  const { data } = await supabase.from('profiles').upsert({
    id: currentUser.id,
    name: currentUser.user_metadata?.full_name || 'Student',
    avatar_url: currentUser.user_metadata?.avatar_url || '',
    email: currentUser.email,
  }, { onConflict: 'id' }).select().single();
  currentProfile = data;
  updateAuthUI(true);
}

function updateAuthUI(loggedIn) {
  const avatarWrap = document.getElementById('user-avatar-wrap');
  const headerLoginBtn = document.getElementById('header-login-btn');
  const settingsProfile = document.getElementById('settings-profile-inline');
  const settingsGuest = document.getElementById('settings-guest-inline');

  if (loggedIn && currentUser) {
    avatarWrap?.classList.remove('hidden');
    headerLoginBtn?.classList.add('hidden');
    const avatar = document.getElementById('user-avatar');
    if (avatar) avatar.src = currentUser.user_metadata?.avatar_url || '';

    settingsProfile?.classList.remove('hidden');
    settingsGuest?.classList.add('hidden');

    const sName = document.getElementById('settings-name');
    const sEmail = document.getElementById('settings-email');
    const sAvatar = document.getElementById('settings-avatar');
    if (sName) sName.textContent = currentProfile?.name || currentUser.user_metadata?.full_name || 'Student';
    if (sEmail) sEmail.textContent = currentUser.email;
    if (sAvatar) sAvatar.src = currentUser.user_metadata?.avatar_url || '';

    // Profile page
    updateProfilePage();
  } else {
    avatarWrap?.classList.add('hidden');
    headerLoginBtn?.classList.remove('hidden');
    settingsProfile?.classList.add('hidden');
    settingsGuest?.classList.remove('hidden');
  }
}

function updateProfilePage() {
  if (!currentUser) return;
  const avatarImg = document.getElementById('profile-avatar-img');
  const usernameDisplay = document.getElementById('profile-username-display');
  const emailDisplay = document.getElementById('profile-email-display');
  const nameInput = document.getElementById('profile-name-input');

  if (avatarImg) avatarImg.src = currentProfile?.avatar_url || currentUser.user_metadata?.avatar_url || '';
  if (usernameDisplay) usernameDisplay.textContent = currentProfile?.name || currentUser.user_metadata?.full_name || 'Student';
  if (emailDisplay) emailDisplay.textContent = currentUser.email;
  if (nameInput) nameInput.value = currentProfile?.name || '';
}

async function saveProfileName() {
  if (!currentUser) return;
  const input = document.getElementById('profile-name-input');
  const name = input?.value.trim();
  if (!name) return;

  const { error } = await supabase.from('profiles').update({ name }).eq('id', currentUser.id);
  if (!error) {
    if (currentProfile) currentProfile.name = name;
    document.getElementById('profile-username-display').textContent = name;
    document.getElementById('settings-name').textContent = name;
    showToast('Name updated! ✅');
  }
}


async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: 'https://your-krish.github.io/RaisoSpot/index.html' }
  });
  if (error) showToast('Login failed: ' + error.message);
}

async function signOut() {
  await supabase.auth.signOut();
  showToast('Logged out successfully');
  navigateTo('feed');
}

function requireAuth(callback) {
  if (currentUser) callback();
  else showModal('login-modal');
}

function isAdmin() {
  return currentProfile?.is_admin === true;
}

