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
  void loadDashboard();
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
  <main class="dashboard-shell">
    <header class="dashboard-header">
      <div>
        <p class="eyebrow">OBSERVABILIDAD Y AUDITORÍA</p>
        <h1>Panel de Control</h1>
        <p v-if="lastUpdated" class="updated-time">Actualizado: {{ shortTime(lastUpdated.toISOString()) }}</p>
      </div>

      <div class="header-actions">
        <button class="refresh-button" type="button" :disabled="dashboardLoading" @click="loadDashboard">
          <RefreshCcw v-if="dashboardLoading" class="spin" :size="18" />
          <RefreshCcw v-else :size="18" />
          <span>{{ dashboardLoading ? 'Actualizando...' : 'Actualizar' }}</span>
        </button>
      </div>
    </header>

    <section v-if="dashboardError" class="alert danger">
      <AlertCircle :size="20" />
      <span>{{ dashboardError }}</span>
    </section>

    <!-- Health Status -->
    <section class="health-section">
      <div class="health-card">
        <div class="health-status" :class="statusHealth">
          <div class="health-dot" />
          <span>{{ statusHealth === 'healthy' ? 'Sistema Operativo' : 'Conexión Limitada' }}</span>
        </div>

        <div class="health-grid">
          <div class="health-item" :class="{ ok: health?.dependencies.database.status === 'up', down: health?.dependencies.database.status !== 'up' }">
            <span class="health-label">MongoDB</span>
            <span class="health-status-text">{{ health?.dependencies.database.status === 'up' ? 'Conectado' : 'Desconectado' }}</span>
          </div>

          <div class="health-item" :class="{ ok: health?.dependencies.rabbitAmqp.status === 'up', down: health?.dependencies.rabbitAmqp.status !== 'up' }">
            <span class="health-label">RabbitMQ AMQP</span>
            <span class="health-status-text">{{ health?.dependencies.rabbitAmqp.status === 'up' ? 'Conectado' : 'Desconectado' }}</span>
          </div>

          <div class="health-item" :class="{ ok: health?.dependencies.rabbitManagement.status === 'up', down: health?.dependencies.rabbitManagement.status !== 'up' }">
            <span class="health-label">RabbitMQ API</span>
            <span class="health-status-text">{{ health?.dependencies.rabbitManagement.status === 'up' ? 'Conectada' : 'Desconectada' }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Metrics Grid -->
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
          <span class="metric-label">Reencolados Exitosos</span>
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
          <p class="section-eyebrow">AUDITORÍA DE OPERACIONES</p>
          <h2>Historial de Reencolados</h2>
        </div>

        <div class="activity-controls">
          <div class="filter-group">
            <span class="filter-label">Filtrar:</span>
            <button v-for="status in ['all', 'success', 'failed']" :key="status" class="filter-button" :class="{ active: filterStatus === (status as any) }" type="button" @click="filterStatus = status as any">
              {{ status === 'all' ? 'Todos' : status === 'success' ? 'Exitosos' : 'Fallidos' }}
            </button>
          </div>

          <div class="sort-group">
            <span class="sort-label">Ordenar:</span>
            <button v-for="sort in ['time', 'queue', 'status']" :key="sort" class="sort-button" :class="{ active: sortBy === (sort as any) }" type="button" @click="sortBy = sort as any">
              {{ sort === 'time' ? 'Tiempo' : sort === 'queue' ? 'Cola' : 'Estado' }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="dashboardLoading && filteredRecords.length === 0" class="loading-state">
        <Loader2 class="spin" :size="24" />
        <span>Cargando auditoría...</span>
      </div>

      <div v-else-if="filteredRecords.length === 0" class="empty-state">
        <AlertCircle :size="28" />
        <span>Sin operaciones en este período</span>
      </div>

      <div v-else class="records-container">
        <div v-for="record in filteredRecords" :key="record._id" class="audit-record" :class="{ expanded: expandedRowId === record._id }">
          <button class="record-row" type="button" @click="toggleRow(record._id)">
            <div class="record-main">
              <div class="record-status" :class="getStatusColor(record.status)">
                <span>{{ getStatusLabel(record.status) }}</span>
              </div>

              <div class="record-info">
                <div class="record-title">
                  <strong>{{ record.sourceQueue }}</strong>
                  <span class="arrow-icon">{{ record.targetExchange ? '→' : '→' }}</span>
                  <span>{{ record.targetExchange || 'N/A' }}</span>
                </div>
                <div class="record-details">
                  <span>{{ record.messageCount || 1 }} mensaje(s)</span>
                  <span>•</span>
                  <span>{{ record.messageSize ? (record.messageSize / 1024).toFixed(2) : 0 }}KB</span>
                  <span>•</span>
                  <span>{{ record.duration ? record.duration + 'ms' : 'N/A' }}</span>
                </div>
              </div>
            </div>

            <div class="record-footer">
              <span class="record-time">{{ formatTime(record.createdAt) }}</span>
              <ChevronDown class="chevron" :class="{ rotated: expandedRowId === record._id }" :size="18" />
            </div>
          </button>

          <transition name="expand">
            <div v-if="expandedRowId === record._id" class="record-details-panel">
              <div class="details-grid">
                <div class="detail-item">
                  <span class="detail-label">Evento</span>
                  <strong>{{ record.eventType }}</strong>
                </div>

                <div class="detail-item">
                  <span class="detail-label">Cola Origen</span>
                  <strong>{{ record.sourceQueue }}</strong>
                </div>

                <div class="detail-item">
                  <span class="detail-label">Exchange Destino</span>
                  <strong>{{ record.targetExchange || '-' }}</strong>
                </div>

                <div class="detail-item">
                  <span class="detail-label">Routing Key</span>
                  <strong class="monospace">{{ record.targetRoutingKey || '-' }}</strong>
                </div>

                <div class="detail-item">
                  <span class="detail-label">ID Mensaje</span>
                  <strong class="monospace">{{ record.messageId || '-' }}</strong>
                </div>

                <div class="detail-item">
                  <span class="detail-label">Llegada a DLQ</span>
                  <strong>{{ record.arrivedAtDlqTime ? formatTime(record.arrivedAtDlqTime) : '-' }}</strong>
                </div>

                <div class="detail-item">
                  <span class="detail-label">Solicitados / Completados</span>
                  <strong>{{ record.messageCount || 0 }} / {{ record.successCount || 0 }}</strong>
                </div>

                <div class="detail-item">
                  <span class="detail-label">Duración</span>
                  <strong>{{ record.duration ? record.duration + 'ms' : 'N/A' }}</strong>
                </div>

                <div class="detail-item" v-if="record.messageBody">
                  <span class="detail-label">Tamaño Mensaje</span>
                  <strong>{{ record.messageSize ? (record.messageSize / 1024).toFixed(2) : 0 }}KB</strong>
                </div>

                <div class="detail-item" v-if="record.messageBody">
                  <span class="detail-label">Encoding</span>
                  <strong>{{ record.messageBodyEncoding || 'unknown' }}</strong>
                </div>

                <div v-if="record.errorMessage" class="detail-item full-width">
                  <span class="detail-label">Error</span>
                  <div class="error-message">{{ record.errorMessage }}</div>
                </div>

                <div v-if="record.messageBody" class="detail-item full-width">
                  <span class="detail-label">Contenido del Mensaje</span>
                  <pre class="message-preview">{{ JSON.stringify(record.messageBody, null, 2) }}</pre>
                </div>
              </div>
            </div>
          </transition>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
* {
  box-sizing: border-box;
}

.dashboard-shell {
  width: 100%;
  min-height: 100vh;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  overflow: auto;
}

/* Header */
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 32px;
  border-bottom: 1px solid #dce3eb;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  position: sticky;
  top: 0;
  z-index: 10;
  flex-shrink: 0;
}

.dashboard-header > div:first-child {
  flex: 1;
}

.dashboard-header .eyebrow {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: #64748b;
}

.dashboard-header h1 {
  margin: 4px 0 0 0;
  font-size: 28px;
  font-weight: 700;
  color: #0f172a;
}

.updated-time {
  margin: 6px 0 0 0;
  font-size: 12px;
  color: #64748b;
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.refresh-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: linear-gradient(135deg, #1f6feb 0%, #1e40af 100%);
  color: #ffffff;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 200ms ease;
}

.refresh-button:hover:not(:disabled) {
  box-shadow: 0 4px 12px rgba(31, 111, 235, 0.3);
  transform: translateY(-2px);
}

.refresh-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Alert */
.alert {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 32px;
  margin: 0;
  background: #fef2f2;
  border-bottom: 1px solid #fecaca;
  color: #991b1b;
  font-size: 13px;
  flex-shrink: 0;
}

.alert.danger {
  background: #fef2f2;
  border-bottom-color: #fecaca;
  color: #991b1b;
}

.alert > svg {
  flex-shrink: 0;
  margin-top: 2px;
}

.alert span {
  flex: 1;
  font-weight: 500;
}

/* Health Section */
.health-section {
  padding: 20px 32px;
  background: #f8fafc;
  border-bottom: 1px solid #dce3eb;
}

.health-card {
  background: #ffffff;
  border: 1px solid #dce3eb;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.health-status {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  font-size: 13px;
}

.health-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

.health-status.healthy .health-dot {
  background: #10b981;
  box-shadow: 0 0 12px rgba(16, 185, 129, 0.5);
}

.health-status.unhealthy .health-dot {
  background: #ef4444;
  box-shadow: 0 0 12px rgba(239, 68, 68, 0.5);
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.health-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.health-item {
  padding: 12px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.health-item.ok {
  background: #f0fdf4;
  border-color: #bbf7d0;
}

.health-item.down {
  background: #fef2f2;
  border-color: #fecaca;
}

.health-label {
  font-size: 12px;
  font-weight: 700;
  color: #334155;
}

.health-status-text {
  font-size: 13px;
  font-weight: 600;
}

.health-item.ok .health-status-text {
  color: #059669;
}

.health-item.down .health-status-text {
  color: #dc2626;
}

/* Metrics Section */
.metrics-section {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  padding: 24px 32px;
  background: #ffffff;
  border-bottom: 1px solid #dce3eb;
}

.metric-card {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border: 1px solid #dce3eb;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: all 200ms ease;
}

.metric-card:hover {
  border-color: #0969da;
  box-shadow: 0 4px 12px rgba(9, 105, 218, 0.1);
  transform: translateY(-2px);
}

.metric-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.metric-icon {
  flex-shrink: 0;
}

.metric-icon.primary {
  color: #0969da;
}

.metric-icon.success {
  color: #10b981;
}

.metric-icon.info {
  color: #06b6d4;
}

.metric-icon.warning {
  color: #f59e0b;
}

.metric-label {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}

.metric-value {
  font-size: 32px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1;
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.metric-unit {
  font-size: 16px;
  font-weight: 600;
  color: #64748b;
}

.metric-period {
  font-size: 11px;
  color: #94a3b8;
}

/* Window Section */
.window-section {
  padding: 16px 32px;
  background: #f8fafc;
  border-bottom: 1px solid #dce3eb;
  display: flex;
  justify-content: center;
}

.window-selector {
  display: flex;
  align-items: center;
  gap: 12px;
}

.selector-label {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}

.window-button {
  padding: 8px 14px;
  border: 1px solid #dce3eb;
  background: #ffffff;
  color: #334155;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 200ms ease;
}

.window-button:hover {
  border-color: #0969da;
  color: #0969da;
  background: #f8fafc;
}

.window-button.active {
  background: #0969da;
  color: #ffffff;
  border-color: #0969da;
}

/* Activity Section */
.activity-section {
  padding: 32px;
  background: #ffffff;
  flex: 1;
  overflow: auto;
}

.activity-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
  margin-bottom: 24px;
}

.activity-header > div:first-child {
  flex: 1;
}

.section-eyebrow {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: #64748b;
}

.activity-header h2 {
  margin: 6px 0 0 0;
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
}

.activity-controls {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.filter-group,
.sort-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-label,
.sort-label {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  white-space: nowrap;
}

.filter-button,
.sort-button {
  padding: 6px 12px;
  border: 1px solid #dce3eb;
  background: #ffffff;
  color: #334155;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 160ms ease;
}

.filter-button:hover,
.sort-button:hover {
  border-color: #0969da;
  color: #0969da;
}

.filter-button.active,
.sort-button.active {
  background: #0969da;
  color: #ffffff;
  border-color: #0969da;
}

/* Records Container */
.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
  text-align: center;
  color: #94a3b8;
  font-size: 14px;
}

.records-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.audit-record {
  border: 1px solid #dce3eb;
  border-radius: 8px;
  background: #ffffff;
  overflow: hidden;
  transition: all 200ms ease;
}

.audit-record:hover {
  border-color: #0969da;
  box-shadow: 0 4px 12px rgba(9, 105, 218, 0.08);
}

.audit-record.expanded {
  border-color: #0969da;
  box-shadow: 0 4px 16px rgba(9, 105, 218, 0.15);
}

.record-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #ffffff;
  border: none;
  cursor: pointer;
  gap: 16px;
  width: 100%;
  transition: all 160ms ease;
}

.record-row:hover {
  background: #f8fafc;
}

.record-main {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  min-width: 0;
}

.record-status {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.record-status.success {
  background: #f0fdf4;
  color: #059669;
  border: 1px solid #dcfce7;
}

.record-status.danger {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.record-status.warning {
  background: #fef3c7;
  color: #b45309;
  border: 1px solid #fde68a;
}

.record-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.record-title {
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
  display: flex;
  align-items: center;
  gap: 6px;
  word-break: break-word;
}

.arrow-icon {
  opacity: 0.5;
  flex-shrink: 0;
}

.record-details {
  font-size: 12px;
  color: #64748b;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.record-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.record-time {
  font-size: 11px;
  color: #94a3b8;
  font-weight: 600;
  white-space: nowrap;
}

.chevron {
  transition: transform 300ms ease;
}

.chevron.rotated {
  transform: rotate(180deg);
}

/* Details Panel */
.record-details-panel {
  padding: 20px 16px;
  background: #f8fafc;
  border-top: 1px solid #dce3eb;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-item.full-width {
  grid-column: 1 / -1;
}

.detail-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: #64748b;
  letter-spacing: 0.3px;
}

.detail-item strong {
  font-size: 13px;
  color: #0f172a;
  word-break: break-all;
}

.detail-item strong.monospace {
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  background: #ffffff;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #dce3eb;
}

.error-message {
  padding: 10px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 4px;
  font-size: 12px;
  color: #991b1b;
  line-height: 1.5;
  font-family: 'Monaco', 'Courier New', monospace;
}

.message-preview {
  padding: 10px;
  background: #1e293b;
  color: #e2e8f0;
  border: 1px solid #334155;
  border-radius: 4px;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 11px;
  overflow-x: auto;
  max-height: 300px;
  margin: 0;
  line-height: 1.4;
}

.message-preview::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.message-preview::-webkit-scrollbar-track {
  background: transparent;
}

.message-preview::-webkit-scrollbar-thumb {
  background: #475569;
  border-radius: 3px;
}

.message-preview::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}

/* Transitions */
.expand-enter-active,
.expand-leave-active {
  transition: all 300ms ease;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}

/* Responsive */
@media (max-width: 1200px) {
  .metrics-section {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .dashboard-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .metrics-section {
    grid-template-columns: 1fr;
  }

  .health-grid {
    grid-template-columns: 1fr;
  }

  .activity-controls {
    justify-content: flex-start;
  }

  .details-grid {
    grid-template-columns: 1fr;
  }

  .record-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .activity-section {
    padding: 16px;
  }
}
</style>
