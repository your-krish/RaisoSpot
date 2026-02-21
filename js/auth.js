// js/auth.js
let currentUser = null;
let currentProfile = null;

async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) await handleSession(session);

  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session) {
      await handleSession(session);
    } else {
      currentUser = null;
      currentProfile = null;
      updateAuthUI(false);
    }
  });
}

async function handleSession(session) {
  currentUser = session.user;
  // Upsert profile
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
  const settingsProfile = document.getElementById('settings-profile');
  const settingsGuest = document.getElementById('settings-guest');

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
    if (sName) sName.textContent = currentUser.user_metadata?.full_name || 'Student';
    if (sEmail) sEmail.textContent = currentUser.email;
    if (sAvatar) sAvatar.src = currentUser.user_metadata?.avatar_url || '';
  } else {
    avatarWrap?.classList.add('hidden');
    headerLoginBtn?.classList.remove('hidden');
    settingsProfile?.classList.add('hidden');
    settingsGuest?.classList.remove('hidden');
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
}

function requireAuth(callback) {
  if (currentUser) {
    callback();
  } else {
    showModal('login-modal');
  }
}

function isAdmin() {
  return currentProfile?.is_admin === true;
}
