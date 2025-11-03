<template>
  <div class="layout">
    <!-- LEFT: Create Entry + My Entries -->
    <section class="card">
      <div class="head">
        <h2>Create Entry</h2>
        <span class="muted small">Type a phrase to see live values before saving.</span>
      </div>

      <form @submit.prevent="saveEntry">
        <div class="field">
          <label>Phrase</label>
          <input
            v-model="phrase"
            class="input"
            placeholder="Type your phrase…"
            autocomplete="off"
            spellcheck="false"
            required
          />
        </div>

        <div class="field">
          <label>Gematria (used when saving)</label>
          <select v-model="gematriaId" class="input" required>
            <option disabled value="">Select a gematria</option>
            <option v-for="g in gematrias" :key="idFor(g)" :value="idFor(g)">
              {{ g?.name || '—' }}
            </option>
          </select>
          <div class="hint">The server recomputes the result using your selected gematria when you save.</div>
        </div>

        <div class="field">
          <label>Visibility</label>
          <select v-model="visibility" class="input">
            <option value="private">Private (encrypted)</option>
            <option value="public">Public</option>
          </select>
        </div>

        <!-- Live calculators -->
        <div class="grid">
          <!-- Built-in systems -->
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
              <li v-for="(it, i) in simple.items" :key="'s'+i">
                <code>{{ it[0] }}</code> = <b>{{ it[1] }}</b>
              </li>
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
              <li v-for="(it, i) in english.items" :key="'e'+i">
                <code>{{ it[0] }}</code> = <b>{{ it[1] }}</b>
              </li>
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
              <li v-for="(it, i) in hebrew.items" :key="'h'+i">
                <code>{{ it[0] }}</code> = <b>{{ it[1] }}</b>
              </li>
            </ul>
          </div>

          <!-- Custom systems (every user gematria except the 3 built-ins) -->
          <div
            class="calc-card"
            v-for="(g, i) in customGems"
            :key="'cg-' + idFor(g)"
          >
            <div class="calc-head">
              <strong>{{ g?.name || 'Custom' }}</strong>
              <span class="muted">(custom)</span>
            </div>

            <!-- total -->
            <div class="calc-total">
              {{ customCalcs[idFor(g)]?.total ?? '—' }}
            </div>

            <!-- breakdown toggle -->
            <button
              class="link"
              type="button"
              @click="toggleCustom(idFor(g))"
              :disabled="!customCalcs[idFor(g)]?.items?.length"
            >
              {{ showCustom[idFor(g)] ? 'Hide' : 'Show' }} breakdown
            </button>

            <ul v-if="showCustom[idFor(g)] && customCalcs[idFor(g)]?.items?.length" class="list">
              <li
                v-for="(it, j) in customCalcs[idFor(g)].items"
                :key="'cgrow-' + idFor(g) + '-' + j"
              >
                <code>{{ it[0] }}</code> = <b>{{ it[1] }}</b>
              </li>
            </ul>

            <div v-else-if="showCustom[idFor(g)] && !customCalcs[idFor(g)]?.items?.length" class="muted small">
              No letter map available for breakdown.
            </div>
          </div>
        </div>

        <button class="btn" :disabled="savingEntry || !gematriaId || !phrase.trim()">
          {{ savingEntry ? 'Saving…' : 'Create Entry' }}
        </button>
        <p v-if="entryError" class="error">{{ entryError }}</p>
        <p v-if="entryOk" class="ok">Entry saved!</p>
      </form>

      <hr class="sep" />

      <div class="head">
  <h2>My Entries</h2>
  <div class="actions">
    <button class="btn small" :disabled="publishingAll" @click="publishAll">
      {{ publishingAll ? 'Publishing…' : 'Publish All' }}
    </button>
  </div>
  <span class="muted small" v-if="entriesLoading">Loading…</span>
