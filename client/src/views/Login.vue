<template>
  <div class="card login">
    <h2>Log in</h2>
    <p>Choose a provider:</p>
    <div class="btns">
      <a class="btn" :href="googleUrl">Continue with Google</a>
      <a class="btn fb" :href="facebookUrl">Continue with Facebook</a>
    </div>
    <p class="muted">After login, you’ll be redirected back here.</p>
  </div>
</template>

<script setup>
import api from '../api';
const googleUrl = api.googleAuthUrl;
const facebookUrl = api.facebookAuthUrl;
</script>

<style scoped>
.login { max-width: 520px; margin: 2rem auto; }
.btns { display:flex; gap:.75rem; flex-wrap:wrap; }
.btn { display:inline-block; padding:.6rem 1rem; border-radius:.6rem; background:#111; color:#fff; text-decoration:none; }
.fb { background:#1877f2; }
.muted { color:#777; margin-top:.75rem; }
</style>