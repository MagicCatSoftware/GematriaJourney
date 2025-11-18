<!-- client/src/views/PublicSearch.vue -->
<template>
  <div class="container">
    <header class="head page-head">
      <div>
        <h1>Public Entries</h1>
        <p class="muted small">
          Browse public Gematria entries shared by users. Use the controls to change sort order,
          page size, and navigate through pages.
        </p>
      </div>

      <div class="toolbar">
        <div class="field inline">
          <label>Entries per page</label>
          <select v-model.number="pageSize" class="select">
            <option :value="25">25</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
        </div>

        <div class="field inline">
          <label>Sort by</label>
          <select v-model="sortMode" class="select">
            <option value="createdAt_desc">Newest first</option>
            <option value="createdAt_asc">Oldest first</option>
            <option value="result_desc">Highest value</option>
            <option value="result_asc">Lowest value</option>
            <option value="phrase_asc">Phrase A → Z</option>
            <option value="phrase_desc">Phrase Z → A</option>
          </select>
        </div>
      </div>
    </header>

    <!-- Loading / error states -->
    <div v-if="loading" class="muted">Loading entries…</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <!-- Table -->
    <div v-else>
      <div v-if="!items.length" class="muted">No public entries yet.</div>

      <div v-else class="card table-card">
        <table class="table">
          <thead>
            <tr>
              <th>Phrase</th>
              <th class="mono">Value</th>
              <th class="mono">Simple</th>
              <th class="mono">English</th>
              <th class="mono">Hebrew</th>
              <th>Gematria</th>
              <th>Owner</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="ent in items" :key="ent._id">
              <td class="phrase">
                {{ ent.phrase || '—' }}
              </td>

              <!-- Stored system result (whatever gematria system was used for this entry) -->
              <td class="mono">
                <span v-if="Number.isFinite(ent.result)">{{ ent.result }}</span>
                <span v-else class="muted">—</span>
              </td>

              <!-- Simple / English / Hebrew calculated via shared Gematria helpers -->
              <td class="mono">
                <span v-if="Number.isFinite(ent.totals?.simple)">
                  {{ ent.totals.simple }}
                </span>
                <span v-else class="muted">—</span>
              </td>
              <td class="mono">
                <span v-if="Number.isFinite(ent.totals?.english)">
                  {{ ent.totals.english }}
                </span>
                <span v-else class="muted">—</span>
              </td>
              <td class="mono">
                <span v-if="Number.isFinite(ent.totals?.hebrew)">
                  {{ ent.totals.hebrew }}
                </span>
                <span v-else class="muted">—</span>
              </td>

              <td>
                {{ ent.gematria?.name || '—' }}
              </td>

              <!-- Owner with hover card -->
              <td>
                <ProfileHoverCard
                  v-if="ent.owner && ent.owner._id"
                  :user-id="ent.owner._id"
                >
                  {{ ent.owner.name || ent.owner.email || 'Anon' }}
                </ProfileHoverCard>
                <span v-else class="muted">Anonymous</span>
              </td>

              <td class="muted small">
                {{ formatDate(ent.createdAt) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="pager">
        <button
          class="btn btn--ghost"
          :disabled="page <= 1 || loading"
          @click="goPrev"
        >
          ‹ Prev
        </button>

        <span class="pager__info">
          Page <strong>{{ page }}</strong> of
          <strong>{{ totalPages }}</strong>
          <span v-if="total">
            · {{ total }} public entries
          </span>
        </span>

        <button
          class="btn btn--ghost"
          :disabled="page >= totalPages || loading"
          @click="goNext"
        >
          Next ›
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import api from '../api';
import { SYSTEMS, sumByMap } from '../Gematria';
import ProfileHoverCard from '../components/ProfileHoverCard.vue';

// state
const loading = ref(false);
const error   = ref('');
const items   = ref([]);
const total   = ref(0);

const page     = ref(1);
const pageSize = ref(50); // default 50 as requested
const sortMode = ref('createdAt_desc');

// derive sort + dir for API
const sortField = computed(() => {
  const [field] = sortMode.value.split('_');
  return field || 'createdAt';
});
const sortDir = computed(() => {
  const [, dir] = sortMode.value.split('_');
  return dir === 'asc' ? 'asc' : 'desc';
});

const totalPages = computed(() => {
  if (!total.value || !pageSize.value) return 1;
  return Math.max(1, Math.ceil(total.value / pageSize.value));
});

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  } catch {
    return String(iso);
  }
}

// --- Use the same calculators as Home.vue via SYSTEMS + sumByMap ---
function calcSimple(phrase) {
  return sumByMap(phrase || '', SYSTEMS.simple.map, SYSTEMS.simple.filter);
}
function calcEnglish(phrase) {
  return sumByMap(phrase || '', SYSTEMS.english.map, SYSTEMS.english.filter);
}
function calcHebrew(phrase) {
  return sumByMap(phrase || '', SYSTEMS.hebrew.map, SYSTEMS.hebrew.filter);
}

async function fetchPage() {
  loading.value = true;
  error.value = '';
  try {
    const res = await api.searchPublic({
      page:  page.value,
      limit: pageSize.value,
      sort:  sortField.value,
      dir:   sortDir.value,
      // backend will enforce "approved only" but you could also
      // add a flag here later if you want
    });

    const rawItems = Array.isArray(res.items) ? res.items : [];

    // Attach totals for each entry based on its phrase using the shared helpers
    items.value = rawItems.map((ent) => {
      const phrase = ent.phrase || '';
      return {
        ...ent,
        totals: {
          simple:  calcSimple(phrase),
          english: calcEnglish(phrase),
          hebrew:  calcHebrew(phrase),
        },
      };
    });

    total.value = Number.isFinite(res.total) ? res.total : rawItems.length;
  } catch (e) {
    console.error('Public list fetch error', e);
    error.value =
      e?.data?.error ||
      e?.message ||
      'Failed to load entries';
  } finally {
    loading.value = false;
  }
}

function goPrev() {
  if (page.value > 1) page.value -= 1;
}
function goNext() {
  if (page.value < totalPages.value) page.value += 1;
}

// When page changes -> refetch
watch(page, () => {
  fetchPage();
});

// When sort or page size change -> reset to page 1, then refetch
watch([sortMode, pageSize], () => {
  page.value = 1;
  fetchPage();
});

// initial load
onMounted(() => {
  fetchPage();
});
</script>

<style scoped>
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

.toolbar {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  align-items: flex-end;
}

.field.inline {
  display: flex;
  flex-direction: column;
  min-width: 150px;
}

.table-card {
  margin-top: 1rem;
  overflow-x: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95rem;
}

.table th,
.table td {
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  text-align: left;
}

.table th {
  font-weight: 600;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.8;
}

.table tr:last-child td {
  border-bottom: none;
}

.table .phrase {
  max-width: 420px;
  word-break: break-word;
}

.mono {
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      "Liberation Mono", "Courier New", monospace);
}

.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin: 1.5rem 0 2rem;
}

.pager__info {
  font-size: 0.9rem;
}

.btn.btn--ghost[disabled] {
  opacity: 0.4;
  cursor: default;
}
</style>

