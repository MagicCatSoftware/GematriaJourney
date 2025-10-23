<!-- src/components/NavBar.vue -->
<template>
  <header class="nav">
    <div class="nav__inner">
      <div class="brand" @click="$router.push('/')">
        <span class="dot"></span>
        <span class="name">{{ siteName }}</span>
      </div>

      <nav class="links">
        <router-link to="/">Home</router-link>

        <!-- Protected links appear once session is loaded and user exists -->
        <router-link v-if="me && !me.isLifetime" class="btn" to="/checkout">Become Lifetime</router-link>
        <router-link v-if="me" to="/workspace">Workspace</router-link>
        <router-link v-if="me" to="/my-profile">My Profile</router-link>
        <router-link v-if="!me" class="btn" to="/login">Log in</router-link>
        <span v-else class="me-chip" title="You are signed in">{{ me.name || me.email }}</span>
      </nav>
    </div>
  </header>
</template>

<script setup>
import { useAuth } from '../auth';
const siteName = import.meta.env.VITE_SITE_NAME || 'GematriaJourney';
const { me } = useAuth();
</script>

<style scoped>
.nav { position: sticky; top: 0; background: rgba(255,255,255,.86); backdrop-filter: blur(6px); border-bottom: 1px solid #ececec; z-index: 40; }
.nav__inner { max-width: 1100px; margin: 0 auto; display:flex; align-items:center; justify-content:space-between; padding: .75rem 1rem; }
.brand { display:flex; align-items:center; gap:.5rem; cursor:pointer; font-weight: 700; }
.dot { width:10px; height:10px; border-radius:50%; background: #111; }
.links { display:flex; align-items:center; gap:1rem; flex-wrap: wrap; }
a.router-link-active { font-weight: 600; }
.btn { padding: .35rem .7rem; border-radius: .5rem; background:#111; color:white; }
.me-chip { background:#f4f4f4; padding: .3rem .6rem; border-radius:.5rem; }
</style>