</div>

      <div v-if="entriesError" class="error">{{ entriesError }}</div>
      <div v-else>
        <div v-if="entries.length === 0" class="muted">No entries yet.</div>

        <div class="entries-grid">
          <article class="entry-card" v-for="e in entries" :key="e._id">
            <header class="entry-head">
              <div class="entry-title">
                <strong class="gem-name">{{ e.gematria?.name || '—' }}</strong>
                <span class="tag" :class="e.visibility">{{ e.visibility }}</span>
              </div>
              <time class="stamp">{{ new Date(e.createdAt).toLocaleString() }}</time>
            </header>

            <div class="entry-body">
              <div class="phrase">“{{ entryPhrase(e) || '—' }}”</div>
              <div class="saved-result" v-if="entrySavedResult(e) !== null">
                = <span class="saved-total">{{ entrySavedResult(e) }}</span>
              </div>
              <div v-else class="muted">Unable to decrypt.</div>
            </div>

            <!-- Built-in totals for the entry's phrase -->
            <div v-if="entryPhrase(e)" class="tri">
              <span class="pill"><b>Simple</b> <span class="mono">{{ entryTotals(entryPhrase(e)).simple }}</span></span>
              <span class="pill"><b>English</b> <span class="mono">{{ entryTotals(entryPhrase(e)).english }}</span></span>
              <span class="pill"><b>Hebrew</b> <span class="mono">{{ entryTotals(entryPhrase(e)).hebrew }}</span></span>
            </div>

            <footer class="entry-actions">
  <button
    class="btn tiny"
    :disabled="togglingId === e._id"
    @click="togglePublish(e)"
    :title="e.visibility === 'public' ? 'Make Private (will encrypt)' : 'Publish (will decrypt & expose phrase/result)'"
  >
    {{ e.visibility === 'public' ? 'Make Private' : 'Publish' }}
  </button>

  <button
    class="btn tiny"
    :disabled="deletingId === e._id"
    @click="onDelete(e)"
    title="Delete this entry"
  >
    {{ deletingId === e._id ? 'Deleting…' : 'Delete' }}
  </button>
</footer>
          </article>
        </div>
      </div>
    </section>

    <!-- RIGHT: Gematrias + Create Gematria -->
    <section class="card">
      <div class="head">
        <h2>Gematrias</h2>
        <button class="btn small ghost" @click="refreshGematrias" :disabled="gLoading">
          {{ gLoading ? 'Refreshing…' : 'Refresh' }}
        </button>
      </div>

      <div v-if="gError" class="error">{{ gError }}</div>
      <div v-else>
        <div v-if="gematrias.length === 0" class="muted">No gematrias yet.</div>
        <ul class="gem-list" v-else>
          <li v-for="g in gematrias" :key="idFor(g)">
            <span class="name">{{ g?.name || '—' }}</span>
            <button class="link" type="button" @click="selectGematria(idFor(g))">Use for entry</button>
          </li>
        </ul>
      </div>

      <hr class="sep" />

      <h3>Create Gematria</h3>
      <form @submit.prevent="createGem">
        <div class="field">
          <label>Name</label>
          <input v-model="gemName" class="input" placeholder="e.g., My Custom System" required />
        </div>

        <div class="letters">
          <div v-for="l in letters" :key="l" class="cell">
            <label>{{ l.toUpperCase() }}</label>
            <input type="number" class="input" v-model.number="vals[l]" required />
          </div>
        </div>

        <button class="btn" :disabled="creatingGem">{{ creatingGem ? 'Saving…' : 'Create Gematria' }}</button>
        <p v-if="gemError" class="error">{{ gemError }}</p>
        <p v-if="gemOk" class="ok">Gematria created and selected!</p>
      </form>
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref, reactive, computed, toRaw } from 'vue';
import api from '../api';
import { SYSTEMS, breakdownByMap } from '../Gematria';

// ---------- helpers ----------
function idFor(obj) {
  const id = obj?._id ?? obj?.id ?? '';
  return typeof id === 'string' ? id : String(id || '');
}

