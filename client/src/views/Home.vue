<template>
  <section class="card hero">
    <h1>Explore public entries & calculate live</h1>
    <p class="muted">Enter a number or phrase to browse public entries. Use the calculator to see Simple, English, and Hebrew values as you type.</p>

    <!-- Calculator -->
    <div class="calc">
      <div class="field">
        <label>Calculator phrase</label>
        <input v-model="calcPhrase" class="input" placeholder="Type a phrase…" autocomplete="off" spellcheck="false" />
      </div>

      <div class="calc-grid">
        <div class="calc-card">
          <div class="calc-head">
            <strong>Simple</strong>
            <span class="muted">(A=1…Z=26)</span>
          </div>
          <div class="calc-total">{{ simple.total }}</div>
          <button class="link" type="button" @click="toggle('simple')">
            {{ show.simple ? 'Hide' : 'Show' }} breakdown
          </button>
          <ul v-if="show.simple" class="list">
            <li v-for="(it, i) in simple.items" :key="'s'+i"><code>{{ it[0] }}</code> = <b>{{ it[1] }}</b></li>
          </ul>
        </div>

        <div class="calc-card">
          <div class="calc-head">
            <strong>English</strong>
            <span class="muted">(A=6…Z=156)</span>
          </div>
          <div class="calc-total">{{ english.total }}</div>
          <button class="link" type="button" @click="toggle('english')">
            {{ show.english ? 'Hide' : 'Show' }} breakdown
          </button>
          <ul v-if="show.english" class="list">
            <li v-for="(it, i) in english.items" :key="'e'+i"><code>{{ it[0] }}</code> = <b>{{ it[1] }}</b></li>
          </ul>
        </div>

        <div class="calc-card">
          <div class="calc-head">
            <strong>Hebrew</strong>
            <span class="muted">(A=1…Z=900)</span>
          </div>
          <div class="calc-total">{{ hebrew.total }}</div>
          <button class="link" type="button" @click="toggle('hebrew')">
            {{ show.hebrew ? 'Hide' : 'Show' }} breakdown
          </button>
          <ul v-if="show.hebrew" class="list">
            <li v-for="(it, i) in hebrew.items" :key="'h'+i"><code>{{ it[0] }}</code> = <b>{{ it[1] }}</b></li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  <!-- Search by value/phrase + paginated table -->
  <section class="card">
    <div class="head">
      <h2>Browse Public Entries</h2>
      <div class="controls">
        <div class="field-inline">
          <label>Value</label>
          <input
            type="number"
            class="input inline"
            v-model.number="value"
            @input="debouncedRun()"
            placeholder="e.g., 198"
            min="0"
          />
        </div>

        <div class="field-inline systems">
          <label>Match systems</label>
          <div class="chips">
            <label class="chip"><input type="checkbox" v-model="sys.simple" @change="goPage(1)" /> Simple</label>
            <label class="chip"><input type="checkbox" v-model="sys.english" @change="goPage(1)" /> English</label>
            <label class="chip"><input type="checkbox" v-model="sys.hebrew" @change="goPage(1)" /> Hebrew</label>
          </div>
          <div class="hint small">If a number is set, entries match when the phrase equals that number in any selected system.</div>
        </div>

        <div class="field-inline grow">
          <label>Phrase (contains)</label>
          <div class="row-inline">
            <input
              class="input inline grow"
              v-model="q"
              @input="debouncedRun()"
              @keyup.enter="goPage(1)"
              placeholder="e.g., truth"
              autocomplete="off"
              spellcheck="false"
            />
            <button class="btn small ghost" @click="clearPhrase" v-if="q">Clear</button>
          </div>
        </div>

        <div class="field-inline">
          <label>Per page</label>
          <select class="input inline" v-model.number="limit" @change="goPage(1)">
            <option :value="10">10</option>
            <option :value="25">25</option>
            <option :value="50">50</option>
          </select>
        </div>
      </div>
    </div>

    <div v-if="loading" class="muted">Loading…</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <div v-else>
      <div v-if="renderRows.length === 0" class="muted">No public entries found.</div>

      <div class="table-wrap" v-else>
        <table class="table">
          <thead>
            <tr>
              <th>Phrase</th>
              <th class="num">Value</th>
              <th class="num">Simple</th>
              <th class="num">English</th>
              <th class="num">Hebrew</th>
              <th>Gematria</th>
              <th>By</th>
              <th>Created</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="r in renderRows" :key="r._id || r.id">
              <td class="phrase">"{{ safePhrase(r) }}"</td>
              <td class="num">{{ r && typeof r.result === 'number' ? r.result : '' }}</td>
              <td class="num">{{ calcSimple(safePhrase(r)) }}</td>
              <td class="num">{{ calcEnglish(safePhrase(r)) }}</td>
              <td class="num">{{ calcHebrew(safePhrase(r)) }}</td>
              <td>{{ r && r.gematria && r.gematria.name ? r.gematria.name : '—' }}</td>

              <!-- Hover card for owner -->
              <td>
                <ProfileHoverCard v-if="r && r.owner && r.owner._id" :user-id="r.owner._id">
                  {{ ownerName(r) }}
                </ProfileHoverCard>
                <span v-else>{{ ownerName(r) }}</span>
              </td>

              <td>{{ formatDate(r && r.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pagination" v-if="pages > 1 || canPrev || canNext">
        <button class="btn small ghost" :disabled="!canPrev" @click="goPage(page-1)">Prev</button>
        <span class="muted">Page {{ page }} <span v-if="pages">of {{ pages }}</span></span>
        <button class="btn small ghost" :disabled="!canNext" @click="goPage(page+1)">Next</button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import api from '../api';
import { SYSTEMS, breakdownByMap, sumByMap } from '../Gematria';
import ProfileHoverCard from '../components/ProfileHoverCard.vue';

/* ---------- Calculator (top card) ---------- */
const calcPhrase = ref('');
const show = reactive({ simple: false, english: false, hebrew: false });
const toggle = (k) => (show[k] = !show[k]);

const simple  = computed(() => breakdownByMap(calcPhrase.value, SYSTEMS.simple.map,  SYSTEMS.simple.filter));
const english = computed(() => breakdownByMap(calcPhrase.value, SYSTEMS.english.map, SYSTEMS.english.filter));
const hebrew  = computed(() => breakdownByMap(calcPhrase.value, SYSTEMS.hebrew.map,  SYSTEMS.hebrew.filter));

/* ---------- Public search (value + phrase + systems) ---------- */
const value = ref();
const q = ref('');
const page = ref(1);
const limit = ref(10);

// which systems to match for numeric search
const sys = reactive({ simple: true, english: true, hebrew: true });

const loading = ref(false);
const error = ref('');
const rows = ref([]);
const total = ref(0);

// renderRows AFTER rows is defined
const renderRows = computed(() => (rows.value || []).filter(Boolean));

function ownerName(r) {
  const o = r && r.owner;
  return (o && (o.name || o.email)) || 'Anon';
}
function safePhrase(r) {
  return (r && typeof r.phrase === 'string') ? r.phrase : '';
}

const pages = computed(() => {
  if (total.value > 0) return Math.max(1, Math.ceil(total.value / limit.value));
  return 0;
});
const canPrev = computed(() => page.value > 1);
const canNext = computed(() => (total.value > 0 ? page.value < pages.value : rows.value.length === limit.value));

function formatDate(dt) {
  try { return new Date(dt).toLocaleString(); } catch { return '—'; }
}

/* Client-side calculators (for row columns and fallback filtering) */
const calcSimple = (phrase) => sumByMap(phrase || '', SYSTEMS.simple.map, SYSTEMS.simple.filter);
const calcEnglish = (phrase) => sumByMap(phrase || '', SYSTEMS.english.map, SYSTEMS.english.filter);
const calcHebrew  = (phrase) => sumByMap(phrase || '', SYSTEMS.hebrew.map,  SYSTEMS.hebrew.filter);

function selectedSystemIds() {
  const list = [];
  if (sys.simple) list.push('simple');
  if (sys.english) list.push('english');
  if (sys.hebrew) list.push('hebrew');
  return list;
}

function matchesSelectedSystems(phrase, target) {
  if (target == null || Number.isNaN(target)) return true; // no numeric filter
  const want = new Set(selectedSystemIds());
  if (want.has('simple') && calcSimple(phrase) === target) return true;
  if (want.has('english') && calcEnglish(phrase) === target) return true;
  if (want.has('hebrew')  && calcHebrew(phrase)  === target) return true;
  return false;
}

async function run() {
  loading.value = true;
  error.value = '';

  try {
    // build query params
    const params = { page: page.value, limit: limit.value };

    if (typeof value.value === 'number' && !Number.isNaN(value.value)) {
      params.value = value.value; // change to params.result if your API expects "result"
      const systems = selectedSystemIds();
      params.systems = systems;   // okay if server ignores
    }

    if (q.value && q.value.trim()) {
      params.q = q.value.trim();  // change to params.phrase if your API expects "phrase"
    }

    // fetch
    const res = await api.searchPublic(params);

    // normalize & sanitize
    if (Array.isArray(res)) {
      rows.value = res.filter(Boolean);
      total.value = 0;
    } else if (res && Array.isArray(res.items)) {
      rows.value = res.items.filter(Boolean);
      total.value = Number(res.total || 0);
    } else {
      rows.value = [];
      total.value = 0;
    }

    // client-side fallback filter for systems+value if backend doesn't support it
    if (typeof value.value === 'number' && !Number.isNaN(value.value)) {
      rows.value = rows.value.filter(r => r && matchesSelectedSystems(r.phrase, value.value));
    }
  } catch (e) {
    error.value = e?.message || 'Search failed';
    rows.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

function goPage(n) {
  if (n < 1) return;
  if (pages.value && n > pages.value) return;
  page.value = n;
  run();
}

// Debounce value/phrase changes
let t;
function debouncedRun() {
  page.value = 1;
  clearTimeout(t);
  t = setTimeout(run, 300);
}
function clearPhrase() {
  q.value = '';
  debouncedRun();
}

onMounted(() => {
  run();
});
</script>

<style scoped>
/* ---------- HERO & CARDS ---------- */
.hero { padding: 1.25rem; margin-bottom: 1rem; }
.card {
  position: relative;
  background: #0b0b0b;
  border: 1px solid #1f1f1f;
  border-radius: 14px;
  padding: 1rem;
  color: var(--fg);
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.02) inset,
    0 6px 20px rgba(0,0,0,0.35);
}
.card::after { /* faint chalk speckle */
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
  border-radius: 14px;
}
.hero h1 {
  margin: 0 0 .4rem;
  font-family: 'Chalkduster','Patrick Hand',cursive,system-ui,sans-serif;
  letter-spacing: .4px;
  text-shadow: 0 .5px 0 rgba(255,255,255,.25);
}

/* ---------- CALCULATOR (TOP) ---------- */
.calc { margin-top: .5rem; }
.calc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit,minmax(230px,1fr));
  gap: 1rem;
  margin-top: .5rem;
}
.calc-card {
  background: #0e0e0e;
  border: 1px solid #252525;
  border-radius: .8rem;
  padding: .85rem;
  box-shadow: 0 0 0 1px rgba(255,255,255,.02) inset;
}
.calc-head { display:flex; align-items:baseline; gap:.5rem; }
.calc-total {
  font-size: 1.9rem; font-weight: 900; margin:.45rem 0 .2rem;
  letter-spacing:.4px; text-shadow: 0 1px 0 rgba(255,255,255,.22);
}
.list { list-style: none; padding: 0; margin:.45rem 0 0; }
.list li { display:flex; gap:.45rem; align-items:center; }
.list code {
  border: 1px dashed #3a3a3a; padding: .05rem .35rem; border-radius: .35rem;
}

/* Chalky “link” control */
.link {
  margin-top:.35rem; padding:0; background:none; border:none; color:var(--fg);
  cursor:pointer; font-weight:600;
  text-decoration: underline dashed 1.5px; text-underline-offset: 3px;
  opacity:.9; transition: opacity .15s ease, transform .15s ease;
}
.link:hover { opacity:1; transform: translateY(-1px); }

/* ---------- TOP CONTROLS + FILTERS ---------- */
.head {
  display:flex; align-items:flex-end; justify-content: space-between;
  gap: 1rem; margin-bottom: .5rem;
}
.controls { display:flex; gap:.75rem; align-items:flex-end; flex-wrap: wrap; }
.field { margin-bottom: .75rem; }
.field-inline { display:flex; flex-direction: column; gap:.25rem; }
.grow { flex: 1; min-width: 240px; }
.row-inline { display:flex; gap:.5rem; align-items:center; }

.hint.small { color: var(--muted); font-size:.85rem; margin-top:.25rem; }

.systems .chips { display:flex; gap:.5rem; flex-wrap: wrap; }
.chip {
  display:flex; align-items:center; gap:.4rem;
  background:#0f0f0f; border:1px solid #232323; color: var(--fg);
  padding:.3rem .55rem; border-radius:.6rem; font-size:.92rem;
}

/* ---------- INPUTS / SELECTS ---------- */
.input {
  width: 100%; padding:.6rem .75rem;
  background:#101010; border:1px solid #2a2a2a; border-radius:.6rem;
  color: var(--fg);
  transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
}
.input.inline { width: 180px; }
.input::placeholder { color: var(--muted); }
.input:focus {
  outline:none; border-color:#555; background:#111;
  box-shadow: 0 0 0 2px rgba(255,255,255,.06);
}

/* ---------- TABLE ---------- */
/* Keep overflow visible so ProfileHoverCard can escape the container */
.table-wrap { overflow: visible; position: relative; }
.table {
  width:100%; border-collapse: collapse; font-size: .95rem;
  border-radius: .6rem; overflow: hidden;
}
.table th, .table td {
  padding: .6rem .7rem;
  border-bottom: 1px solid #1e1e1e;
  text-align: left; white-space: nowrap;
}
.table thead th {
  color: var(--fg); background: #0f0f0f; position: sticky; top: 0; z-index: 1;
  border-bottom: 1px solid #262626;
}
.table tbody tr:nth-child(even) { background: #0a0a0a; }
.table tbody tr:nth-child(odd)  { background: #0d0d0d; }
.table th.num, .table td.num { text-align: right; }
.table td.phrase { max-width: 420px; overflow: hidden; text-overflow: ellipsis; }

/* ---------- PAGINATION ---------- */
.pagination { display:flex; align-items:center; gap:.75rem; margin-top: .75rem; }

/* ---------- BUTTONS ---------- */
.btn {
  padding:.45rem .85rem; border-radius:.6rem;
  background: transparent; color: var(--fg);
  outline: 2px dashed rgba(255,255,255,.7); outline-offset: -4px;
  box-shadow: 0 0 0 1px rgba(255,255,255,.12) inset;
  transition: background .15s ease, transform .15s ease, opacity .15s ease;
}
.btn.small { padding:.35rem .6rem; font-size:.9rem; }
.btn.ghost { background: transparent; }
.btn:hover { background: rgba(255,255,255,.06); transform: translateY(-1px); }
.btn:disabled { opacity:.55; cursor:not-allowed; transform:none; }

/* ---------- STATUS COLORS ---------- */
.muted { color: var(--muted); }
.error { color: #ff6b8b; }

/* ---------- ACCESSIBILITY ---------- */
.input:focus-visible,
.btn:focus-visible,
.link:focus-visible {
  outline: 2px solid rgba(255,255,255,.95);
  outline-offset: 2px; border-radius: .5rem;
}

/* ---------- REDUCED MOTION ---------- */
@media (prefers-reduced-motion: reduce) {
  .btn, .link, .input { transition: none; }
}
</style>
