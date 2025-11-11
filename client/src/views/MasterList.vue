<template>
  <div class="container">
    <header class="head page-head">
      <div>
        <h1>Master List</h1>
        <p class="muted small">
          Curated Gematria entries submitted by users. Approved entries appear here publicly.
        </p>
      </div>

      <div
        class="counts"
        v-if="!loading && !error && (sortedApprovedEntries.length || sortedReviewEntries.length)"
      >
        <span v-if="!isAdmin">
          Showing <strong>{{ sortedApprovedEntries.length }}</strong> approved entries.
        </span>
        <span v-else>
          Approved:
          <strong>{{ sortedApprovedEntries.length }}</strong>
          · In review:
          <strong>{{ sortedReviewEntries.length }}</strong> of
          <strong>{{ reviewEntries.length }}</strong>
        </span>
      </div>
    </header>

    <div v-if="loading" class="muted">Loading…</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <div v-else>
      <!-- TOP: Public approved master list (everyone sees this) -->
      <section class="card table-card">
        <div class="head">
          <h2>Approved Master Entries</h2>
          <span class="muted small">
            These entries have been approved and are visible publicly.
          </span>
        </div>

        <div v-if="sortedApprovedEntries.length === 0" class="muted">
          No approved entries in the Master List yet.
        </div>

        <div v-else class="table-wrapper">
          <table class="master-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Gematria</th>
                <th>Phrase</th>
                <th class="col-number">System Result</th>
                <th class="col-number">Simple</th>
                <th class="col-number">English</th>
                <th class="col-number">Hebrew</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="e in sortedApprovedEntries" :key="e._id">
                <td class="col-date">
                  {{ formatDate(e.master?.submittedAt || e.createdAt) }}
                </td>
                <td class="col-gem">
                  <span class="gem-name">{{ e.gematria?.name || '—' }}</span>
                </td>
                <td class="col-phrase">
                  <span class="phrase-text">
                    {{ displayPhrase(e) || '—' }}
                  </span>
                </td>
                <td class="col-number">
                  <span v-if="systemResult(e) !== null" class="mono">
                    {{ systemResult(e) }}
                  </span>
                  <span v-else class="muted">—</span>
                </td>
                <td class="col-number">
                  <span v-if="displayPhrase(e)" class="mono">
                    {{ builtinTotals(displayPhrase(e)).simple }}
                  </span>
                  <span v-else class="muted">—</span>
                </td>
                <td class="col-number">
                  <span v-if="displayPhrase(e)" class="mono">
                    {{ builtinTotals(displayPhrase(e)).english }}
                  </span>
                  <span v-else class="muted">—</span>
                </td>
                <td class="col-number">
                  <span v-if="displayPhrase(e)" class="mono">
                    {{ builtinTotals(displayPhrase(e)).hebrew }}
                  </span>
                  <span v-else class="muted">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- BELOW: Admin-only review controls + queue -->
      <section v-if="isAdmin" class="card controls-card">
        <div class="head">
          <h2>Review Controls</h2>
        </div>

        <div class="controls-grid">
          <div class="field">
            <label>Status filter</label>
            <select v-model="statusFilter" class="input">
              <option value="all">All</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div class="field approve-all-field">
            <label>&nbsp;</label>
            <button
              type="button"
              class="btn approve-all-btn"
              :disabled="approvingAll || !pendingEntries.length"
              @click="approveAll"
            >
              {{
                approvingAll
                  ? 'Approving All…'
                  : `Approve All Pending (${pendingEntries.length})`
              }}
            </button>
          </div>
        </div>
      </section>

      <section v-if="isAdmin" class="card table-card">
        <div class="head">
          <h2>Review Queue</h2>
          <span class="muted small">
            Showing {{ sortedReviewEntries.length }} of {{ reviewEntries.length }} entries in the review queue.
          </span>
        </div>

        <div v-if="sortedReviewEntries.length === 0" class="muted">
          No entries in the review queue.
        </div>

        <div v-else class="table-wrapper">
          <table class="master-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Gematria</th>
                <th>Phrase</th>
                <th class="col-number">System Result</th>
                <th class="col-number">Simple</th>
                <th class="col-number">English</th>
                <th class="col-number">Hebrew</th>
                <th>Status / Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="e in sortedReviewEntries" :key="e._id">
                <td class="col-date">
                  {{ formatDate(e.master?.submittedAt || e.createdAt) }}
                </td>
                <td class="col-gem">
                  <span class="gem-name">{{ e.gematria?.name || '—' }}</span>
                </td>
                <td class="col-phrase">
                  <span class="phrase-text">
                    {{ displayPhrase(e) || '—' }}
                  </span>
                </td>
                <td class="col-number">
                  <span v-if="systemResult(e) !== null" class="mono">
                    {{ systemResult(e) }}
                  </span>
                  <span v-else class="muted">—</span>
                </td>
                <td class="col-number">
                  <span v-if="displayPhrase(e)" class="mono">
                    {{ builtinTotals(displayPhrase(e)).simple }}
                  </span>
                  <span v-else class="muted">—</span>
                </td>
                <td class="col-number">
                  <span v-if="displayPhrase(e)" class="mono">
                    {{ builtinTotals(displayPhrase(e)).english }}
                  </span>
                  <span v-else class="muted">—</span>
                </td>
                <td class="col-number">
                  <span v-if="displayPhrase(e)" class="mono">
                    {{ builtinTotals(displayPhrase(e)).hebrew }}
                  </span>
                  <span v-else class="muted">—</span>
                </td>

                <td class="col-actions">
                  <div class="status-and-actions">
                    <span
                      class="status-pill"
                      :class="'status-' + (e.master?.status || 'none')"
                    >
                      {{ e.master?.status || 'none' }}
                    </span>

                    <div class="actions">
                      <button
                        class="btn tiny approve-btn"
                        :disabled="updatingId === e._id || e.master?.status === 'approved'"
                        @click="setStatus(e, 'approved')"
                      >
                        {{
                          updatingId === e._id && targetStatus === 'approved'
                            ? 'Approving…'
                            : 'Approve'
                        }}
                      </button>

                      <button
                        class="btn tiny ghost"
                        :disabled="updatingId === e._id || e.master?.status === 'rejected'"
                        @click="setStatus(e, 'rejected')"
                      >
                        {{
                          updatingId === e._id && targetStatus === 'rejected'
                            ? 'Rejecting…'
                            : 'Reject'
                        }}
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import api, { getMe } from '../api';
import { SYSTEMS, breakdownByMap } from '../Gematria';