// ---------- ENTRY FORM ----------
const phrase = ref('');
const gematriaId = ref('');
const visibility = ref('private');

const savingEntry = ref(false);
const entryError = ref('');
const entryOk = ref(false);

// live totals/breakdowns for built-ins
const show = reactive({ simple: false, english: false, hebrew: false });
const toggle = (k) => (show[k] = !show[k]);

const simple  = computed(() =>
  breakdownByMap(phrase.value, SYSTEMS.simple.map,  SYSTEMS.simple.filter)
);
const english = computed(() =>
  breakdownByMap(phrase.value, SYSTEMS.english.map, SYSTEMS.english.filter)
);
const hebrew  = computed(() =>
  breakdownByMap(phrase.value, SYSTEMS.hebrew.map,  SYSTEMS.hebrew.filter)
);

// ---------- CUSTOM GEM LIVE CALC ----------
const letters = Array.from({ length: 26 }, (_, i) => String.fromCharCode(97 + i));
const gematrias = ref([]);

function isBuiltinGem(g) {
  const n = (g?.name || '').toLowerCase();
  return n === 'simple' || n === 'english' || n === 'hebrew';
}

function toAZMap(g) {
  const out = {};
  const raw = g || {};
  const arrFrom = (raw.values && Array.isArray(raw.values) && raw.values.length === 26) ? raw.values
                : (raw.lettersArray && Array.isArray(raw.lettersArray) && raw.lettersArray.length === 26) ? raw.lettersArray
                : null;

  for (let i = 0; i < 26; i++) {
    const l = String.fromCharCode(97 + i);
    const v =
      // nested objects first
      raw.letters?.[l] ?? raw.letters?.[l.toUpperCase?.()] ??
      raw.map?.[l]     ?? raw.map?.[l.toUpperCase?.()]     ??
      // top-level fields on the doc (your server spreads ...letters)
      raw[l] ?? raw[l?.toUpperCase?.()] ??
      // array forms
      (arrFrom ? arrFrom[i] : undefined) ??
      // default
      0;
    out[l] = Number.isFinite(+v) ? +v : 0;
  }
  return out;
}

// All user-created gematrias (cards always render)
const customGems = computed(() =>
  (Array.isArray(gematrias.value) ? gematrias.value : []).filter(g => g && !isBuiltinGem(g))
);

const customCalcs = computed(() => {
  const text = phrase.value || '';
  const out = {};
  for (const g of customGems.value) {
    const key = idFor(g);
    if (!key) continue;
    const map = toAZMap(g); // always returns a complete a..z map
    out[key] = breakdownByMap(text, map, SYSTEMS.simple.filter);
  }
  return out;
});

// show/hide per custom gem (keyed by normalized ID)
const showCustom = reactive({});
const toggleCustom = (id) => { showCustom[String(id || '')] = !showCustom[String(id || '')]; };

// ---------- SAVE ENTRY ----------
async function saveEntry() {
  entryError.value = ''; entryOk.value = false; savingEntry.value = true;
  try {
    await api.createEntry({ gematriaId: gematriaId.value, phrase: phrase.value, visibility: visibility.value });
    entryOk.value = true;
    await loadEntries();
  } catch (e) {
    entryError.value = e.message || 'Failed to save entry';
  } finally {
    savingEntry.value = false;
  }
}

// ---------- LISTS ----------
const entries = ref([]);
const entriesLoading = ref(true);
const entriesError = ref('');

async function loadEntries() {
  entriesLoading.value = true; entriesError.value = '';
  try {
    entries.value = await api.myEntries();
  } catch (e) {
    entriesError.value = e.message || 'Failed to load entries';
  } finally {
    entriesLoading.value = false;
  }
}

