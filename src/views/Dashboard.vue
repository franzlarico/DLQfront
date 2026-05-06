<script setup lang="ts">
import { ArrowLeft, BarChart3, Loader2, AlertCircle, TrendingUp, Activity, Zap } from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { rabbitApi } from '../api/rabbit';
import type {
  DashboardSummary,
  DashboardWindow,
  QueueDistributionItem,
  ExceptionSummaryItem,
  ActivityItem,
  HealthResponse,
} from '../types';

const dashboardWindow = ref<DashboardWindow>('24h');
const dashboardLoading = ref(false);
const dashboardError = ref('');

const health = ref<HealthResponse | null>(null);
const summary = ref<DashboardSummary | null>(null);
const queueDistribution = ref<QueueDistributionItem[]>([]);
const exceptionSummary = ref<ExceptionSummaryItem[]>([]);
const activityItems = ref<ActivityItem[]>([]);

let refreshTimer: number | undefined;

// defineEmits is used implicitly by $emit() in template
const _emit = defineEmits<{
  'back-to-inspector': [];
}>();
// @ts-expect-error emit is used via $emit in the template
const emit = _emit;

async function loadDashboard(): Promise<void> {
  dashboardLoading.value = true;
  dashboardError.value = '';

  try {
    const [h, s, q, e, a] = await Promise.all([
      rabbitApi.getHealth().catch(() => null),
      rabbitApi.getDashboardSummary(dashboardWindow.value).catch(() => null),
      rabbitApi.getDashboardQueues(dashboardWindow.value).catch(() => null),
      rabbitApi.getDashboardExceptions(dashboardWindow.value).catch(() => null),
      rabbitApi.getDashboardActivity(dashboardWindow.value, 12).catch(() => null),
    ]);

    health.value = h;
    summary.value = s;
    queueDistribution.value = q || [];
    exceptionSummary.value = e || [];
    activityItems.value = a || [];
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
  }, 30000);
}

function stopAutoRefresh(): void {
  if (refreshTimer) {
    window.clearInterval(refreshTimer);
    refreshTimer = undefined;
  }
}

watch(dashboardWindow, () => {
  void loadDashboard();
});

onMounted(async () => {
  await loadDashboard();
  startAutoRefresh();
});

onBeforeUnmount(stopAutoRefresh);

const maxQueueMessages = computed(() => Math.max(0, ...queueDistribution.value.map((q) => q.currentMessages)));

const statusHealth = computed(() => {
  const db = health.value?.dependencies?.database?.status === 'up';
  const amqp = health.value?.dependencies?.rabbitAmqp?.status === 'up';
  const mgmt = health.value?.dependencies?.rabbitManagement?.status === 'up';
  if (db && amqp && mgmt) return 'healthy';
  if (db || amqp || mgmt) return 'degraded';
  return 'unhealthy';
});
</script>

