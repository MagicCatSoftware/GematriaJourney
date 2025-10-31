<template>
  <div class="card login">
    <h2>Log in</h2>
    <p>Choose a provider:</p>
    <div class="btns">
      <!-- ✅ add .google class -->
      <a class="btn google" :href="googleUrl">
        <span>Continue with Google</span>
      </a>

      <!-- ✅ keep .fb class -->
      <a class="btn fb" :href="facebookUrl">
        <span>Continue with Facebook</span>
      </a>
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
.login {
  max-width: 480px;
  margin: 4rem auto;
  background: #0b0b0b;
  border: 1px solid #1f1f1f;
  border-radius: 16px;
  padding: 2rem;
  color: var(--fg);
  text-align: center;
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.02) inset,
    0 8px 30px rgba(0,0,0,0.4);
  position: relative;
}
.login::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: .05;
  background:
    radial-gradient(1px 1px at 20% 35%, #fff 20%, transparent 21%),
    radial-gradient(1px 1px at 75% 65%, #fff 18%, transparent 19%),
    radial-gradient(1px 1px at 45% 80%, #fff 14%, transparent 15%);
  mix-blend-mode: screen;
  border-radius: 16px;
}

h2 {
  font-family: 'Chalkduster','Patrick Hand',cursive,system-ui,sans-serif;
  font-size: 1.6rem;
  margin-bottom: .75rem;
}

p {
  font-size: 1rem;
}

.btns {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin: 1.75rem 0;
  align-items: stretch;
}

/* ==========================
   BASE BUTTON STYLE
========================== */
.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: .6rem;
  font-weight: 500;
  border-radius: 6px;
  text-decoration: none;
  cursor: pointer;
  padding: .7rem 1rem;
  transition: background .15s ease, box-shadow .15s ease, transform .1s ease;
  font-family: 'Roboto', Arial, sans-serif;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

/* ==========================
   OFFICIAL GOOGLE STYLE
========================== */
.btn.google {
  background-color: #fff;
  color: #3c4043;
  border: 1px solid #dadce0;
  font-size: 0.95rem;
  letter-spacing: 0.1px;
  justify-content: flex-start;
  padding-left: 0; /* let logo align left */
  width: 100%;
  box-shadow: 0 1px 3px rgba(60,64,67,0.15);
}

.btn.google:hover {
  background-color: #f7f8f8;
  box-shadow: 0 1px 4px rgba(60,64,67,0.25);
}

.btn.google:active {
  background-color: #eee;
}

/* Real Google G logo on left */
.btn.google::before {
  content: "";
  display: inline-block;
  width: 40px;
  height: 40px;
  background: #fff url("https://developers.google.com/identity/images/g-logo.png")
    no-repeat center center / 18px 18px;
  border-right: 1px solid #dadce0;
  border-radius: 4px 0 0 4px;
}

/* ==========================
   FACEBOOK STYLE
========================== */
.btn.fb {
  background-color: #1877f2;
  color: #fff;
  font-size: 0.95rem;
  letter-spacing: 0.1px;
  justify-content: center;
  width: 100%;
}

.btn.fb:hover {
  background: #166fe5;
}

.btn.fb:active {
  background: #145cda;
}

.btn.fb::before {
  content: "";
  display: inline-block;
  width: 20px;
  height: 20px;
  background: url("https://www.facebook.com/images/fb_icon_325x325.png")
    no-repeat center center / cover;
  border-radius: 3px;
}

/* ==========================
   TEXT BELOW
========================== */
.muted {
  color: var(--muted);
  margin-top: 1.5rem;
  font-size: .9rem;
}

/* ==========================
   FOCUS ACCESSIBILITY
========================== */
.btn:focus-visible {
  outline: 2px solid rgba(255,255,255,.95);
  outline-offset: 2px;
  border-radius:.5rem;
}

/* ==========================
   REDUCED MOTION
========================== */
@media (prefers-reduced-motion: reduce) {
  .btn { transition: none; }
}
</style>

