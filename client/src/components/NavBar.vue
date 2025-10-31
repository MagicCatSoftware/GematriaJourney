<script setup>
import { computed, onMounted } from 'vue';
import { useAuth } from '../auth';
import { useRouter } from 'vue-router';

const auth = useAuth();            // <-- keep as an object, don't destructure
const router = useRouter();

const currentUser = computed(() => auth.me || null);
const isLoggedIn  = computed(() => !!currentUser.value);
const isAdmin     = computed(() => currentUser.value?.role === 'admin');
const isLifetime  = computed(() => !!currentUser.value?.isLifetime);
const displayName = computed(() => currentUser.value?.name || currentUser.value?.email || 'User');

onMounted(async () => {
  if (!currentUser.value && typeof auth.refreshMe === 'function') {
    try { await auth.refreshMe(); } catch {}
  }
});

async function handleLogout() {
  await auth.logout();
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

        <router-link v-if="isLoggedIn && !isLifetime" class="btn" to="/checkout">Become Lifetime</router-link>
        <router-link v-if="isLoggedIn" to="/workspace">Workspace</router-link>
        <router-link v-if="isLoggedIn" to="/my-profile">My Profile</router-link>
        <!-- ✅ will now show once refreshMe hydrates -->
        <router-link v-if="isAdmin" to="/admin">Admin</router-link>

        <router-link v-if="!isLoggedIn" class="btn" to="/login">Log in</router-link>
        <template v-else>
          <span class="me-chip">{{ displayName }}</span>
          <button class="btn small ghost logout" @click="handleLogout">Log out</button>
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
