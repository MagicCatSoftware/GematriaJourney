// client/src/router.js
import { createRouter, createWebHistory } from 'vue-router';
import { getMe } from './api';

// Lazy views
const Home         = () => import('./views/Home.vue');
const Login        = () => import('./views/Login.vue');
const AuthSuccess  = () => import('./views/AuthSuccess.vue');
const CreateGematria = () => import('./views/CreateGematria.vue');
const CreateEntry  = () => import('./views/CreateEntry.vue');
const MyEntries    = () => import('./views/MyEntries.vue');
const PublicSearch = () => import('./views/PublicSearch.vue');
const Checkout     = () => import('./views/Checkout.vue');
const Workspace    = () => import('./views/Workspace.vue');
const MyProfile    = () => import('./views/MyProfile.vue');
const Admin        = () => import('./views/Admin.vue'); // ✅ added

// Simple in-module cache to avoid calling /api/me on every route
let cachedMe = null;
let mePromise = null;

async function ensureMe() {
  if (cachedMe) return cachedMe;
  if (!mePromise) {
    mePromise = getMe()
      .then(u => {
        cachedMe = u || null;
        return cachedMe;
      })
      .catch(() => {
        cachedMe = null;
        return null;
      })
      .finally(() => {
        mePromise = null;
      });
  }
  return mePromise;
}

function hasRequiredRole(user, required) {
  if (!required) return true;
  if (!user) return false;
  const r = user.role ?? user.roles;
  if (Array.isArray(r)) return r.includes(required);
  return r === required;
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/',               name: 'home',        component: Home },
    { path: '/login',          name: 'login',       component: Login },
    { path: '/auth-success',   name: 'auth-success',component: AuthSuccess },

    // Public
    { path: '/search',         name: 'search',      component: PublicSearch },

    // Authed
    { path: '/my-entries',     name: 'my-entries',  component: MyEntries,  meta: { auth: true } },
    { path: '/checkout',       name: 'checkout',    component: Checkout,   meta: { auth: true } },
    { path: '/workspace',      name: 'workspace',   component: Workspace,  meta: { auth: true } },
    { path: '/my-profile',     name: 'my-profile',  component: MyProfile,  meta: { auth: true } },

    // ✅ Admin-only
    { path: '/admin',          name: 'admin',       component: Admin,      meta: { auth: true} },

    // Optional: 404
    { path: '/:pathMatch(.*)*', name: 'not-found',  component: Home },
  ],
});

// Global guard: checks auth, then role if required
router.beforeEach(async (to) => {
  // No auth needed → allow
  if (!to.meta?.auth) return true;

  // Ensure we know the current user
  const me = await ensureMe();
  if (!me) {
    // Not logged in → go to login, preserve destination
    return { name: 'login', query: { next: to.fullPath } };
  }

  // Role check (e.g., Admin)
  if (to.meta?.role && !hasRequiredRole(me, to.meta.role)) {
    // Lacks required role → send home (or route to a 403 page if you have one)
    return { name: 'home', query: { denied: '1' } };
  }

  return true;
});

export default router;
