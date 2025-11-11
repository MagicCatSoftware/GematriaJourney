<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

// Local minimal user state (we're bypassing the app's auth store intentionally)
const user = ref(null);
const checking = ref(true);
const error = ref(null);

// convenience computed flags
const isLoggedIn = computed(() => !!user.value);
const isAdmin = computed(() => user.value?.role === 'admin');
const isLifetime = computed(() => !!user.value?.isLifetime);

// fetch /api/me directly from the server
async function checkSession() {
  checking.value = true;
  error.value = null;
  try {
    const res = await fetch('/api/me', {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });

    if (res.status === 401 || res.status === 403) {
      user.value = null;
      checking.value = false;
      return;
    }

    const ct = res.headers.get('content-type') || '';
    if (!res.ok) {
      if (ct.includes('application/json')) {
        const j = await res.json().catch(() => null);
        error.value = j?.error || `HTTP ${res.status}`;
      } else {
        error.value = `HTTP ${res.status}`;
      }
      user.value = null;
      checking.value = false;
      return;
    }

    if (!ct.includes('application/json')) {
      console.warn('Unexpected response content-type for /api/me:', ct);
      user.value = null;
      checking.value = false;
      return;
    }

    const data = await res.json();
    user.value = {
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role || 'user',
      isLifetime: !!data.isLifetime,
    };
  } catch (e) {
    console.error('checkSession error', e);
    user.value = null;
    error.value = e.message || String(e);
  } finally {
    checking.value = false;
  }
}

onMounted(() => {
  checkSession();
});

// small helpers
async function handleLogout() {
  try {
    await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
  } catch (e) {
    // ignore
  }
  user.value = null;
  router.push('/login');
}
</script>

<template>
  <header class="nav">
    <div class="nav__inner">
      <div class="brand" @click="$router.push('/')">
        <img src="/logo.png" alt="Gematria Journey logo" class="logo" />
      </div>

      <nav class="links">
        <router-link to="/">Home</router-link>

        <!-- Master List is public -->
        <router-link to="/master-list">Master List</router-link>

        <!-- show only when server says logged in AND not admin AND not lifetime -->
        <router-link
          v-if="isLoggedIn && !isAdmin && !isLifetime && !checking"
          class="btn btn--primary"
          to="/checkout"
        >
          Become a Lifetime Member
        </router-link>

        <router-link v-if="isLoggedIn" to="/workspace">Workspace</router-link>
        <router-link v-if="isLoggedIn" to="/my-profile">My Profile</router-link>
        <router-link v-if="isAdmin" to="/admin">Admin</router-link>

        <router-link
          v-if="!isLoggedIn && !checking"
          class="btn"
          to="/login"
        >
          Log in
        </router-link>

        <template v-else-if="isLoggedIn">
          <span class="me-chip">
            {{ user?.name || user?.email || 'User' }}
          </span>
          <button class="btn small ghost logout" @click="handleLogout">
            Log out
          </button>
        </template>
      </nav>
    </div>
  </header>
</template>




<style scoped>
.nav {
  position: sticky;
  top: 0;
  z-index: 40;
  color: var(--fg);
  background: rgba(0,0,0,.88);
  backdrop-filter: blur(6px);
  border-bottom: 1px solid #1e1e1e;
  box-shadow: inset 0 -1px 0 rgba(255,255,255,0.04);
}
.nav::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: .06;
  background:
    radial-gradient(1px 1px at 20% 35%, #fff 20%, transparent 21%),
    radial-gradient(1px 1px at 70% 60%, #fff 18%, transparent 19%),
    radial-gradient(1px 1px at 40% 80%, #fff 14%, transparent 15%);
  mix-blend-mode: screen;
}

.nav__inner {
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;
  padding: .65rem 1rem;
}

.brand {
  display: flex;
  align-items: center;
  gap: .5rem;
  cursor: pointer;
  user-select: none;
}
.logo {
  width: 200px;
  height: 200px;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 0 6px rgba(255,255,255,.3);
}
.name {
  font-weight: 800;
  letter-spacing: .4px;
  font-family: 'Chalkduster','Patrick Hand',cursive,system-ui,sans-serif;
  font-size: 1.2rem;
}

.links {
  display: flex;
  align-items: center;
  gap: .85rem;
  flex-wrap: wrap;
}
.links :deep(a) {
  color: var(--fg);
  text-decoration: none;
  padding: .25rem .2rem;
  border-radius: .35rem;
  opacity: .9;
  transition: opacity .15s ease, transform .15s ease, background-color .15s ease;
  font-weight: 500;
}
.links :deep(a:hover) {
  opacity: 1;
  transform: translateY(-1px);
  background-color: rgba(255,255,255,.04);
}
.links :deep(a.router-link-active) {
  font-weight: 700;
  box-shadow: 0 -2px 0 0 var(--fg) inset;
}

/* Buttons */
.btn {
  padding: .4rem .75rem;
  border-radius: .6rem;
  background: transparent;
  color: var(--fg);
  outline: 2px dashed rgba(255,255,255,.65);
  outline-offset: -4px;
  box-shadow: 0 0 0 1px rgba(255,255,255,.15) inset;
  transition: background .15s ease, transform .15s ease;
}
.btn:hover {
  background: rgba(255,255,255,.06);
  transform: translateY(-1px);
}
.btn.small {
  padding: .35rem .6rem;
  font-size: .9rem;
}
.btn.ghost {
  background: transparent;
}
.logout {
  color: #ff7777;
  outline-color: rgba(255,120,120,.6);
}
.logout:hover {
  background: rgba(255,80,80,.08);
}

.me-chip {
  color: var(--fg);
  background: rgba(255,255,255,.07);
  border: 1px dashed rgba(255,255,255,.35);
  padding: .32rem .6rem;
  border-radius: .6rem;
  max-width: 36ch;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 720px) {
  .nav__inner { padding: .55rem .75rem; gap: .5rem; }
  .links { gap: .6rem; }
  .logo { width: 200px; height: 200px; }
  .name { font-size: 1rem; }
}
</style>