<template>
  <main class="dashboard-shell">
    <header class="dashboard-header">
      <div>
        <button class="back-button" type="button" @click="$emit('back-to-inspector')">
          <ArrowLeft :size="20" />
          <span>Volver</span>
        </button>
        <div class="header-title">
          <p class="eyebrow">Observabilidad</p>
          <h1>Dashboard DLQ</h1>
        </div>
      </div>

      <div class="window-controls">
        <button
          v-for="window in (['today', '24h', '7d'] as DashboardWindow[])"
          :key="window"
          class="window-button"
          :class="{ active: dashboardWindow === window }"
          type="button"
          @click="dashboardWindow = window"
        >
          {{ window === 'today' ? 'Hoy' : window === '24h' ? 'Último día' : '7 días' }}
        </button>
      </div>
    </header>

    <div v-if="dashboardError" class="alert alert-error">
      <AlertCircle :size="20" />
      <span>{{ dashboardError }}</span>
    </div>

    <div v-if="dashboardLoading" class="loading-overlay">
      <Loader2 class="spin" :size="40" />
      <span>Cargando dashboard...</span>
    </div>

    <template v-else>
      <!-- Status Cards -->
      <section class="status-cards">
        <div class="status-card" :class="statusHealth">
          <div class="card-icon">
            <Zap :size="24" />
          </div>
          <div class="card-content">
            <p class="card-label">Estado del Sistema</p>
            <h3 class="card-value">{{ statusHealth === 'healthy' ? 'Saludable' : 'Atención' }}</h3>
            <small v-if="health">
              DB: {{ health.dependencies?.database?.status || '-' }} | AMQP:
              {{ health.dependencies?.rabbitAmqp?.status || '-' }} | Mgmt:
              {{ health.dependencies?.rabbitManagement?.status || '-' }}
            </small>
          </div>
        </div>

        <div class="status-card">
          <div class="card-icon">
            <AlertCircle :size="24" />
          </div>
          <div class="card-content">
            <p class="card-label">Dead Letters</p>
            <h3 class="card-value">{{ summary?.totalDeadLetters || 0 }}</h3>
            <small v-if="summary">Recuperación: {{ (summary.recoveryRate * 100).toFixed(1) }}%</small>
          </div>
        </div>

        <div class="status-card">
          <div class="card-icon">
            <TrendingUp :size="24" />
          </div>
          <div class="card-content">
            <p class="card-label">Reencolados Hoy</p>
            <h3 class="card-value">{{ summary?.requeuedToday || 0 }}</h3>
            <small v-if="summary">Tiempo promedio: {{ summary.avgRecoveryMinutes.toFixed(1) }}min</small>
          </div>
        </div>

        <div class="status-card">
          <div class="card-icon">
            <Activity :size="24" />
          </div>
          <div class="card-content">
            <p class="card-label">Colas Activas</p>
            <h3 class="card-value">{{ summary?.activeQueues || 0 }}</h3>
            <small v-if="summary">Mayores de 24h: {{ summary.pendingOlderThan24h }}</small>
          </div>
        </div>
      </section>

      <!-- Queue Distribution -->
      <section class="charts-section">
        <div class="chart-card">
          <h2>Distribución de Colas</h2>
          <div v-if="queueDistribution.length === 0" class="chart-empty">
            <BarChart3 :size="32" />
            <span>Sin datos de colas</span>
          </div>
          <div v-else class="queue-bars">
            <div v-for="queue in queueDistribution" :key="queue.queue" class="queue-bar-item">
              <div class="queue-bar-label">
                <span class="queue-name">{{ queue.queue }}</span>
                <span class="queue-count">{{ queue.currentMessages }}</span>
              </div>
              <div class="queue-bar-bg">
                <div
                  class="queue-bar-fill"
                  :style="{
                    width: `${maxQueueMessages > 0 ? (queue.currentMessages / maxQueueMessages) * 100 : 0}%`,
                  }"
                ></div>
              </div>
              <small>{{ queue.sharePercent.toFixed(1) }}% • Pico: {{ queue.peakMessages }}</small>
            </div>
          </div>
        </div>

        <!-- Exception Summary -->
        <div class="chart-card">
          <h2>Razones de Dead Letters</h2>
          <div v-if="exceptionSummary.length === 0" class="chart-empty">
            <AlertCircle :size="32" />
            <span>Sin excepciones registradas</span>
          </div>
          <div v-else class="exception-list">
            <div v-for="exc in exceptionSummary" :key="exc.reason" class="exception-item">
              <div class="exception-info">
                <p class="exception-reason">{{ exc.reason }}</p>
                <small v-if="exc.queue">Cola: {{ exc.queue }}</small>
                <small v-if="exc.latestSeenAt">Última vez: {{ new Date(exc.latestSeenAt).toLocaleString('es-ES') }}</small>
              </div>
              <div class="exception-stats">
                <strong>{{ exc.count }}</strong>
                <span>{{ exc.percentage.toFixed(1) }}%</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Activity Feed -->
      <section class="activity-section">
        <h2>Actividad Reciente</h2>
        <div v-if="activityItems.length === 0" class="activity-empty">
          <Activity :size="32" />
          <span>Sin actividad registrada</span>
        </div>
        <div v-else class="activity-feed">
          <div v-for="item in activityItems.slice(0, 20)" :key="item.id" class="activity-item">
            <div class="activity-time">
              {{ new Date(item.createdAt).toLocaleTimeString('es-ES') }}
            </div>
            <div class="activity-content">
              <p class="activity-action">{{ item.action }}</p>
              <small>{{ item.queue }}</small>
              <span v-if="item.detail" class="activity-detail">{{ item.detail }}</span>
            </div>
            <div class="activity-status" :class="item.status">
              {{ item.status }}
            </div>
          </div>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.dashboard-shell {
  min-height: 100vh;
  padding: 24px;
  background: linear-gradient(135deg, #f0f4f8 0%, #d9e2ec 100%);
}

.dashboard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.dashboard-header > div:first-child {
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 14px;
  border: 1px solid #dce3eb;
  border-radius: 7px;
  background: #ffffff;
  color: #334155;
  font-weight: 700;
  transition: all 200ms ease;
  cursor: pointer;
}

.back-button:hover {
  background: #f0f4f8;
  border-color: #bcc7d6;
  color: #1f6feb;
}

.header-title > .eyebrow {
  margin: 0 0 4px;
  color: #607086;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
}

.header-title h1 {
  margin: 0;
  color: #162033;
  font-size: 32px;
}

.window-controls {
  display: flex;
  gap: 8px;
}

.window-button {
  min-height: 40px;
  padding: 0 16px;
  border: 1px solid #dce3eb;
  border-radius: 7px;
  background: #ffffff;
  color: #334155;
  font-weight: 700;
  transition: all 200ms ease;
  cursor: pointer;
}

.window-button:hover {
  background: #f0f4f8;
  border-color: #bcc7d6;
}

.window-button.active {
  background: linear-gradient(135deg, #1f6feb 0%, #1e40af 100%);
  color: #ffffff;
  border-color: #1f6feb;
}

.alert {
  margin-bottom: 16px;
  padding: 12px 14px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
}

.alert-error {
  border: 1px solid #f0b4ad;
  background: #fff1ef;
  color: #a12b2b;
}

.loading-overlay {
  display: grid;
  place-items: center;
  gap: 16px;
  min-height: 60vh;
  color: #607086;
  font-weight: 700;
}

.spin {
  animation: spin 900ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.status-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.status-card {
  display: flex;
  gap: 16px;
  padding: 20px;
  border: 1px solid #dce3eb;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transition: all 200ms ease;
}

.status-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
}

.status-card.healthy {
  border-color: #10b981;
  background: linear-gradient(135deg, #f0fdf4 0%, #e8f9f0 100%);
}

.status-card.degraded {
  border-color: #f59e0b;
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
}

.status-card.unhealthy {
  border-color: #ef4444;
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
}

.card-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  color: #0f766e;
}

.status-card.healthy .card-icon {
  color: #10b981;
}

.status-card.degraded .card-icon {
  color: #f59e0b;
}

.status-card.unhealthy .card-icon {
  color: #ef4444;
}

.card-content {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.card-label {
  margin: 0;
  color: #607086;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
}

.card-value {
  margin: 0;
  color: #162033;
  font-size: 28px;
  line-height: 1;
}

.card-content small {
  color: #607086;
  font-size: 12px;
}

.charts-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.chart-card {
  padding: 20px;
  border: 1px solid #dce3eb;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.chart-card h2 {
  margin: 0 0 16px;
  color: #162033;
  font-size: 18px;
}

.chart-empty {
  display: grid;
  place-items: center;
  gap: 8px;
  min-height: 200px;
  color: #607086;
  font-weight: 700;
}

.queue-bars {
  display: grid;
  gap: 16px;
}

.queue-bar-item {
  display: grid;
  gap: 6px;
}

.queue-bar-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.queue-name {
  font-weight: 700;
  color: #162033;
}

.queue-count {
  color: #1f6feb;
  font-weight: 900;
}

.queue-bar-bg {
  height: 24px;
  border-radius: 6px;
  background: #f0f4f8;
  overflow: hidden;
}

.queue-bar-fill {
  height: 100%;
  background: linear-gradient(135deg, #1f6feb 0%, #1e40af 100%);
  border-radius: 6px;
  transition: width 300ms ease;
}

.queue-bar-item small {
  color: #607086;
  font-size: 11px;
}

.exception-list {
  display: grid;
  gap: 12px;
}

.exception-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid #dce3eb;
  border-radius: 8px;
  background: #f9fbfc;
}

.exception-info {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.exception-reason {
  margin: 0;
  color: #162033;
  font-weight: 700;
}

.exception-info small {
  color: #607086;
  font-size: 11px;
}

.exception-stats {
  display: grid;
  gap: 2px;
  place-items: end;
  flex-shrink: 0;
}

.exception-stats strong {
  color: #162033;
  font-size: 16px;
}

.exception-stats span {
  color: #607086;
  font-size: 12px;
}

.activity-section {
  padding: 20px;
  border: 1px solid #dce3eb;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.activity-section h2 {
  margin: 0 0 16px;
  color: #162033;
  font-size: 18px;
}

.activity-empty {
  display: grid;
  place-items: center;
  gap: 8px;
  min-height: 200px;
  color: #607086;
  font-weight: 700;
}

.activity-feed {
  display: grid;
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
}

.activity-item {
  display: grid;
  grid-template-columns: 80px 1fr auto;
  gap: 12px;
  align-items: start;
  padding: 12px;
  border: 1px solid #dce3eb;
  border-radius: 8px;
  background: #f9fbfc;
}

.activity-time {
  color: #607086;
  font-size: 12px;
  font-weight: 700;
}

.activity-content {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.activity-action {
  margin: 0;
  color: #162033;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-content small {
  color: #607086;
  font-size: 11px;
}

.activity-detail {
  color: #1f6feb;
  font-size: 12px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  flex-shrink: 0;
}

.activity-status.success {
  background: #d1fae5;
  color: #065f46;
}

.activity-status.pending {
  background: #fef3c7;
  color: #92400e;
}

.activity-status.error {
  background: #fee2e2;
  color: #991b1b;
}

@media (max-width: 1024px) {
  .charts-section {
    grid-template-columns: 1fr;
  }

  .dashboard-header {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 640px) {
  .dashboard-shell {
    padding: 14px;
  }

  .status-cards {
    grid-template-columns: 1fr;
  }

  .activity-item {
    grid-template-columns: 1fr;
  }

  .window-controls {
    width: 100%;
    flex-wrap: wrap;
  }
}
</style>