const approvedEntries = ref([]);
const reviewEntries = ref([]);
const loading = ref(true);
const error = ref('');

const me = ref(null);
const isAdmin = computed(() => me.value?.role === 'admin');

const statusFilter = ref('all');
const updatingId = ref(null);
const targetStatus = ref(null);
const approvingAll = ref(false);

// Load user info (if logged in)
async function loadMe() {
  try {
    me.value = await getMe({ redirectOn401: false });
  } catch {
    me.value = null;
  }
}

// Load master data:
// - Approved table uses /api/master/approved
// - Review queue (admin only) uses /api/master
async function loadMaster() {
  loading.value = true;
  error.value = '';
  approvedEntries.value = [];
  reviewEntries.value = [];

  try {
    // Approved list (public endpoint)
    const approvedData = await api.fetchApprovedMasterEntries();
    let approvedList;
    if (Array.isArray(approvedData)) {
      approvedList = approvedData;
    } else if (Array.isArray(approvedData?.items)) {
      approvedList = approvedData.items;
    } else if (Array.isArray(approvedData?.entries)) {
      approvedList = approvedData.entries;
    } else {
      approvedList = [];
    }
    approvedEntries.value = approvedList;
   

    // Review queue for admins
    if (isAdmin.value) {
      const data = await api.fetchMasterList();
      let list;
      if (Array.isArray(data)) {
        list = data;
      } else if (Array.isArray(data?.items)) {
        list = data.items;
      } else if (Array.isArray(data?.entries)) {
        list = data.entries;
      } else {
        list = [];
      }
      reviewEntries.value = list;
    }
  } catch (err) {
    console.error('loadMaster error', err);
    error.value = err?.message || 'Failed to load Master List';
  } finally {
    loading.value = false;
  }
}

// ---- Sorting Helpers ----
function dateVal(entry) {
  const raw = entry?.master?.submittedAt || entry?.createdAt;
  const d = new Date(raw);
  const t = d.getTime();
  return Number.isNaN(t) ? 0 : t;
}

// Approved table: oldest → newest
const sortedApprovedEntries = computed(() =>
  approvedEntries.value.slice().sort((a, b) => dateVal(a) - dateVal(b))
);

// Review queue sorting
const sortedReviewAllEntries = computed(() =>
  reviewEntries.value.slice().sort((a, b) => dateVal(a) - dateVal(b))
);

// Filter by status after sorting (admin only)
const filteredReviewEntries = computed(() => {
  if (!isAdmin.value) return [];
  if (statusFilter.value === 'all') return sortedReviewAllEntries.value;
  return sortedReviewAllEntries.value.filter(
    (e) => (e.master?.status || 'none') === statusFilter.value
  );
});

// Pending list (also sorted oldest→newest) for Approve All
const pendingEntries = computed(() =>
  isAdmin.value
    ? sortedReviewAllEntries.value.filter(
        (e) => (e.master?.status || 'none') === 'pending'
      )
    : []
);

// What we actually render in the review queue table
const sortedReviewEntries = filteredReviewEntries;

