<template>
  <!-- Trigger -->
  <span
    class="gj-hover-trigger"
    ref="triggerEl"
    @mouseenter="handleEnter"
    @mouseleave="handleLeave"
    @focus="handleEnter"
    @blur="handleLeave"
    tabindex="0"
  >
    <slot />
  </span>

  <!-- Floating card rendered to <body> so it won't be clipped -->
  <teleport to="body">
    <transition name="gj-fade">
      <div
        v-if="open"
        ref="cardEl"
        class="gj-hover-card"
        :style="styleObj"
        :data-loading="!mini"
        role="dialog"
        aria-modal="false"
        @mouseenter="cancelClose"
        @mouseleave="scheduleClose"
      >
        <div class="gj-row">
          <span class="gj-avatar-wrap">
            <img :src="mini?.photoUrl || fallback" alt="" class="gj-avatar" />
          </span>
          <div>
            <div class="gj-name">{{ mini?.name || mini?.email || 'User' }}</div>
            <div v-if="mini?.email" class="gj-muted gj-small">{{ mini.email }}</div>
          </div>
        </div>

        <div v-if="mini?.bio" class="gj-bio">{{ mini.bio }}</div>

        <div class="gj-meta">
          <span class="gj-dot"></span>
          <span class="gj-muted gj-tiny">Joined: {{ formatDate(mini?.createdAt) }}</span>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import api from '../api';

const props = defineProps({
  userId: { type: String, required: true },
  openDelay:  { type: Number, default: 80 },
  closeDelay: { type: Number, default: 120 },
  offset: { type: Number, default: 8 },
  placement: { type: String, default: 'bottom' },
});

const open = ref(false);
const mini = ref(null);
const triggerEl = ref(null);
const cardEl = ref(null);
const fallback = 'https://avatars.githubusercontent.com/u/0?v=4';

const pos = reactive({ top: 0, left: 0, transform: 'translateX(-50%)' });
const styleObj = computed(() => ({
  position: 'absolute',
  top: pos.top + 'px',
  left: pos.left + 'px',
  transform: pos.transform,
  zIndex: 9999
}));

let openTimer = null;
let closeTimer = null;
let bound = false;

function formatDate(x) {
  if (!x) return '—';
  try { return new Date(x).toLocaleDateString(); } catch { return '—'; }
}

function cancelOpen()  { if (openTimer)  { clearTimeout(openTimer);  openTimer = null; } }
function cancelClose() { if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; } }

async function handleEnter() {
  cancelClose();
  if (!mini.value) {
    try { mini.value = await api.getMiniProfile(props.userId); } catch { /* ignore */ }
  }
  cancelOpen();
  openTimer = setTimeout(async () => {
    open.value = true;
    await nextTick();
    positionCard();
    bindScrollResize();
  }, props.openDelay);
}

function handleLeave() { scheduleClose(); }
function scheduleClose() {
  cancelOpen();
  cancelClose();
  closeTimer = setTimeout(() => {
    open.value = false;
    unbindScrollResize();
  }, props.closeDelay);
}

function bindScrollResize() {
  if (bound) return;
  bound = true;
  window.addEventListener('scroll', onMove, true);
  window.addEventListener('resize', onMove, true);
}
function unbindScrollResize() {
  if (!bound) return;
  bound = false;
  window.removeEventListener('scroll', onMove, true);
  window.removeEventListener('resize', onMove, true);
}
function onMove() { if (open.value) positionCard(); }

/** Compute top/left and flip if needed */
function positionCard() {
  const t = triggerEl.value?.getBoundingClientRect?.();
  const c = cardEl.value?.getBoundingClientRect?.();
  if (!t || !c) return;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const scrollX = window.scrollX || 0;
  const scrollY = window.scrollY || 0;

  const wantBottom = props.placement !== 'top';
  const spaceBelow = vh - t.bottom;
  const spaceAbove = t.top;

  let top;
  if (wantBottom) {
    if (spaceBelow >= c.height + props.offset || spaceBelow >= spaceAbove) {
      top = t.bottom + props.offset + scrollY;
    } else {
      top = t.top - c.height - props.offset + scrollY;
    }
  } else {
    if (spaceAbove >= c.height + props.offset || spaceAbove >= spaceBelow) {
      top = t.top - c.height - props.offset + scrollY;
    } else {
      top = t.bottom + props.offset + scrollY;
    }
  }

  let left = t.left + t.width / 2 + scrollX;
  let transform = 'translateX(-50%)';

  const minLeft = 12 + scrollX;
  const maxLeft = vw - 12 + scrollX;

  if (left - c.width / 2 < minLeft) {
    left = Math.max(minLeft, left - (left - c.width / 2 - minLeft));
    transform = 'translateX(0)';
  } else if (left + c.width / 2 > maxLeft) {
    left = Math.min(maxLeft, left - (left + c.width / 2 - maxLeft));
    transform = 'translateX(-100%)';
  }

  pos.top = Math.round(top);
  pos.left = Math.round(left);
  pos.transform = transform;
}

onMounted(() => {
  triggerEl.value?.addEventListener?.('keydown', (e) => {
    if (e.key === 'Escape') scheduleClose();
  });
});
onBeforeUnmount(() => {
  cancelOpen();
  cancelClose();
  unbindScrollResize();
});
</script>