const publishingAll = ref(false);
async function publishAll() {
  if (!confirm('Publish ALL of your private entries? This will decrypt and make them public.')) return;
  publishingAll.value = true;
  try {
    const res = await api.publishAllEntries(); // see API helper below
    // Optional toast via alert:
    alert(`Published ${res?.published || 0} entries${res?.skipped ? `, skipped ${res.skipped}` : ''}.`);
    await loadEntries();
  } catch (e) {
    alert(e?.message || 'Failed to publish all entries');
  } finally {
    publishingAll.value = false;
  }
}

// ----- delete entry -----
const deletingId = ref(null);
async function onDelete(e) {
  if (!confirm('Delete this entry permanently?')) return;
  try {
    deletingId.value = e._id;
    await api.deleteEntry(e._id); // see API helper below
    // Optimistic remove or reload:
    entries.value = entries.value.filter(x => x._id !== e._id);
  } catch (err) {
    alert(err?.message || 'Failed to delete entry');
  } finally {
    deletingId.value = null;
  }
}

// Publish toggle
const togglingId = ref(null);
async function togglePublish(e) {
  try {
    togglingId.value = e._id;
    const target = e.visibility === 'public' ? 'private' : 'public';
    await api.setEntryVisibility(e._id, target);
    await loadEntries();
  } catch (err) {
    alert(err?.message || 'Failed to toggle visibility');
  } finally {
    togglingId.value = null;
  }
}

// Helpers to render per-entry built-in totals
function entryPhrase(e) {
  if (e.visibility === 'public') return e.phrase || '';
  return e?.decrypted?.phrase || '';
}
function entrySavedResult(e) {
  if (e.visibility === 'public') return Number.isFinite(e.result) ? e.result : null;
  const r = e?.decrypted?.result;
  return Number.isFinite(r) ? r : null;
}
function entryTotals(text) {
  const s  = breakdownByMap(text, SYSTEMS.simple.map,  SYSTEMS.simple.filter).total;
  const en = breakdownByMap(text, SYSTEMS.english.map, SYSTEMS.english.filter).total;
  const he = breakdownByMap(text, SYSTEMS.hebrew.map,  SYSTEMS.hebrew.filter).total;
  return { simple: s, english: en, hebrew: he };
}

// ---------- GEMATRIAS ----------
const gLoading = ref(true);
const gError = ref('');

async function loadGematrias() {
  gLoading.value = true; gError.value = '';
  try {
    gematrias.value = await api.getGematrias();
    // initialize custom toggles keyed by normalized id
    for (const g of customGems.value) {
      const key = idFor(g);
      if (key && !(key in showCustom)) showCustom[key] = false;
    }
  } catch (e) {
    gError.value = e.message || 'Failed to load gematrias';
  } finally {
    gLoading.value = false;
  }
}

async function refreshGematrias() {
  await loadGematrias();
}

function selectGematria(id) {
  gematriaId.value = String(id || '');
}

// ---------- CREATE GEMATRIA ----------
const vals = reactive(Object.fromEntries(letters.map(l => [l, 0])));
const gemName = ref('');
const creatingGem = ref(false);
const gemError = ref('');
const gemOk = ref(false);

async function createGem() {
  creatingGem.value = true; gemError.value = ''; gemOk.value = false;
  try {
    const payload = { name: gemName.value, letters: { ...vals } };
    const created = await api.createGematria(payload);
    gemOk.value = true;

    await loadGematrias();
    if (created && (created._id || created.id)) {
      gematriaId.value = idFor(created);
    } else {
      const match = gematrias.value.find(g => (g?.name || '') === gemName.value);
      if (match) gematriaId.value = idFor(match);
    }

    for (const l of letters) vals[l] = 0;
    gemName.value = '';
  } catch (e) {
    gemError.value = e.message || 'Failed to create gematria';
  } finally {
    creatingGem.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadEntries(), loadGematrias()]);
});
</script>






<style scoped>
/* --- LAYOUT --- */
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
  gap: 1rem;
}
@media (max-width: 960px) {
  .layout { grid-template-columns: 1fr; }
}

