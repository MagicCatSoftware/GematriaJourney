import { createRouter, createWebHistory } from 'vue-router';
import { getMe } from './api';

const Home = () => import('./views/Home.vue');
const Login = () => import('./views/Login.vue');
const AuthSuccess = () => import('./views/AuthSuccess.vue');
const CreateGematria = () => import('./views/CreateGematria.vue');
const CreateEntry = () => import('./views/CreateEntry.vue');
const MyEntries = () => import('./views/MyEntries.vue');
const PublicSearch = () => import('./views/PublicSearch.vue');
const Checkout = () => import('./views/Checkout.vue');
const Workspace = () => import('./views/Workspace.vue');
const MyProfile = () => import('./views/MyProfile.vue');

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: Home },
    { path: '/login', name: 'login', component: Login },
    { path: '/auth-success', name: 'auth-success', component: AuthSuccess },
    { path: '/my-entries', name: 'my-entries', component: MyEntries, meta: { auth: true } },
    { path: '/search', name: 'search', component: PublicSearch },
    { path: '/checkout', name: 'checkout', component: Checkout, meta: { auth: true } },
     { path: '/workspace', name: 'workspace', component: Workspace, meta: { auth: true } },
    { path: '/my-profile', name: 'my-profile', component: MyProfile, meta: { auth: true } },
    ]
});

// simple auth guard using /api/me
router.beforeEach(async (to, from) => {
  if (!to.meta.auth) return true;
  try {
    const me = await getMe(); // throws on 401
    if (me) return true;
  } catch (e) {
    return { name: 'login', query: { next: to.fullPath } };
  }
});

export default router;
