// client/src/auth.js
import { reactive } from 'vue';
import api from './api';

const state = reactive({
  me: null,
  loading: false,
  error: null,
});

/**
 * Fetches the current user profile from the server.
 */
export async function refreshMe() {
  state.loading = true;
  state.error = null;
  try {
    state.me = await api.getMyProfile?.(); // or api.getMe() if your endpoint is named like that
    console.log(state.me);
} catch (e) {
    state.me = null;
    state.error = e.message || 'Failed to load user';
  } finally {
    state.loading = false;
  }
}

/**
 * Logs out the user both client and server side.
 */
export async function logout() {
  state.loading = true;
  try {
    // Tell server to clear cookie/session
    if (api.logout) {
      await api.logout();
    } else {
      // fallback if logout() not defined
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    }

    // Clear local storage / cookies
    try {
      localStorage.removeItem('token');
    } catch {}
    document.cookie = 'token=; Max-Age=0; path=/';

    // Clear user state
    state.me = null;
    state.error = null;
  } catch (e) {
    console.warn('Logout failed:', e);
    state.error = e.message || 'Logout failed';
  } finally {
    state.loading = false;
  }
}

/**
 * Composable used inside components
 */
export function useAuth() {
  return {
    state,
    get me() { return state.me; },
    get loading() { return state.loading; },
    get error() { return state.error; },
    refreshMe,
    logout,
  };
}

