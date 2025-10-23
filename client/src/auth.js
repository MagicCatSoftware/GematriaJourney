import { reactive } from 'vue';
import { getMe } from './api';

const state = reactive({
  me: null,
  loading: false,
  error: null,
});

export async function refreshMe() {
  state.loading = true;
  state.error = null;
  try {
    state.me = await getMe();
  } catch (e) {
    state.me = null;
    state.error = e.message;
  } finally {
    state.loading = false;
  }
}

export function useAuth() {
  return state;
}