<style scoped>
/* Theme tokens (inherits your app vars if present) */
:root {
  --gj-card-bg: rgba(6, 12, 14, 0.86);
  --gj-card-border: rgba(172, 255, 230, 0.25); /* minty */
  --gj-accent-1: #2bd1ff;  /* cyan */
  --gj-accent-2: #20e37a;  /* green */
  --gj-text: var(--fg, #e8f4f2);
  --gj-muted: #8ea2a1;
}

/* Trigger */
.gj-hover-trigger {
  display: inline-block;
  cursor: pointer;
  color: inherit;
  outline: none;
}
.gj-hover-trigger:focus {
  outline: 2px solid color-mix(in oklab, var(--gj-accent-1) 50%, white);
  outline-offset: 2px;
}

/* Card (dark glass, gradient border, arrow) */
.gj-hover-card {
  position: absolute;
  color: var(--gj-text);
  background: var(--gj-card-bg);
  border: 1px solid var(--gj-card-border);
  border-radius: 14px;
  padding: .85rem .95rem;
  width: 290px;
  pointer-events: auto;
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  box-shadow:
    0 12px 28px rgba(0, 0, 0, .35),
    0 0 0 1px rgba(255, 255, 255, .06) inset;

  /* gradient border sheen */
  position: absolute;
  overflow: hidden;
}
.gj-hover-card::before {
  content: "";
  position: absolute;
  inset: -1px;
  border-radius: 14px;
  padding: 1px;
  background:
    conic-gradient(from 140deg,
      color-mix(in oklab, var(--gj-accent-1) 70%, transparent),
      color-mix(in oklab, var(--gj-accent-2) 70%, transparent),
      transparent 60%);
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}
.gj-hover-card::after {
  /* little arrow */
  content: "";
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: -7px;
  width: 12px; height: 12px;
  background: var(--gj-card-bg);
  border-left: 1px solid var(--gj-card-border);
  border-bottom: 1px solid var(--gj-card-border);
  rotate: 45deg;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,.25));
}

/* Layout */
.gj-row {
  display:flex; gap:.7rem; align-items:center; margin-bottom:.5rem;
}

/* Avatar with glowing ring */
.gj-avatar-wrap {
  --r: 52px;
  width: var(--r); height: var(--r);
  padding: 2px;
  border-radius: 999px;
  background:
    radial-gradient(circle at 30% 30%, rgba(255,255,255,.25), transparent 45%),
    conic-gradient(from 220deg, var(--gj-accent-1), var(--gj-accent-2));
  box-shadow: 0 0 16px rgba(32, 227, 122, .25);
}
.gj-avatar {
  width: 100%; height: 100%;
  border-radius: 999px; object-fit: cover;
  display: block;
  box-shadow: 0 0 0 1px rgba(255,255,255,.12) inset;
}

/* Typography */
.gj-name {
  font-weight: 800;
  line-height: 1.08;
  letter-spacing: .2px;
  /* subtle gradient ink */
  background: linear-gradient(
      180deg,
      color-mix(in oklab, var(--gj-text) 92%, white) 0%,
      var(--gj-text) 60%,
      color-mix(in oklab, var(--gj-accent-2) 22%, var(--gj-text)) 100%
  );
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.gj-bio {
  margin:.4rem 0 .5rem;
  color: var(--gj-text);
  opacity: .92;
}
.gj-muted { color: var(--gj-muted); }
.gj-small { font-size:.92rem; }
.gj-tiny  { font-size:.8rem; }

/* Meta row with accent dot */
.gj-meta {
  display:flex; align-items:center; gap:.45rem;
  border-top: 1px dashed rgba(255,255,255,.08);
  padding-top: .55rem;
}
.gj-dot {
  width:8px; height:8px; border-radius:50%;
  background: radial-gradient(circle at 30% 30%, #fff, var(--gj-accent-2));
  box-shadow: 0 0 10px color-mix(in oklab, var(--gj-accent-2) 60%, transparent);
}

/* Loading shimmer (when :data-loading="true") */
.gj-hover-card[data-loading="true"] .gj-avatar { opacity: .6; filter: grayscale(.3); }
.gj-hover-card[data-loading="true"] .gj-name,
.gj-hover-card[data-loading="true"] .gj-bio,
.gj-hover-card[data-loading="true"] .gj-meta .gj-tiny,
.gj-hover-card[data-loading="true"] .gj-small {
  position: relative;
  color: transparent !important;
  background: linear-gradient(90deg, rgba(255,255,255,.08), rgba(255,255,255,.18), rgba(255,255,255,.08));
  background-size: 220% 100%;
  border-radius: 6px;
  animation: gj-shimmer 1.2s linear infinite;
}
.gj-hover-card[data-loading="true"] .gj-name { height: 1.1em; width: 12ch; }
.gj-hover-card[data-loading="true"] .gj-small { height: .95em; width: 20ch; margin-top:.28rem; }
.gj-hover-card[data-loading="true"] .gj-bio { height: 2.6em; width: 100%; }
.gj-hover-card[data-loading="true"] .gj-meta .gj-tiny { height: .9em; width: 16ch; }

@keyframes gj-shimmer {
  0%   { background-position: -40% 0; }
  100% { background-position: 160% 0; }
}

/* Fade */
.gj-fade-enter-active, .gj-fade-leave-active { transition: opacity .12s ease; }
.gj-fade-enter-from, .gj-fade-leave-to { opacity: 0; }

/* Responsive tweaks */
@media (max-width: 520px) {
  .gj-hover-card { width: 86vw; }
  .gj-hover-card::after { display: none; } /* arrow off on tight screens */
  .gj-name { font-size: 1.02rem; }
}
</style>

