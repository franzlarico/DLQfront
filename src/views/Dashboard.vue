<script setup lang="ts">
import { AlertCircle, BarChart3, CheckCircle2, Loader2, RefreshCcw, TrendingUp, ChevronDown } from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { rabbitApi } from '../api/rabbit';
import type { ActivityItem, DashboardSummary, DashboardWindow, HealthResponse } from '../types';

const dashboardWindow = ref<DashboardWindow>('24h');
const dashboardLoading = ref(false);
const dashboardError = ref('');
const sortBy = ref<'time' | 'queue' | 'status'>('time');
const filterStatus = ref<'all' | 'success' | 'failed'>('all');
const expandedRowId = ref<string | null>(null);
const currentPage = ref(1);
const pageSize = ref(10);
const pageSizes = [10, 20, 30, 50] as const;

const health = ref<HealthResponse | null>(null);
const summary = ref<DashboardSummary | null>(null);
const auditRecords = ref<ActivityItem[]>([]);
const lastUpdated = ref<Date | null>(null);

let refreshTimer: number | undefined;

async function loadDashboard(): Promise<void> {
  if (dashboardLoading.value) return;

  dashboardLoading.value = true;
  dashboardError.value = '';

  try {
    const [healthData, summaryData, auditData] = await Promise.all([
      rabbitApi.getHealth().catch(() => null),
      rabbitApi.getDashboardSummary(dashboardWindow.value).catch(() => null),
      rabbitApi.getDashboardActivity(dashboardWindow.value, 1000).catch(() => null),
    ]);

    health.value = healthData;
    summary.value = summaryData;
    auditRecords.value = auditData ?? [];
    lastUpdated.value = new Date();

    if (!healthData && !summaryData && !auditData) {
      dashboardError.value = 'No se pudo cargar la observabilidad desde el backend.';
    }
  } catch (err) {
    dashboardError.value = err instanceof Error ? err.message : String(err);
  } finally {
    dashboardLoading.value = false;
  }
}

function startAutoRefresh(): void {
  stopAutoRefresh();
  refreshTimer = window.setInterval(() => {
    void loadDashboard();
  }, 60000);
}