/* --- CARDS / PANELS --- */
.card {
  position: relative;
  background: #0b0b0b;               /* deep charcoal */
  border: 1px solid #1f1f1f;
  border-radius: 14px;
  padding: 1rem;
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.02) inset,
    0 6px 20px rgba(0,0,0,0.35);
  color: var(--fg);
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

.head {
  display:flex; align-items:center; justify-content:space-between;
  gap:.75rem; margin-bottom:.5rem;
}
.head h2, .head h3 {
  margin: 0;
  font-family: 'Chalkduster','Patrick Hand',cursive,system-ui,sans-serif;
  letter-spacing:.4px;
  text-shadow: 0 .5px 0 rgba(255,255,255,.25);
}

/* --- FORMS --- */
.field { margin-bottom: .95rem; }
label { display:block; margin-bottom:.35rem; color: var(--fg); opacity:.95; }

.input,
select.input {
  width:100%;
  padding:.6rem .75rem;
  background:#101010;
  border:1px solid #2a2a2a;
  border-radius:.6rem;
  color:var(--fg);
  transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
}
.input::placeholder { color: var(--muted); }
.input:focus {
  outline:none;
  border-color:#555;
  box-shadow: 0 0 0 2px rgba(255,255,255,.06);
  background:#111;
}

.hint { color: var(--muted); font-size:.85rem; margin-top:.3rem; }

/* --- LIVE CALCULATORS --- */
.grid {
  display:grid;
  grid-template-columns: repeat(auto-fit,minmax(230px,1fr));
  gap:1rem; margin:1rem 0;
}
.calc-card {
  background:#0e0e0e;
  border:1px solid #252525;
  border-radius:.8rem;
  padding:.85rem;
  box-shadow: 0 0 0 1px rgba(255,255,255,.02) inset;
  transition: transform .15s ease, box-shadow .15s ease;
}
.calc-card:hover { transform: translateY(-2px); box-shadow: 0 2px 18px rgba(0,0,0,.45); }
.calc-head { display:flex; align-items:baseline; gap:.5rem; }
.calc-total {
  font-size:1.9rem; font-weight:900; margin:.45rem 0 .2rem;
  letter-spacing:.4px;
  text-shadow: 0 1px 0 rgba(255,255,255,.22);
}
.list { list-style:none; padding-left:0; margin:.45rem 0 0; }
.list li { display:flex; gap:.45rem; align-items:center; }
.list code {
  border:1px dashed #3a3a3a;
  padding:.05rem .35rem; border-radius:.35rem; background: transparent;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
}

/* Chalky “link” button (for Show/Hide breakdown, etc.) */
.link {
  margin-top:.35rem; padding:0;
  background:none; border:none; color:var(--fg);
  cursor:pointer; font-weight:600;
  text-decoration: underline dashed 1.5px;
  text-underline-offset: 3px;
  opacity:.9; transition: opacity .15s ease, transform .15s ease;
}
.link:hover { opacity:1; transform: translateY(-1px); }

