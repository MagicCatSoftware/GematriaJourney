<template>
  <NavBar />
  <main class="container">
    <router-view />
  </main>
  <footer class="foot">© {{ new Date().getFullYear() }} {{ siteName }} · Ads may appear</footer>
</template>

<script setup>
import NavBar from './components/NavBar.vue';
const siteName = import.meta.env.VITE_SITE_NAME || 'GematriaJourney';
</script>

<style scoped>
.container { max-width: 1100px; margin: 1.25rem auto; padding: 0 1rem; }
.foot { text-align:center; color:#777; font-size:.9rem; padding:2rem 0; }
</style>
