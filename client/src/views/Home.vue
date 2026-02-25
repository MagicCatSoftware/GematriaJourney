<template>
  <!-- ===== Live Calculator ===== -->
  <section class="card hero">
    <h1>Gematria Calculator</h1>
    <p class="muted">Type a phrase to see its Simple, English, and Hebrew values instantly.</p>

    <div class="calc">
      <div class="field">
        <input
          v-model="calcPhrase"
          class="input calc-input"
          placeholder="Type a phrase…"
          autocomplete="off"
          spellcheck="false"
        />
      </div>

      <div class="calc-grid">
        <div class="calc-card" v-for="sys in calcSystems" :key="sys.key">
          <div class="calc-head">
            <strong>{{ sys.label }}</strong>
            <span class="muted">{{ sys.hint }}</span>
          </div>
          <div class="calc-total">{{ sys.result.total }}</div>
          <button class="link" type="button" @click="sys.show = !sys.show">
            {{ sys.show ? 'Hide' : 'Show' }} breakdown
          </button>
          <ul v-if="sys.show" class="list">
            <li v-for="(it, i) in sys.result.items" :key="i">
              <code>{{ it[0] }}</code> = <b>{{ it[1] }}</b>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  <!-- ===== Phrase Search ===== -->
  <section class="card">
    <div class="panel-head">
      <h2>Search by Phrase</h2>
      <span class="badge" v-if="phraseSearch.total > 0">{{ phraseSearch.total }} result{{ phraseSearch.total !== 1 ? 's' : '' }}</span>
    </div>
    <p class="muted small">Find entries whose phrase contains your search terms.</p>

    <div class="search-bar">
      <input
        v-model="phraseSearch.q"
        class="input grow"
        placeholder="Search phrases… (e.g. truth, light, love)"
        autocomplete="off"
        spellcheck="false"
        @input="debounce('phrase')"
        @keyup.enter="runPanel('phrase', 1)"
      />
      <button class="btn ghost small" v-if="phraseSearch.q" @click="clearPanel('phrase')">Clear</button>
      <button class="btn primary small" @click="runPanel('phrase', 1)">Search</button>
    </div>

    <div v-if="phraseSearch.loading" class="loading-row">
      <span class="spinner"></span> Searching…
    </div>
    <div v-else-if="phraseSearch.error" class="error">{{ phraseSearch.error }}</div>
    <div v-else-if="phraseSearch.q && phraseSearch.rows.length === 0 && phraseSearch.searched" class="muted small mt">
      No entries found for "{{ phraseSearch.q }}".
    </div>

    <div v-else-if="phraseSearch.rows.length > 0">
      <div class="entry-grid">
        <div
          class="entry-card"
          v-for="r in phraseSearch.rows"
          :key="r._id"
        >
          <div class="entry-phrase">
            <span v-html="highlight(safePhrase(r), phraseSearch.q)"></span>
          </div>
          <div class="entry-meta">
            <span class="tag">{{ r.gematria?.name || 'Built-in' }}</span>
            <span class="tag num">{{ entryResult(r) }}</span>
            <span class="tag sys">S:{{ calcSimple(safePhrase(r)) }}</span>
            <span class="tag sys">E:{{ calcEnglish(safePhrase(r)) }}</span>
            <span class="tag sys">H:{{ calcHebrew(safePhrase(r)) }}</span>
          </div>
          <div class="entry-owner">
            <ProfileHoverCard v-if="r?.owner?._id" :user-id="r.owner._id">
              {{ ownerName(r) }}
            </ProfileHoverCard>
            <span v-else>{{ ownerName(r) }}</span>
            <span class="muted small">· {{ formatDate(r.createdAt) }}</span>
          </div>
        </div>
      </div>

      <div class="pagination" v-if="phraseSearch.pages > 1">
        <button class="btn small ghost" :disabled="phraseSearch.page <= 1" @click="runPanel('phrase', phraseSearch.page - 1)">Prev</button>
        <span class="muted">Page {{ phraseSearch.page }} of {{ phraseSearch.pages }}</span>
        <button class="btn small ghost" :disabled="phraseSearch.page >= phraseSearch.pages" @click="runPanel('phrase', phraseSearch.page + 1)">Next</button>
      </div>
    </div>
  </section>

  <!-- ===== Value Search ===== -->
  <section class="card">
    <div class="panel-head">
      <h2>Search by Value</h2>
      <span class="badge" v-if="valueSearch.total > 0">{{ valueSearch.total }} result{{ valueSearch.total !== 1 ? 's' : '' }}</span>
    </div>
    <p class="muted small">Find all entries whose value matches a number in any selected system.</p>

    <div class="search-bar">
      <input
        type="number"
        v-model.number="valueSearch.value"
        class="input"
        style="width:160px"
        placeholder="e.g. 198"
        min="0"
        @input="debounce('value')"
        @keyup.enter="runPanel('value', 1)"
      />
      <div class="chips">
        <label class="chip" v-for="s in valueSystems" :key="s.key">
          <input type="checkbox" v-model="s.active" @change="debounce('value')" />
          {{ s.label }}
        </label>
      </div>
      <button class="btn ghost small" v-if="valueSearch.value" @click="clearPanel('value')">Clear</button>
    </div>

    <div v-if="valueSearch.loading" class="loading-row">
      <span class="spinner"></span> Searching…
    </div>
    <div v-else-if="valueSearch.error" class="error">{{ valueSearch.error }}</div>
    <div v-else-if="valueSearch.value != null && valueSearch.rows.length === 0 && valueSearch.searched" class="muted small mt">
      No entries found with value {{ valueSearch.value }}.
    </div>

    <div v-else-if="valueSearch.rows.length > 0">
      <div class="table-wrap">
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
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in valueSearch.rows" :key="r._id">
              <td class="phrase">"{{ safePhrase(r) }}"</td>
              <td class="num">{{ entryResult(r) }}</td>
              <td class="num">{{ calcSimple(safePhrase(r)) }}</td>
              <td class="num">{{ calcEnglish(safePhrase(r)) }}</td>
              <td class="num">{{ calcHebrew(safePhrase(r)) }}</td>
              <td>{{ r.gematria?.name || '—' }}</td>
              <td>
                <ProfileHoverCard v-if="r?.owner?._id" :user-id="r.owner._id">
                  {{ ownerName(r) }}
                </ProfileHoverCard>
                <span v-else>{{ ownerName(r) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pagination" v-if="valueSearch.pages > 1">
        <button class="btn small ghost" :disabled="valueSearch.page <= 1" @click="runPanel('value', valueSearch.page - 1)">Prev</button>
        <span class="muted">Page {{ valueSearch.page }} of {{ valueSearch.pages }}</span>
        <button class="btn small ghost" :disabled="valueSearch.page >= valueSearch.pages" @click="runPanel('value', valueSearch.page + 1)">Next</button>
      </div>
    </div>
  </section>

  <!-- ===== Recent Entries ===== -->
  <section class="card">
    <div class="panel-head">
      <h2>Recent Entries</h2>
      <div class="head-controls">
        <select class="input inline small" v-model.number="recent.limit" @change="runPanel('recent', 1)">
          <option :value="10">10</option>
          <option :value="25">25</option>
          <option :value="50">50</option>
        </select>
      </div>
    </div>
    <p class="muted small">The latest publicly shared entries from all users.</p>

    <div v-if="recent.loading" class="loading-row">
      <span class="spinner"></span> Loading…
    </div>
    <div v-else-if="recent.error" class="error">{{ recent.error }}</div>
    <div v-else-if="recent.rows.length === 0" class="muted small mt">No public entries yet.</div>

    <div v-else>
      <div class="table-wrap">
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
            <tr v-for="r in recent.rows" :key="r._id">
              <td class="phrase">"{{ safePhrase(r) }}"</td>
              <td class="num">{{ entryResult(r) }}</td>
              <td class="num">{{ calcSimple(safePhrase(r)) }}</td>
              <td class="num">{{ calcEnglish(safePhrase(r)) }}</td>
              <td class="num">{{ calcHebrew(safePhrase(r)) }}</td>
              <td>{{ r.gematria?.name || '—' }}</td>
              <td>
                <ProfileHoverCard v-if="r?.owner?._id" :user-id="r.owner._id">
                  {{ ownerName(r) }}
                </ProfileHoverCard>
                <span v-else>{{ ownerName(r) }}</span>
              </td>
              <td class="muted small">{{ formatDate(r.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pagination" v-if="recent.pages > 1">
        <button class="btn small ghost" :disabled="recent.page <= 1" @click="runPanel('recent', recent.page - 1)">Prev</button>
        <span class="muted">Page {{ recent.page }} of {{ recent.pages }}</span>
        <button class="btn small ghost" :disabled="recent.page >= recent.pages" @click="runPanel('recent', recent.page + 1)">Next</button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import api from '../api';
import { SYSTEMS, breakdownByMap, sumByMap } from '../Gematria';
import ProfileHoverCard from '../components/ProfileHoverCard.vue';

/* ===== Calculator ===== */
const calcPhrase = ref('');

const calcSystems = reactive([
  { key: 'simple',  label: 'Simple',  hint: '(A=1…Z=26)',   show: false,
    get result() { return breakdownByMap(calcPhrase.value, SYSTEMS.simple.map,  SYSTEMS.simple.filter); } },
  { key: 'english', label: 'English', hint: '(A=6…Z=156)',  show: false,
    get result() { return breakdownByMap(calcPhrase.value, SYSTEMS.english.map, SYSTEMS.english.filter); } },
  { key: 'hebrew',  label: 'Hebrew',  hint: '(A=1…Z=900)',  show: false,
    get result() { return breakdownByMap(calcPhrase.value, SYSTEMS.hebrew.map,  SYSTEMS.hebrew.filter); } },
]);

/* ===== Shared helpers ===== */
function safePhrase(r) {
  if (!r) return '';
  if (typeof r.phrase === 'string' && r.phrase.trim()) return r.phrase;
  if (r.decrypted?.phrase?.trim()) return r.decrypted.phrase;
  return '';
}
function entryResult(r) {
  if (!r) return '';
  if (typeof r.result === 'number') return r.result;
  if (typeof r.decrypted?.result === 'number') return r.decrypted.result;
  return '';
}
function ownerName(r) {
  const o = r?.owner;
  return (o && (o.name || o.email)) || 'Anon';
}
function formatDate(dt) {
  try { return new Date(dt).toLocaleDateString(); } catch { return '—'; }
}
const calcSimple  = (p) => sumByMap(p || '', SYSTEMS.simple.map,  SYSTEMS.simple.filter);
const calcEnglish = (p) => sumByMap(p || '', SYSTEMS.english.map, SYSTEMS.english.filter);
const calcHebrew  = (p) => sumByMap(p || '', SYSTEMS.hebrew.map,  SYSTEMS.hebrew.filter);

/* Highlight matching text in phrase results */
function highlight(text, query) {
  if (!query || !text) return escHtml(text);
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escHtml(text).replace(
    new RegExp(`(${escaped})`, 'gi'),
    '<mark>$1</mark>'
  );
}
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ===== Panel state factory ===== */
function makePanel(extra = {}) {
  return reactive({
    rows: [],
    total: 0,
    page: 1,
    limit: 25,
    loading: false,
    error: '',
    searched: false,
    get pages() { return this.total > 0 ? Math.ceil(this.total / this.limit) : 0; },
    ...extra,
  });
}

/* ===== Phrase search panel ===== */
const phraseSearch = makePanel({ q: '', limit: 12 });

/* ===== Value search panel ===== */
const valueSearch = makePanel({ value: null, limit: 25 });
const valueSystems = reactive([
  { key: 'simple',  label: 'Simple',  active: true },
  { key: 'english', label: 'English', active: true },
  { key: 'hebrew',  label: 'Hebrew',  active: true },
]);

/* ===== Recent entries panel ===== */
const recent = makePanel({ limit: 25 });

/* ===== API runner ===== */
async function runPanel(name, page = 1) {
  const panel = name === 'phrase' ? phraseSearch
              : name === 'value'  ? valueSearch
              : recent;

  if (name === 'phrase' && !phraseSearch.q.trim()) {
    phraseSearch.rows = [];
    phraseSearch.total = 0;
    phraseSearch.searched = false;
    return;
  }
  if (name === 'value' && (valueSearch.value == null || isNaN(valueSearch.value))) {
    valueSearch.rows = [];
    valueSearch.total = 0;
    valueSearch.searched = false;
    return;
  }

  panel.loading = true;
  panel.error = '';
  panel.page = page;

  try {
    const params = { page, limit: panel.limit };

    if (name === 'phrase') {
      params.q = phraseSearch.q.trim();
      params.sort = 'createdAt';
      params.dir = 'desc';
    } else if (name === 'value') {
      params.value = valueSearch.value;
      params.systems = valueSystems.filter(s => s.active).map(s => s.key);
    } else {
      params.sort = 'createdAt';
      params.dir = 'desc';
    }

    const res = await api.searchPublic(params);

    if (Array.isArray(res)) {
      panel.rows  = res.filter(Boolean);
      panel.total = res.length;
    } else if (res && Array.isArray(res.items)) {
      panel.rows  = res.items.filter(Boolean);
      panel.total = Number(res.total || 0);
    } else {
      panel.rows  = [];
      panel.total = 0;
    }
    panel.searched = true;
  } catch (e) {
    panel.error = e?.message || 'Search failed';
    panel.rows  = [];
    panel.total = 0;
  } finally {
    panel.loading = false;
  }
}

/* ===== Debounce per panel ===== */
const timers = {};
function debounce(name, ms = 320) {
  clearTimeout(timers[name]);
  timers[name] = setTimeout(() => runPanel(name, 1), ms);
}

function clearPanel(name) {
  if (name === 'phrase') { phraseSearch.q = ''; phraseSearch.rows = []; phraseSearch.total = 0; phraseSearch.searched = false; }
  if (name === 'value')  { valueSearch.value = null; valueSearch.rows = []; valueSearch.total = 0; valueSearch.searched = false; }
}

onMounted(() => {
  runPanel('recent', 1);
});
</script>

<style scoped>
/* ===== LAYOUT ===== */
.card {
  position: relative;
  background: #0b0b0b;
  border: 1px solid #1f1f1f;
  border-radius: 14px;
  padding: 1.25rem;
  color: var(--fg);
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.02) inset,
    0 6px 20px rgba(0,0,0,0.35);
  margin-bottom: 1.1rem;
}
.card::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: .045;
  background:
    radial-gradient(1px 1px at 20% 35%, #fff 20%, transparent 21%),
    radial-gradient(1px 1px at 75% 65%, #fff 18%, transparent 19%),
    radial-gradient(1px 1px at 45% 80%, #fff 14%, transparent 15%);
  mix-blend-mode: screen;
  border-radius: 14px;
}

.hero h1 {
  margin: 0 0 .35rem;
  font-family: 'Chalkduster','Patrick Hand',cursive,system-ui,sans-serif;
  letter-spacing: .4px;
  text-shadow: 0 .5px 0 rgba(255,255,255,.22);
}

/* ===== CALCULATOR ===== */
.calc { margin-top: .6rem; }
.calc-input { font-size: 1.1rem; letter-spacing: .2px; }
.calc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
  margin-top: .75rem;
}
.calc-card {
  background: #0e0e0e;
  border: 1px solid #252525;
  border-radius: .8rem;
  padding: .85rem;
  box-shadow: 0 0 0 1px rgba(255,255,255,.02) inset;
}
.calc-head { display: flex; align-items: baseline; gap: .5rem; }
.calc-total { font-size: 2rem; font-weight: 900; margin: .4rem 0 .2rem; letter-spacing: .3px; }
.list { list-style: none; padding: 0; margin: .4rem 0 0; }
.list li { display: flex; gap: .4rem; align-items: center; font-size: .9rem; }
.list code { border: 1px dashed #3a3a3a; padding: .04rem .3rem; border-radius: .3rem; }
.link {
  padding: 0; background: none; border: none; color: var(--fg);
  cursor: pointer; font-weight: 600; font-size: .88rem;
  text-decoration: underline dashed 1.5px; text-underline-offset: 3px;
  opacity: .85; transition: opacity .15s, transform .15s;
}
.link:hover { opacity: 1; transform: translateY(-1px); }

/* ===== PANEL HEADER ===== */
.panel-head {
  display: flex; align-items: center; gap: .65rem; margin-bottom: .25rem;
}
.panel-head h2 { margin: 0; font-size: 1.15rem; }
.head-controls { margin-left: auto; display: flex; align-items: center; gap: .5rem; }
.badge {
  background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12);
  padding: .15rem .55rem; border-radius: 999px; font-size: .82rem; color: var(--muted);
}

/* ===== SEARCH BAR ===== */
.search-bar {
  display: flex; align-items: center; gap: .6rem; flex-wrap: wrap; margin: .65rem 0 .75rem;
}
.grow { flex: 1; min-width: 200px; }

/* ===== CHIPS ===== */
.chips { display: flex; gap: .45rem; flex-wrap: wrap; align-items: center; }
.chip {
  display: flex; align-items: center; gap: .35rem;
  background: #0f0f0f; border: 1px solid #232323; color: var(--fg);
  padding: .28rem .55rem; border-radius: .55rem; font-size: .88rem;
  cursor: pointer; user-select: none;
  transition: border-color .15s;
}
.chip:hover { border-color: #444; }

/* ===== INPUTS ===== */
.input {
  width: 100%; padding: .6rem .75rem;
  background: #101010; border: 1px solid #2a2a2a; border-radius: .6rem;
  color: var(--fg); font-size: .95rem;
  transition: border-color .15s, box-shadow .15s, background .15s;
}
.input.inline { width: auto; }
.input.small { padding: .35rem .55rem; font-size: .88rem; }
.input::placeholder { color: var(--muted); }
.input:focus {
  outline: none; border-color: #555; background: #111;
  box-shadow: 0 0 0 2px rgba(255,255,255,.06);
}

/* ===== ENTRY CARDS (phrase search) ===== */
.entry-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: .75rem;
  margin-top: .5rem;
}
.entry-card {
  background: #0e0e0e;
  border: 1px solid #222;
  border-radius: .8rem;
  padding: .85rem;
  display: flex; flex-direction: column; gap: .45rem;
  transition: border-color .15s;
}
.entry-card:hover { border-color: #383838; }
.entry-phrase {
  font-size: 1rem; font-weight: 600; line-height: 1.4;
  word-break: break-word;
}
.entry-phrase :deep(mark) {
  background: rgba(255, 220, 80, .22);
  color: #ffe566;
  border-radius: 2px;
  padding: 0 2px;
}
.entry-meta { display: flex; gap: .4rem; flex-wrap: wrap; }
.tag {
  background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1);
  padding: .18rem .5rem; border-radius: .45rem; font-size: .8rem;
}
.tag.num { color: #a8d8a8; }
.tag.sys { color: var(--muted); font-size: .75rem; }
.entry-owner { font-size: .83rem; display: flex; align-items: center; gap: .3rem; }

/* ===== TABLE ===== */
.table-wrap { overflow: visible; position: relative; margin-top: .6rem; }
.table {
  width: 100%; border-collapse: collapse; font-size: .93rem;
}
.table th, .table td {
  padding: .55rem .7rem;
  border-bottom: 1px solid #1e1e1e;
  text-align: left; white-space: nowrap;
}
.table thead th {
  color: var(--fg); background: #0f0f0f; position: sticky; top: 0; z-index: 1;
  border-bottom: 1px solid #262626; font-size: .88rem;
}
.table tbody tr:nth-child(even) { background: #0a0a0a; }
.table tbody tr:nth-child(odd)  { background: #0d0d0d; }
.table th.num, .table td.num { text-align: right; }
.table td.phrase { max-width: 380px; overflow: hidden; text-overflow: ellipsis; }

/* ===== PAGINATION ===== */
.pagination { display: flex; align-items: center; gap: .75rem; margin-top: .85rem; }

/* ===== BUTTONS ===== */
.btn {
  padding: .45rem .85rem; border-radius: .6rem;
  background: transparent; color: var(--fg);
  outline: 2px dashed rgba(255,255,255,.6); outline-offset: -4px;
  box-shadow: 0 0 0 1px rgba(255,255,255,.1) inset;
  transition: background .15s, transform .15s, opacity .15s;
  cursor: pointer; border: none; font-size: .93rem; white-space: nowrap;
}
.btn.small { padding: .32rem .6rem; font-size: .88rem; }
.btn.ghost { background: transparent; }
.btn.primary {
  background: rgba(255,255,255,.08);
  outline-color: rgba(255,255,255,.85);
}
.btn:hover { background: rgba(255,255,255,.07); transform: translateY(-1px); }
.btn:disabled { opacity: .5; cursor: not-allowed; transform: none; }

/* ===== LOADING SPINNER ===== */
.loading-row { display: flex; align-items: center; gap: .5rem; color: var(--muted); margin-top: .5rem; }
.spinner {
  display: inline-block; width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,.2); border-top-color: rgba(255,255,255,.7);
  border-radius: 50%; animation: spin .7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ===== MISC ===== */
.muted { color: var(--muted); }
.small { font-size: .88rem; }
.mt { margin-top: .5rem; }
.error { color: #ff6b8b; margin-top: .4rem; }
.field { margin-bottom: .6rem; }

@media (max-width: 640px) {
  .calc-grid { grid-template-columns: 1fr; }
  .entry-grid { grid-template-columns: 1fr; }
  .search-bar { flex-direction: column; align-items: stretch; }
}
@media (prefers-reduced-motion: reduce) {
  .btn, .link, .input, .entry-card, .spinner { transition: none; animation: none; }
}
</style>
