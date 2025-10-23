// src/main.js
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import './style.css';
import { refreshMe } from './auth';

(async () => {
  // try to fetch the session so NavBar can show authenticated links
  await refreshMe().catch(() => {});
  createApp(App).use(router).mount('#app');
})();