/* --- SEPARATOR --- */
.sep { margin:1rem 0; border:none; border-top:1px solid #1e1e1e; }

/* --- ENTRIES LIST --- */
.entries-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}
.entry-card {
  border:1px solid #232323; background:#0e0e0e;
  border-radius:.9rem; padding:.9rem;
  box-shadow: 0 0 0 1px rgba(255,255,255,.02) inset;
  transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease;
}
.entry-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(0,0,0,.4);
  border-color:#2b2b2b;
}
.entry-head {
  display:flex; align-items:center; justify-content:space-between; gap:.75rem; margin-bottom:.5rem;
}
.entry-title {
  display:flex; align-items:center; gap:.5rem;
}
.gem-name { font-size: 1rem; }
.tag {
  padding:.16rem .6rem; border-radius:.9rem; font-size:.78rem; font-weight:800;
  letter-spacing:.2px; border:1px dashed rgba(255,255,255,.28);
  box-shadow: 0 0 0 1px rgba(255,255,255,.02) inset;
}
.tag.public  { background: rgba(16, 116, 53, .18);  color: #63f09d; }
.tag.private { background: rgba(36, 76, 170, .18); color: #9db4ff; }
.stamp { color: var(--muted, #aaa); font-size: .75rem; }

.entry-body {
  display:flex; align-items:baseline; gap:.5rem; flex-wrap:wrap; margin-bottom:.5rem;
}
.phrase {
  font-size:1.08rem; font-weight:700; line-height:1.25;
  text-shadow: 0 .5px 0 rgba(255,255,255,.15);
}
.saved-result { font-size:1.05rem; }
.saved-total {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-weight: 700;
}

/* Built-in totals row */
.tri {
  display: flex;
  gap: .5rem;
  flex-wrap: wrap;
  margin: .4rem 0 .6rem;
}
.pill {
  display: inline-flex;
  align-items: center;
  gap: .35rem;
  border: 1px solid var(--border, #222);
  background: #0e0e0e;
  border-radius: 999px;
  padding: .18rem .6rem;
  font-size: .84rem;
  line-height: 1.3;
}
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }

.entry-actions { display:flex; justify-content:flex-end; }

/* Small screens */
@media (min-width: 900px) {
  .entries-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* --- BUTTONS --- */
.btn {
  padding:.65rem 1rem; border-radius:.7rem;
  background: transparent; color: var(--fg);
  outline: 2px dashed rgba(255,255,255,.7);
  outline-offset: -4px;
  box-shadow: 0 0 0 1px rgba(255,255,255,.12) inset;
  transition: background .15s ease, transform .15s ease, opacity .15s ease, outline-color .15s ease;
}
.btn:hover { background: rgba(255,255,255,.06); transform: translateY(-1px); }
.btn.small { padding:.4rem .7rem; font-size:.92rem; border-radius:.55rem; }
.btn.tiny  { padding:.28rem .55rem; font-size:.86rem; border-radius:.45rem; }
.btn.ghost { background: transparent; }

.btn:disabled,
[disabled].btn {
  opacity:.55; cursor:not-allowed; transform:none;
}

/* --- STATUS TEXT --- */
.muted { color: var(--muted); }
.small { font-size:.9rem; }
.error { color: #ff6b8b; }
.ok    { color: #69f0a8; }

/* --- GEM LIST --- */
.gem-list {
  list-style:none; padding:0; margin:0 0 1rem 0; display:grid; gap:.45rem;
}
.gem-list li {
  display:flex; align-items:center; justify-content:space-between; gap:.5rem;
  padding:.55rem .65rem; border-radius:.6rem;
  background:#0f0f0f; border:1px solid #232323;
  transition: transform .12s ease, box-shadow .12s ease, border-color .12s ease;
}
.gem-list li:hover { transform: translateY(-1px); border-color:#2b2b2b; box-shadow: 0 2px 12px rgba(0,0,0,.35); }
.gem-list .name { font-weight:700; }

/* --- CREATE GEMATRIA LETTER GRID --- */
.letters {
  display:grid; grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
  gap:.6rem; margin:.7rem 0 1rem 0;
}
.cell {
  background:#0f0f0f; border:1px solid #232323; border-radius:.55rem; padding:.5rem;
}
.cell label { font-size:.82rem; opacity:.9; margin-bottom:.3rem; }
.cell .input { padding:.4rem .5rem; }

/* --- ACCESSIBILITY --- */
.input:focus-visible,
.btn:focus-visible,
.link:focus-visible {
  outline: 2px solid rgba(255,255,255,.95);
  outline-offset: 2px;
  border-radius:.5rem;
}

/* --- REDUCED MOTION --- */
@media (prefers-reduced-motion: reduce) {
  .btn, .link, .input, .calc-card, .entry-card, .gem-list li { transition: none; }
}
</style>


