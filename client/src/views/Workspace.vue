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
            <option v-for="g in gematrias" :key="g._id" :value="g._id">
              {{ g.name }}
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
        <span class="muted small" v-if="entriesLoading">Loading…</span>
      </div>

      <div v-if="entriesError" class="error">{{ entriesError }}</div>
      <div v-else>
        <div v-if="entries.length === 0" class="muted">No entries yet.</div>
        <div class="list">
          <div class="item" v-for="e in entries" :key="e._id">
            <div class="row">
              <strong>{{ e.gematria?.name || '—' }}</strong>
              <span class="tag" :class="e.visibility">{{ e.visibility }}</span>
            </div>

            <div v-if="e.visibility === 'public'">
              <div class="phrase">"{{ e.phrase }}"</div>
              <div class="result">= {{ e.result }}</div>
            </div>
            <div v-else>
              <div v-if="e.decrypted">
                <div class="phrase">"{{ e.decrypted.phrase }}"</div>
                <div class="result">= {{ e.decrypted.result }}</div>
              </div>
              <div v-else class="muted">Unable to decrypt.</div>
            </div>

            <!-- Publish / Private toggle -->
            <div class="actions">
              <button
                class="btn tiny"
                :disabled="togglingId === e._id"
                @click="togglePublish(e)"
                :title="e.visibility === 'public' ? 'Make Private (will encrypt)' : 'Publish (will decrypt & expose phrase/result)'"
              >
                {{ e.visibility === 'public' ? 'Make Private' : 'Publish' }}
              </button>
            </div>

            <div class="muted small">{{ new Date(e.createdAt).toLocaleString() }}</div>
          </div>
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
          <li v-for="g in gematrias" :key="g._id">
            <span class="name">{{ g.name }}</span>
            <button class="link" type="button" @click="selectGematria(g._id)">Use for entry</button>
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
import { onMounted, ref, reactive, computed } from 'vue';
import api from '../api';
import { SYSTEMS, breakdownByMap } from '../gematria';

// ---------- ENTRY FORM ----------
const phrase = ref('');
const gematriaId = ref('');
const visibility = ref('private');

const savingEntry = ref(false);
const entryError = ref('');
const entryOk = ref(false);

// live totals/breakdowns
const show = reactive({ simple: false, english: false, hebrew: false });
const toggle = (k) => (show[k] = !show[k]);

const simple  = computed(() => breakdownByMap(phrase.value, SYSTEMS.simple.map,  SYSTEMS.simple.filter));
const english = computed(() => breakdownByMap(phrase.value, SYSTEMS.english.map, SYSTEMS.english.filter));
const hebrew  = computed(() => breakdownByMap(phrase.value, SYSTEMS.hebrew.map,  SYSTEMS.hebrew.filter));

async function saveEntry() {
  entryError.value = ''; entryOk.value = false; savingEntry.value = true;
  try {
    await api.createEntry({ gematriaId: gematriaId.value, phrase: phrase.value, visibility: visibility.value });
    entryOk.value = true;
    await loadEntries(); // refresh list
    // keep phrase for exploration, or uncomment to clear:
    // phrase.value = '';
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

// publish toggle state/handler
const togglingId = ref(null);
async function togglePublish(e) {
  try {
    togglingId.value = e._id;
    const target = e.visibility === 'public' ? 'private' : 'public';
    await api.setEntryVisibility(e._id, target);  // requires client api helper + server PATCH route
    await loadEntries();
  } catch (err) {
    alert(err?.message || 'Failed to toggle visibility');
  } finally {
    togglingId.value = null;
  }
}

// ---------- GEMATRIAS ----------
const gematrias = ref([]);
const gLoading = ref(true);
const gError = ref('');

async function loadGematrias() {
  gLoading.value = true; gError.value = '';
  try {
    gematrias.value = await api.getGematrias();
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
  gematriaId.value = id;
}

// ---------- CREATE GEMATRIA ----------
const letters = Array.from({ length: 26 }, (_, i) => String.fromCharCode(97 + i));
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

    // refresh and preselect the new gematria
    await loadGematrias();
    if (created && created._id) {
      gematriaId.value = created._id;
    } else {
      const match = gematrias.value.find(g => g.name === gemName.value);
      if (match) gematriaId.value = match._id;
    }

    // reset form
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
}
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
.list .item {
  border:1px solid #232323; background:#0e0e0e;
  border-radius:.7rem; padding:.8rem;
}
.row { display:flex; align-items:center; justify-content:space-between; gap:.75rem; }

.tag {
  padding:.12rem .55rem; border-radius:.5rem; font-size:.82rem; font-weight:700;
  letter-spacing:.2px; border:1px dashed rgba(255,255,255,.28);
}
.tag.public  { background: rgba(16, 116, 53, .18); color: #63f09d; }
.tag.private { background: rgba(36, 76, 170, .18); color: #9db4ff; }

.phrase { font-size:1.06rem; font-weight:600; }
.result { font-weight:800; letter-spacing:.3px; }

.actions { margin-top:.55rem; display:flex; gap:.55rem; }

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
}
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
  .btn, .link, .input { transition: none; }
}
</style>
