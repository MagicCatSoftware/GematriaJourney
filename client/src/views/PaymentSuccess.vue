<script setup>
import { onMounted, ref } from 'vue';
import api, { getMe } from '../api'; // make sure getMe is exported
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const loading = ref(true);
const error = ref('');

onMounted(async () => {
  const sessionId = route.query.session_id;
  if (!sessionId) {
    error.value = 'Missing session_id.';
    loading.value = false;
    return;
  }

  try {
    // Confirm on server (idempotent)
    await api.post('/api/stripe/confirm-session', { session_id: sessionId });
window.location.href = '/workspace';
    // ✅ Refresh current user to pick up isLifetime=true
    const me = await getMe();
    if (me) {
      // overwrite cachedMe if you use that global cache
      if (typeof window !== 'undefined') {
        window.cachedMe = me;
      }
    }

    loading.value = false;

    // Optionally auto-redirect
    setTimeout(() => router.push({ name: 'workspace' }), 1000);
  } catch (e) {
    error.value = e?.response?.data?.error || e?.message || 'Unable to confirm payment.';
    loading.value = false;
  }
});
</script>