function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function displayPhrase(e) {
  if (!e) return '';

  // 1) Prefer decrypted phrase if present (works for private + approved)
  if (
    e.decrypted &&
    typeof e.decrypted.phrase === 'string' &&
    e.decrypted.phrase.trim().length > 0
  ) {
    return e.decrypted.phrase;
  }

  // 2) Fall back to plain phrase if present
  if (typeof e.phrase === 'string' && e.phrase.trim().length > 0) {
    return e.phrase;
  }

  return '';
}

function systemResult(e) {
  if (!e) return null;

  // 1) Prefer decrypted result if present
  if (Number.isFinite(e.decrypted?.result)) {
    return e.decrypted.result;
  }

  // 2) Fall back to plain result
  if (Number.isFinite(e.result)) {
    return e.result;
  }

  return null;
}

function builtinTotals(text) {
  const s = breakdownByMap(text, SYSTEMS.simple.map, SYSTEMS.simple.filter)
    .total;
  const en = breakdownByMap(text, SYSTEMS.english.map, SYSTEMS.english.filter)
    .total;
  const he = breakdownByMap(text, SYSTEMS.hebrew.map, SYSTEMS.hebrew.filter)
    .total;
  return { simple: s, english: en, hebrew: he };
}

// ---- Admin Actions ----
async function setStatus(e, status) {
  if (!isAdmin.value || !e?._id) return;
  if (!confirm(`Set this entry's master status to "${status}"?`)) return;
  updatingId.value = e._id;
  targetStatus.value = status;
  try {
    await api.updateMasterStatus(e._id, status);
    await loadMaster();
  } catch (err) {
    alert(err?.message || 'Failed to update master status');
  } finally {
    updatingId.value = null;
    targetStatus.value = null;
  }
}

async function approveAll() {
  if (!isAdmin.value || !pendingEntries.value.length) return;
  if (!confirm(`Approve ALL pending entries (${pendingEntries.value.length})?`))
    return;
  approvingAll.value = true;
  try {
    for (const e of pendingEntries.value) {
      await api.updateMasterStatus(e._id, 'approved');
    }
    await loadMaster();
  } catch (err) {
    console.error(err);
    alert(err?.message || 'Failed to approve all pending entries');
  } finally {
    approvingAll.value = false;
  }
}

onMounted(async () => {
  await loadMe();
  await loadMaster();
});
</script>




<style scoped>
.container {
  max-width: 100vw;
  overflow-x: hidden;
}

/* Prevent horizontal overflow and make table responsive */
.table-wrapper {
  width: 100%;
  max-width: 100vw;
  overflow-x: auto;
  border-radius: 8px;
  box-sizing: border-box;
}

.master-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed; /* fixed layout helps responsive columns */
  font-size: 0.875rem;
  background: #000;
  color: #fff;
}

/* Header row */
.master-table thead {
  background: #111;
  color: #fff;
}

/* Cells */
.master-table th,
.master-table td {
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid #333;
  text-align: left;
  vertical-align: middle;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Phrase column wraps nicely */
.col-phrase {
  width: 35%;
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
}

/* Let numeric columns stay compact */
.col-number {
  width: 10%;
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* Responsive adjustments */
@media (max-width: 900px) {
  .col-date,
  .col-gem,
  .col-number {
    font-size: 0.75rem;
  }
  .col-phrase {
    width: 100%;
    display: block;
    white-space: normal;
  }
  .master-table th,
  .master-table td {
    padding: 0.5rem;
  }
}

/* Row styles */
.master-table tbody tr:nth-child(odd) {
  background: #000;
}
.master-table tbody tr:nth-child(even) {
  background: #111;
}
.master-table tbody tr:hover {
  background: #1e1e1e;
}

/* Pill + buttons */
.status-pill {
  background: #222;
  color: #fff;
  border: 1px solid #444;
  border-radius: 999px;
  padding: 0.15rem 0.6rem;
  font-size: 0.75rem;
  text-transform: uppercase;
}

.status-approved {
  background: #064e3b;
  color: #bbf7d0;
  border-color: #22c55e;
}

.status-pending {
  background: #78350f;
  color: #fde68a;
  border-color: #f59e0b;
}

.status-rejected {
  background: #7f1d1d;
  color: #fecaca;
  border-color: #ef4444;
}

.approve-btn,
.approve-all-btn {
  background: #16a34a;
  border: 1px solid #22c55e;
  color: #fff;
  font-weight: 600;
  text-transform: uppercase;
  border-radius: 4px;
  padding: 0.35rem 0.75rem;
  cursor: pointer;
}

.approve-all-btn {
  display: inline-block;
  margin-top: 0.25rem;
}

/* Keep long phrases readable on any device */
.phrase-text {
  display: block;
  line-height: 1.4;
  color: #fff;
  white-space: normal;
  word-wrap: break-word;
  overflow-wrap: anywhere;
  max-width: 100%;
}
</style>