function stopAutoRefresh(): void {
  if (refreshTimer) {
    window.clearInterval(refreshTimer);
    refreshTimer = undefined;
  }
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('es-BO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

function shortTime(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('es-BO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

function getStatusColor(status: string): string {
  if (status === 'SUCCESS') return 'success';
  if (status === 'FAILED') return 'danger';
  return 'warning';
}

function getStatusLabel(status: string): string {
  if (status === 'SUCCESS') return 'Exitoso';
  if (status === 'FAILED') return 'Fallido';
  return 'Parcial';
}

function toggleRow(rowId: string | undefined): void {
  if (!rowId) return;
  expandedRowId.value = expandedRowId.value === rowId ? null : rowId;
}

watch(dashboardWindow, () => {
  currentPage.value = 1;
  void loadDashboard();
});

watch([filterStatus, sortBy, pageSize], () => {
  currentPage.value = 1;
});

onMounted(async () => {
  await loadDashboard();
  startAutoRefresh();
});

onBeforeUnmount(stopAutoRefresh);

const filteredRecords = computed(() => {
  let records = [...auditRecords.value];

  if (filterStatus.value !== 'all') {
    records = records.filter((r) => {
      if (filterStatus.value === 'success') return r.status === 'SUCCESS';
      if (filterStatus.value === 'failed') return r.status === 'FAILED' || r.status === 'PARTIAL';
      return true;
    });
  }

  if (sortBy.value === 'time') {
    records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else if (sortBy.value === 'queue') {
    records.sort((a, b) => a.sourceQueue.localeCompare(b.sourceQueue));
  } else if (sortBy.value === 'status') {
    records.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'SUCCESS' ? -1 : 1;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  return records;
});

const pageCount = computed(() => Math.max(1, Math.ceil(filteredRecords.value.length / pageSize.value)));
watch(pageCount, (count) => {
  if (currentPage.value > count) {
    currentPage.value = count;
  }
});
const currentPageRecords = computed(() => {
  const startIndex = (currentPage.value - 1) * pageSize.value;
  const endIndex = startIndex + pageSize.value;
  return filteredRecords.value.slice(startIndex, endIndex);
});
const displayedRange = computed(() => {
  const total = filteredRecords.value.length;
  if (total === 0) {
    return '0 registros';
  }

  const start = (currentPage.value - 1) * pageSize.value + 1;
  const end = Math.min(total, currentPage.value * pageSize.value);
  return `${start}-${end} de ${total}`;
});

const visiblePages = computed<(number | null)[]>(() => {
  const total = pageCount.value;
  const current = currentPage.value;

  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const pages: (number | null)[] = [1];
  if (current > 3) {
    pages.push(null);
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  if (current < total - 2) {
    pages.push(null);
  }

  pages.push(total);
  return pages.filter((item, index) => pages.indexOf(item) === index);
});

const statusHealth = computed(() => {
  if (!health.value) return 'unknown';
  const allUp =
    health.value.dependencies.database.status === 'up' &&
    health.value.dependencies.rabbitAmqp.status === 'up' &&
    health.value.dependencies.rabbitManagement.status === 'up';
  return allUp ? 'healthy' : 'unhealthy';
});

const windowLabel = computed(() => {
  const labels: Record<DashboardWindow, string> = {
    '24h': 'Últimas 24 horas',
    '7d': 'Últimos 7 días',
    '30d': 'Últimos 30 días',
    all: 'Todo el historial',
  };
  return labels[dashboardWindow.value];
});
</script>

<template>
  <div class="dashboard-shell">
    <!-- Header -->
    <header class="dashboard-header">
      <div>
        <p class="eyebrow">OBSERVABILIDAD Y AUDITORÍA</p>
        <h1>Panel de Control</h1>
        <p v-if="lastUpdated" class="updated-time">Actualizado: {{ shortTime(lastUpdated.toISOString()) }}</p>
      </div>

      <div class="header-actions">
        <button class="primary" type="button" :disabled="dashboardLoading" @click="loadDashboard">
          <Loader2 v-if="dashboardLoading" class="spin" :size="18" />
          <RefreshCcw v-else :size="18" />
          <span>{{ dashboardLoading ? 'Actualizando...' : 'Actualizar' }}</span>
        </button>
      </div>
    </header>

    <!-- Errors -->
    <div v-if="dashboardError" class="alert danger">
      <AlertCircle :size="20" />
      <div>
        <strong>Error de carga</strong>
        <p>{{ dashboardError }}</p>
      </div>
    </div>

    <!-- Health Status -->
    <section class="health-section">
      <div class="health-card">
        <div class="health-header">
          <div class="health-status" :class="statusHealth">
            <div class="health-dot" />
            <span>{{ statusHealth === 'healthy' ? '✓ Salud del sistema' : '⚠ Salud degradada' }}</span>
          </div>
        </div>

        <div class="health-grid">
          <div class="health-item" :class="{ ok: health?.dependencies.database.status === 'up', down: health?.dependencies.database.status !== 'up' }">
            <span class="health-label">MongoDB</span>
            <span class="health-status-text">{{ health?.dependencies.database.status === 'up' ? '✓ Conectado' : '✕ Desconectado' }}</span>
          </div>

          <div class="health-item" :class="{ ok: health?.dependencies.rabbitAmqp.status === 'up', down: health?.dependencies.rabbitAmqp.status !== 'up' }">
            <span class="health-label">RabbitMQ AMQP</span>
            <span class="health-status-text">{{ health?.dependencies.rabbitAmqp.status === 'up' ? '✓ Conectado' : '✕ Desconectado' }}</span>
          </div>

          <div class="health-item" :class="{ ok: health?.dependencies.rabbitManagement.status === 'up', down: health?.dependencies.rabbitManagement.status !== 'up' }">
            <span class="health-label">RabbitMQ API</span>
            <span class="health-status-text">{{ health?.dependencies.rabbitManagement.status === 'up' ? '✓ Conectada' : '✕ Desconectada' }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Metrics -->
    <section class="metrics-section">
      <div class="metric-card">
        <div class="metric-header">
          <TrendingUp class="metric-icon primary" :size="24" />
          <span class="metric-label">Mensajes en DLQ</span>
        </div>
        <div class="metric-value">{{ summary?.summary.totalMessages ?? 0 }}</div>
        <div class="metric-period">{{ windowLabel }}</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <CheckCircle2 class="metric-icon success" :size="24" />
          <span class="metric-label">Reencolados</span>
        </div>
        <div class="metric-value">{{ summary?.summary.totalRequeued ?? 0 }}</div>
        <div class="metric-period">{{ windowLabel }}</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <BarChart3 class="metric-icon info" :size="24" />
          <span class="metric-label">Colas Únicas</span>
        </div>
        <div class="metric-value">{{ summary?.summary.uniqueQueues ?? 0 }}</div>
        <div class="metric-period">{{ windowLabel }}</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <AlertCircle class="metric-icon warning" :size="24" />
          <span class="metric-label">Tamaño Promedio</span>
        </div>
        <div class="metric-value">
          {{ summary ? (summary.summary.averageRequeueSize / 1024).toFixed(2) : 0 }}
          <span class="metric-unit">KB</span>
        </div>
        <div class="metric-period">{{ windowLabel }}</div>
      </div>
    </section>

    <!-- Window Selector -->
    <section class="window-section">
      <div class="window-selector">
        <span class="selector-label">Período:</span>
        <button v-for="window in (['24h', '7d', '30d', 'all'] as const)" :key="window" class="window-button" :class="{ active: dashboardWindow === window }" type="button" @click="dashboardWindow = window">
          {{ window === '24h' ? '24h' : window === '7d' ? '7 días' : window === '30d' ? '30 días' : 'Todo' }}
        </button>
      </div>
    </section>

    <!-- Activity Section -->
    <section class="activity-section">
      <div class="activity-header">
        <div>
          <h2>Historial de Reencolados</h2>
          <span class="record-count">{{ displayedRange }}</span>
        </div>

        <div class="activity-controls">
          <div class="filter-group">
            <span class="filter-label">Estado:</span>
            <button v-for="status in ['all', 'success', 'failed']" :key="status" class="control-button" :class="{ active: filterStatus === (status as any) }" type="button" @click="filterStatus = status as any">
              {{ status === 'all' ? 'Todos' : status === 'success' ? 'Exitosos' : 'Fallidos' }}
            </button>
          </div>

          <div class="sort-group">
            <span class="sort-label">Ordenar:</span>
            <button v-for="sort in ['time', 'queue', 'status']" :key="sort" class="control-button" :class="{ active: sortBy === (sort as any) }" type="button" @click="sortBy = sort as any">
              {{ sort === 'time' ? 'Tiempo' : sort === 'queue' ? 'Cola' : 'Estado' }}
            </button>
          </div>

          <div class="page-size-group">
            <span class="filter-label">Mostrar:</span>
            <button v-for="size in pageSizes" :key="size" class="control-button" :class="{ active: pageSize === size }" type="button" @click="pageSize = size">
              {{ size }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="dashboardLoading && filteredRecords.length === 0" class="loading-state">
        <Loader2 class="spin" :size="24" />
        <span>Cargando auditoría...</span>
      </div>

      <div v-else-if="filteredRecords.length === 0" class="empty-state">
        <AlertCircle :size="32" />
        <span>Sin operaciones en este período</span>
      </div>

      <div v-else class="records-scroll">
        <div class="records-container">
          <div v-for="record in currentPageRecords" :key="record._id" class="audit-record" :class="{ expanded: expandedRowId === record._id }">
            <div class="record-row" role="button" tabindex="0" @click="toggleRow(record._id)">
              <div class="record-main">
                <div class="record-status" :class="getStatusColor(record.status)">
                  <span>{{ getStatusLabel(record.status) }}</span>
                </div>

                <div class="record-info">
                  <div class="record-title">
                    <strong>{{ record.sourceQueue }}</strong>
                    <span class="arrow">→</span>
                    <span>{{ record.targetExchange || 'N/A' }}</span>
                  </div>
                  <small>{{ record.messageCount || 1 }} mensajes • Reencolado: {{ formatTime(record.createdAt) }}</small>
                  <small v-if="record.arrivedAtDlqTime" class="arrival-info">Llegada DLQ: {{ formatTime(record.arrivedAtDlqTime) }}</small>
                </div>
              </div>

              <ChevronDown class="chevron" :class="{ rotated: expandedRowId === record._id }" :size="18" />
            </div>

            <div v-if="expandedRowId === record._id" class="record-details">
              <div class="details-grid">
                <div><span class="label">Origen</span><strong>{{ record.sourceQueue }}</strong></div>
                <div><span class="label">Exchange</span><strong>{{ record.targetExchange || '-' }}</strong></div>
                <div><span class="label">Routing Key</span><strong>{{ record.targetRoutingKey || '-' }}</strong></div>
                <div><span class="label">Reencolado en</span><strong>{{ formatTime(record.createdAt) }}</strong></div>
                <div v-if="record.arrivedAtDlqTime"><span class="label">Llegada a DLQ</span><strong>{{ formatTime(record.arrivedAtDlqTime) }}</strong></div>
                <div><span class="label">Duración</span><strong>{{ record.duration ? record.duration + 'ms' : 'N/A' }}</strong></div>
                <div><span class="label">Solicitados/Éxito</span><strong>{{ record.messageCount || 0 }}/{{ record.successCount || 0 }}</strong></div>
                <div><span class="label">Tamaño</span><strong>{{ record.messageSize ? (record.messageSize / 1024).toFixed(2) : 0 }}KB</strong></div>
                <div v-if="record.errorMessage" class="full-width"><span class="label">Error</span><div class="error-msg">{{ record.errorMessage }}</div></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="pagination-footer">
        <div class="pagination-info">Página {{ currentPage }} de {{ pageCount }}</div>
        <div class="pagination-actions">
          <button class="pagination-button" type="button" :disabled="currentPage === 1" @click="currentPage = currentPage - 1">Anterior</button>
          <template v-for="(item, index) in visiblePages" :key="item === null ? `dots-${index}` : `page-${item}`">
            <span v-if="item === null" class="pagination-ellipsis">…</span>
            <button
              v-else
              class="pagination-button"
              :class="{ active: currentPage === item }"
              type="button"
              @click="currentPage = item"
            >
              {{ item }}
            </button>
          </template>
          <button class="pagination-button" type="button" :disabled="currentPage === pageCount" @click="currentPage = currentPage + 1">Siguiente</button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.dashboard-shell {
  width: 100%;
  min-height: 100vh;
  background: var(--color-bg-secondary);
  display: flex;
  flex-direction: column;
  overflow: auto;
}

/* Header */
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: var(--spacing-lg) var(--spacing-2xl);
  background: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
  position: sticky;
  top: 0;
  z-index: 10;
  flex-shrink: 0;
  gap: var(--spacing-lg);
}

.dashboard-header > div:first-child p {
  margin: 0 0 var(--spacing-xs) 0;
}

.dashboard-header h1 {
  margin: 0;
}

.updated-time {
  margin-top: var(--spacing-xs);
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.header-actions {
  flex-shrink: 0;
}

/* Alert */
.alert {
  display: flex;
  gap: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-xl);
  margin: 0;
  background: var(--color-info-light);
  border-left: 4px solid var(--color-info);
  color: var(--color-info);
  align-items: center;
  border-radius: 10px;
}

.alert.danger {
  background: var(--color-danger-light);
  border-left-color: var(--color-danger);
  color: var(--color-danger);
}

.alert strong {
  display: block;
  font-weight: 600;
  margin-bottom: 2px;
}

.alert p {
  margin: 0;
}

/* Health Section */
.health-section {
  padding: var(--spacing-lg) var(--spacing-2xl);
  background: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-border);
}

.health-card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.health-header {
  display: flex;
  align-items: center;
}

.health-status {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  font-weight: 600;
  font-size: var(--font-size-lg);
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: 6px;
  width: fit-content;
}

.health-status.healthy {
  background: var(--color-success-light);
  color: var(--color-success);
}

.health-status.unhealthy {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

.health-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

.health-status.healthy .health-dot {
  background: var(--color-success);
}

.health-status.unhealthy .health-dot {
  background: var(--color-danger);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.health-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-lg);
}

.health-item {
  padding: var(--spacing-lg);
  border-radius: 6px;
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  background: var(--color-bg-secondary);
}

.health-item.ok {
  background: var(--color-success-light);
  border-color: var(--color-success);
}

.health-item.down {
  background: var(--color-danger-light);
  border-color: var(--color-danger);
}

.health-label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-primary);
}

.health-status-text {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-secondary);
}

.health-item.ok .health-status-text {
  color: var(--color-success);
}

.health-item.down .health-status-text {
  color: var(--color-danger);
}

  .metrics-section {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--spacing-lg);
    padding: var(--spacing-lg) var(--spacing-2xl);
    background: var(--color-bg-primary);
    border-bottom: 1px solid var(--color-border);
  }

  .metric-card {
    border: 1px solid var(--color-border);
    border-radius: 16px;
    padding: var(--spacing-lg);
    background: var(--color-bg-secondary);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .metric-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .metric-label {
    font-size: var(--font-size-sm);
    font-weight: 700;
    color: var(--color-text-secondary);
  }

  .metric-value {
    font-size: var(--font-size-3xl, 2rem);
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .metric-unit {
    margin-left: 0.25rem;
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
  }

  .metric-period {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }

  .window-section {
    padding: var(--spacing-lg) var(--spacing-2xl);
    background: var(--color-bg-primary);
    border-bottom: 1px solid var(--color-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--spacing-md);
  }

  .window-selector {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    flex-wrap: wrap;
  }

  .selector-label {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    font-weight: 600;
  }

  .window-button {
    border: 1px solid var(--color-border);
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    border-radius: 999px;
    padding: 10px 16px;
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .window-button.active {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }

  .activity-section {
    padding: var(--spacing-lg) var(--spacing-2xl);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .activity-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--spacing-lg);
    flex-wrap: wrap;
  }

  .activity-controls {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
    align-items: center;
  }

  .filter-group,
  .sort-group {
    display: flex;
    gap: var(--spacing-sm);
    align-items: center;
    flex-wrap: wrap;
  }

  .filter-label,
  .sort-label {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    font-weight: 600;
  }

  .control-button {
    border: 1px solid var(--color-border);
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    border-radius: 999px;
    padding: 8px 14px;
    font-size: var(--font-size-xs);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .control-button.active {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }

  .records-scroll {
    max-height: 640px;
    overflow-y: auto;
    padding-right: 4px;
  }

  .records-container {
    display: grid;
    gap: var(--spacing-md);
  }

  .pagination-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-md) 0 0;
    border-top: 1px solid var(--color-border);
    margin-top: var(--spacing-lg);
  }

  .pagination-info {
    color: var(--color-text-secondary);
    font-size: var(--font-size-xs);
  }

  .pagination-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .pagination-button {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
    border-radius: 999px;
    padding: 8px 12px;
    cursor: pointer;
    font-size: var(--font-size-xs);
    transition: all var(--transition-fast);
  }

  .pagination-button:hover:not(:disabled) {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .pagination-button.active {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: white;
  }

  .pagination-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .pagination-ellipsis {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }

  .audit-record {
    border: 1px solid var(--color-border);
    border-radius: 14px;
    overflow: hidden;
    background: var(--color-bg-secondary);
  }

  .record-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: var(--spacing-lg);
    gap: var(--spacing-lg);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: background var(--transition-fast);
    text-align: left;
  }

  .record-row:hover {
    background: var(--color-bg-primary);
  }

  .record-main {
    display: grid;
    gap: var(--spacing-xs);
    flex: 1;
  }

  .record-status {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px 12px;
    border-radius: 999px;
    font-size: var(--font-size-xs);
    font-weight: 700;
    text-transform: uppercase;
    width: fit-content;
  }

  .record-status.success { background: var(--color-success-light); color: var(--color-success); }
  .record-status.danger { background: var(--color-danger-light); color: var(--color-danger); }
  .record-status.warning { background: var(--color-warning-light); color: var(--color-warning); }

  .record-info {
    display: grid;
    gap: 4px;
  }

  .record-title {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .record-title strong {
    font-size: var(--font-size-sm);
    color: var(--color-text-primary);
  }

  .record-title .arrow {
    color: var(--color-text-tertiary);
  }

  .record-row small {
    display: block;
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
  }

  .chevron {
    transition: transform var(--transition-fast);
  }

  .chevron.rotated {
    transform: rotate(180deg);
  }

  .record-details {
    padding: var(--spacing-lg);
    border-top: 1px solid var(--color-border);
    background: var(--color-bg-primary);
  }

  .details-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--spacing-lg);
  }

  .details-grid .label {
    display: block;
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    margin-bottom: var(--spacing-xs);
  }

  .details-grid strong {
    color: var(--color-text-primary);
    font-size: var(--font-size-sm);
    word-break: break-word;
    font-weight: 600;
  }

  .full-width {
    grid-column: 1 / -1;
  }

  .error-msg {
    padding: var(--spacing-sm);
    border-radius: 8px;
    background: var(--color-danger-light);
    color: var(--color-danger);
    font-size: var(--font-size-sm);
    word-break: break-word;
  }

  @media (max-width: 1024px) {
    .metrics-section {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .details-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 768px) {
    .metrics-section,
    .health-section,
    .window-section,
    .activity-section {
      padding-left: var(--spacing-md);
      padding-right: var(--spacing-md);
    }

    .metrics-section {
      grid-template-columns: 1fr;
    }
  }
/* Metrics Section */
.metrics-section {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--spacing-lg);
  padding: var(--spacing-lg) var(--spacing-2xl);
  background: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-border);
}

.metric-card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: var(--color-bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.metric-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.metric-icon {
  opacity: 0.7;
}

.metric-icon.primary {
  color: var(--color-primary);
}

.metric-icon.success {
  color: var(--color-success);
}

.metric-icon.info {
  color: var(--color-info);
}

.metric-icon.warning {
  color: var(--color-warning);
}

.metric-label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
}

.metric-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.metric-unit {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-left: var(--spacing-sm);
}

.metric-period {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

@media (max-width: 1200px) {
  .metrics-section {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .metrics-section {
    grid-template-columns: 1fr;
  }
}

/* Window Section */
.window-section {
  padding: var(--spacing-lg) var(--spacing-2xl);
  background: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  justify-content: center;
}

.window-selector {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.selector-label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-primary);
}

.window-button {
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text-secondary);
  font-weight: 600;
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.window-button:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.window-button.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

/* Activity Section */
.activity-section {
  flex: 1;
  padding: var(--spacing-lg) var(--spacing-2xl);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  overflow: hidden;
}

.activity-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--spacing-lg);
  flex-shrink: 0;
}

.activity-header > div:first-child {
  display: flex;
  align-items: baseline;
  gap: var(--spacing-md);
}

.activity-header h2 {
  margin: 0;
}

.record-count {
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
  font-weight: 600;
}

.activity-controls {
  display: flex;
  gap: var(--spacing-xl);
  flex-wrap: wrap;
}

.filter-group,
.sort-group {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.filter-label,
.sort-label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-primary);
}

