// client/src/router.js
import { createRouter, createWebHistory } from 'vue-router';
import { getMe } from './api';

// Lazy views
const Home           = () => import('./views/Home.vue');
const Login          = () => import('./views/Login.vue');
const AuthSuccess    = () => import('./views/AuthSuccess.vue');
const CreateEntry    = () => import('./views/CreateEntry.vue');

const PublicSearch   = () => import('./views/PublicSearch.vue');
const Checkout       = () => import('./views/Checkout.vue');
const Workspace      = () => import('./views/Workspace.vue');
const MyProfile      = () => import('./views/MyProfile.vue');
const Admin          = () => import('./views/Admin.vue');
const PaymentSuccess = () => import('./views/PaymentSuccess.vue');

// Simple in-module cache
let cachedMe = null;
let mePromise = null;

async function ensureMe() {
  if (cachedMe) return cachedMe;
  if (!mePromise) {
    mePromise = getMe()
      .then(u => { cachedMe = u || null; return cachedMe; })
      .catch(() => { cachedMe = null; return null; })
      .finally(() => { mePromise = null; });
  }
  return mePromise;
}

function hasRequiredRole(user, required) {
  if (!required) return true;
  if (!user) return false;
  const role = user.role ?? user.roles;
  if (Array.isArray(role)) return role.includes(required);
  return role === required;
}
function isPaidOrAdmin(user) {
  if (!user) return false;
  return user.role === 'admin' || !!user.isLifetime;
}

// Routes
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/',               name: 'home',            component: Home },
    { path: '/login',          name: 'login',           component: Login },
    { path: '/auth-success',   name: 'auth-success',    component: AuthSuccess },

    // Public
    { path: '/search',         name: 'search',          component: PublicSearch },

    // Authed but not paywalled
    { path: '/checkout',       name: 'checkout',        component: Checkout,        meta: { auth: true } },
    { path: '/payment-success',name: 'payment-success', component: PaymentSuccess,  meta: { auth: true } },

    // Paywalled (paid or admin)
    { path: '/workspace',      name: 'workspace',       component: Workspace,       meta: { auth: true, paid: true } },
    { path: '/my-profile',     name: 'my-profile',      component: MyProfile,       meta: { auth: true, paid: true } },

    // Admin-only
    { path: '/admin',          name: 'admin',           component: Admin,           meta: { auth: true, role: 'admin' } },

    // 404 fallback
    { path: '/:pathMatch(.*)*', name: 'not-found', component: Home },
  ],
});

// ---- New: unpaid redirect policy ----
const UNPAID_ALLOW = new Set([
  'home',
  'login',
  'auth-success',
  'checkout',
  'payment-success',
  'search'
]);

router.beforeEach(async (to) => {
  // Home is always allowed without any check
  if (to.name === 'home') return true;

  // We only need "me" when navigating away from Home
  const me = await ensureMe();

  // If route requires auth and user isn't logged in → go to login
  if (to.meta?.auth && !me) {
    return { name: 'login', query: { next: to.fullPath } };
  }

  // Role-gated routes (e.g., admin)
  if (to.meta?.role && !hasRequiredRole(me, to.meta.role)) {
    return { name: 'home', query: { denied: '1' } };
  }

  // Global unpaid guard:
  // If user is logged in but NOT paid/admin, only allow allow-list routes.
  if (me && !isPaidOrAdmin(me) && !UNPAID_ALLOW.has(String(to.name || ''))) {
    return { name: 'checkout', query: { next: to.fullPath, reason: 'payment_required' } };
  }

  // Per-route paywall still respected (kept for clarity)
  if (to.meta?.paid && !isPaidOrAdmin(me)) {
    return { name: 'checkout', query: { next: to.fullPath, reason: 'payment_required' } };
  }

  return true;
});

export default router;

// Optional: helper to bust the cache after payment if needed elsewhere
export function clearMeCache() { cachedMe = null; }

