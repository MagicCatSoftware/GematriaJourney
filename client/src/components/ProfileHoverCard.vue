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
        role="dialog"
        aria-modal="false"
        @mouseenter="cancelClose"
        @mouseleave="scheduleClose"
      >
        <div class="gj-row">
          <img :src="mini?.photoUrl || fallback" alt="" class="gj-avatar" />
          <div>
            <div class="gj-name">{{ mini?.name || mini?.email || 'User' }}</div>
            
          </div>
        </div>

        <div v-if="mini?.bio" class="gj-bio">{{ mini.bio }}</div>
        <div class="gj-muted gj-tiny">Joined: {{ formatDate(mini?.createdAt) }}</div>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import api from '../api';

const props = defineProps({
  userId: { type: String, required: true },
  /** ms delay before opening/closing to reduce flicker */
  openDelay:  { type: Number, default: 80 },
  closeDelay: { type: Number, default: 120 },
  /** distance in px from trigger */
  offset: { type: Number, default: 8 },
  /** preferred placement: 'bottom' | 'top' */
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

function handleLeave() {
  scheduleClose();
}
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
function onMove() {
  if (open.value) positionCard();
}

/** Compute top/left and flip if needed */
function positionCard() {
  const t = triggerEl.value?.getBoundingClientRect?.();
  const c = cardEl.value?.getBoundingClientRect?.();
  if (!t || !c) return;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const scrollX = window.scrollX || 0;
  const scrollY = window.scrollY || 0;

  // Decide top/bottom
  const wantBottom = props.placement !== 'top';
  const spaceBelow = vh - t.bottom;
  const spaceAbove = t.top;

  let top;
  if (wantBottom) {
    if (spaceBelow >= c.height + props.offset || spaceBelow >= spaceAbove) {
      top = t.bottom + props.offset + scrollY; // show below
    } else {
      top = t.top - c.height - props.offset + scrollY; // flip above
    }
  } else {
    if (spaceAbove >= c.height + props.offset || spaceAbove >= spaceBelow) {
      top = t.top - c.height - props.offset + scrollY; // show above
    } else {
      top = t.bottom + props.offset + scrollY; // flip below
    }
  }

  // Center horizontally, then clamp into viewport
  let left = t.left + t.width / 2 + scrollX;
  let transform = 'translateX(-50%)';

  const minLeft = 12 + scrollX; // small inset so it doesn't hug edges
  const maxLeft = vw - 12 + scrollX;

  // If card would overflow right/left too much, pin transform and clamp
  if (left - c.width / 2 < minLeft) {
    left = Math.max(minLeft, left - (left - c.width / 2 - minLeft)); // clamp
    transform = 'translateX(0)'; // align left edge roughly
  } else if (left + c.width / 2 > maxLeft) {
    left = Math.min(maxLeft, left - (left + c.width / 2 - maxLeft));
    transform = 'translateX(-100%)'; // align right edge
  }

  pos.top = Math.round(top);
  pos.left = Math.round(left);
  pos.transform = transform;
}

onMounted(() => {
  // If user tabs into trigger and presses Esc, close
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
/* Trigger styling: inherits table/text styles; only ensures pointer & inline-block box */
.gj-hover-trigger {
  display: inline-block;
  cursor: pointer;
  color: inherit; /* keep parent color; style links outside as you like */
  outline: none;
}
.gj-hover-trigger:focus {
  outline: 2px solid #9cc6ff;
  outline-offset: 2px;
}

/* Card */
.gj-hover-card {
  position: absolute; /* (enforced via styleObj) */
  background: #fff;
  border: 1px solid #e8e8ef;
  box-shadow: 0 10px 28px rgba(0,0,0,.14);
  border-radius: 10px;
  padding: .7rem .8rem;
  width: 260px;
  pointer-events: auto;
}

.gj-row { display:flex; gap:.6rem; align-items:center; margin-bottom:.4rem; }
.gj-avatar { width:46px; height:46px; border-radius:50%; object-fit:cover; border:1px solid #eee; }
.gj-name { font-weight: 700; line-height: 1.15; }
.gj-bio { margin:.35rem 0 .25rem; }
.gj-muted { color:#6b7280; }
.gj-small { font-size:.9rem; }
.gj-tiny { font-size:.8rem; }

/* Fade */
.gj-fade-enter-active, .gj-fade-leave-active { transition: opacity .12s ease; }
.gj-fade-enter-from, .gj-fade-leave-to { opacity: 0; }
</style>