.control-button {
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.control-button:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.control-button.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

/* Records */
.records-container {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.audit-record {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  overflow: hidden;
  transition: all var(--transition-base);
}

.audit-record:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-md);
}

.record-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: var(--spacing-lg);
  background: transparent;
  border: none;
  cursor: pointer;
  gap: var(--spacing-lg);
}

.record-main {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex: 1;
  min-width: 0;
}

.record-status {
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: 4px;
  font-size: var(--font-size-xs);
  font-weight: 700;
  white-space: nowrap;
}

.record-status.success {
  background: var(--color-success-light);
  color: var(--color-success);
}

.record-status.warning {
  background: var(--color-warning-light);
  color: var(--color-warning);
}

.record-status.danger {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

.record-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  min-width: 0;
  flex: 1;
}

.record-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
}

.record-title strong {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.arrow {
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}

.record-title span:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-info small {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  margin-top: 0;
}

.arrival-info {
  color: var(--color-warning) !important;
  font-style: italic !important;
  font-weight: 500 !important;
  margin-top: var(--spacing-xs) !important;
}

.chevron {
  flex-shrink: 0;
  transition: transform var(--transition-base);
}

.chevron.rotated {
  transform: rotate(180deg);
}

/* Record Details */
.record-details {
  padding: var(--spacing-lg);
  background: var(--color-bg-secondary);
  border-top: 1px solid var(--color-border-light);
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-lg);
  font-size: var(--font-size-sm);
}

.details-grid > div {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.details-grid .label {
  font-weight: 600;
  color: var(--color-text-secondary);
}

.details-grid strong {
  color: var(--color-text-primary);
  word-break: break-word;
}

.details-grid .full-width {
  grid-column: 1 / -1;
}

.error-msg {
  padding: var(--spacing-md);
  background: var(--color-danger-light);
  color: var(--color-danger);
  border-radius: 4px;
  font-family: monospace;
  font-size: var(--font-size-xs);
  word-break: break-word;
}

@media (max-width: 1024px) {
  .details-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .activity-controls {
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .details-grid {
    grid-template-columns: 1fr;
  }

  .record-title {
    flex-direction: column;
    align-items: flex-start;
  }
}

/* States */
.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-lg);
  padding: var(--spacing-xl);
  color: var(--color-text-tertiary);
  text-align: center;
  flex: 1;
  border: 1px dashed var(--color-border);
  border-radius: 12px;
  background: var(--color-bg-secondary);
}

.loading-state svg,
.empty-state svg {
  opacity: 0.5;
}

.loading-state span,
.empty-state span {
  font-size: var(--font-size-sm);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.spin {
  animation: spin 1s linear infinite;
}
</style>
