<script setup lang="ts">
import {
  AlertCircle,
  Braces,
  CheckCircle2,
  Database,
  FileJson,
  Loader2,
  ListChecks,
  RefreshCcw,
  Repeat2,
  Rows3,
  Search,
  ShieldCheck,
  Copy,
  Check,
} from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { rabbitApi } from '../api/rabbit';
import type { InspectedMessage, QueueInfo, QueueListItem, RabbitConfig } from '../types';

const INSPECT_LIMIT_MIN = 1;
const INSPECT_LIMIT_MAX = 100;
const REQUEUE_LIMIT_MIN = 1;
const REQUEUE_LIMIT_MAX = 100;

// State
const queueName = ref('');
const queues = ref<QueueListItem[]>([]);
const inspectLimit = ref(5);
const requeueLimit = ref(1);
const targetExchange = ref('');
const targetRoutingKey = ref('');
const autoRefresh = ref(false);
const activeDetailTab = ref<'body' | 'dlq' | 'headers' | 'properties' | 'raw'>('body');

const config = ref<RabbitConfig | null>(null);
const queueInfo = ref<QueueInfo | null>(null);
const messages = ref<InspectedMessage[]>([]);
const activeMessageId = ref<string | null>(null);
const loading = ref(false);
const loadingQueues = ref(false);
const requeueing = ref(false);
const syncingQueues = ref(false);
const error = ref('');
const queueDiscoveryError = ref('');
const lastUpdated = ref('');
const successMessage = ref('');
const copied = ref(false);
const copyToast = ref(false);

let copyTimer: number | undefined;
let refreshTimer: number | undefined;
let successMessageTimer: number | undefined;

// Computed properties
const trimmedQueueName = computed(() => queueName.value.trim());
const hasMessages = computed(() => messages.value.length > 0);
const dlqQueues = computed(() => queues.value.filter((queue) => queue.isDlq && queue.messageCount > 0));
const selectedMessage = computed(() => messages.value.find((message) => message.id === activeMessageId.value) ?? null);
const showQueueDiscoveryError = computed(() => queueDiscoveryError.value.length > 0 && error.value.length === 0);
const isBusy = computed(() => loading.value || loadingQueues.value || requeueing.value || syncingQueues.value);

// Formatters
function clampInteger(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.trunc(value), min), max);
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function fullDate(value: string): string {
  return new Intl.DateTimeFormat('es-BO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}

function messageTitle(message: InspectedMessage): string {
  const messageId = message.properties.messageId;
  if (typeof messageId === 'string' && messageId.length > 0) return messageId;
  if (message.id.startsWith('msg-')) {
    const match = /^msg-([^-]+)-(\d+)$/.exec(message.id);
    if (match) return `msg-${match[1]}#${match[2]}`;
  }
  return message.id;
}

function dlqReason(message: InspectedMessage): string {
  return message.metadata?.dlq?.latestReason ?? 'sin razón';
}

function deathCount(message: InspectedMessage): number {
  return message.metadata?.dlq?.deathCount ?? 0;
}

function getArrivedTime(message: InspectedMessage): string {
  const latestTime = message.metadata?.dlq?.latestTime;
  if (!latestTime) return '-';
  return fullDate(latestTime);
}

function getOriginalExchange(message: InspectedMessage): string {
  return message.inferredOriginalExchange || '-';
}

// Methods
function clearSelection(): void {
  queueInfo.value = null;
  messages.value = [];
  activeMessageId.value = null;
  activeDetailTab.value = 'body';
}

function queueExistsInDiscovery(queue: string): boolean {
  return queues.value.some((item) => item.name === queue);
}

function applyQueueDefaults(): void {
  const discoveredQueue = dlqQueues.value[0];
  const currentQueue = trimmedQueueName.value;
  const currentQueueIsActive = currentQueue.length > 0 && queueExistsInDiscovery(currentQueue);
  if (!discoveredQueue) {
    queueName.value = '';
    return;
  }
  if (!currentQueue || !currentQueueIsActive) {
    queueName.value = discoveredQueue.name;
  }
}

async function loadConfig(): Promise<void> {
  try {
    config.value = await rabbitApi.getConfig();
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  }
}

async function loadQueues(): Promise<void> {
  if (loadingQueues.value) return;
  loadingQueues.value = true;
  queueDiscoveryError.value = '';
  try {
    queues.value = await rabbitApi.listQueues();
    applyQueueDefaults();
  } catch (err) {
    queues.value = [];
    queueDiscoveryError.value = err instanceof Error ? err.message : String(err);
  } finally {
    loadingQueues.value = false;
  }
}

async function selectQueue(queue: QueueListItem): Promise<void> {
  queueName.value = queue.name;
  clearSelection();
  await refresh();
}

async function refresh(): Promise<void> {
  inspectLimit.value = clampInteger(inspectLimit.value, INSPECT_LIMIT_MIN, INSPECT_LIMIT_MAX, 5);
  if (!trimmedQueueName.value) {
    error.value = 'Selecciona una cola DLQ.';
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    const inspected = await rabbitApi.getMessages(trimmedQueueName.value, inspectLimit.value);
    const info = await rabbitApi.getQueueInfo(trimmedQueueName.value);
    queueInfo.value = info;
    messages.value = inspected;
    activeMessageId.value = inspected[0]?.id ?? null;
    activeDetailTab.value = 'body';
    lastUpdated.value = new Date().toISOString();
  } catch (err) {
    clearSelection();
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    loading.value = false;
  }
}

async function syncDetectedQueues(): Promise<void> {
  if (syncingQueues.value || loading.value || loadingQueues.value || requeueing.value) return;
  syncingQueues.value = true;
  try {
    await loadQueues();
    lastUpdated.value = new Date().toISOString();
    if (!trimmedQueueName.value) {
      clearSelection();
      return;
    }
    await refresh();
  } finally {
    syncingQueues.value = false;
  }
}

async function requeue(): Promise<void> {
  if (!trimmedQueueName.value) {
    error.value = 'Selecciona una cola DLQ.';
    return;
  }
  requeueLimit.value = clampInteger(requeueLimit.value, REQUEUE_LIMIT_MIN, REQUEUE_LIMIT_MAX, 1);
  requeueing.value = true;
  error.value = '';
  successMessage.value = '';
  try {
    const result = await rabbitApi.requeue(trimmedQueueName.value, {
      limit: requeueLimit.value,
      targetExchange: targetExchange.value.trim() || undefined,
      targetRoutingKey: targetRoutingKey.value.trim() || undefined,
    });
    showSuccessMessage(`✓ ${result.requeued} de ${result.requested} mensaje(s) reencolados exitosamente`);
    await syncDetectedQueues();
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    requeueing.value = false;
  }
}

function startAutoRefresh(): void {
  stopAutoRefresh();
  refreshTimer = window.setInterval(() => {
    void syncDetectedQueues();
  }, 8000);
}

function stopAutoRefresh(): void {
  if (refreshTimer) {
    window.clearInterval(refreshTimer);
    refreshTimer = undefined;
  }
}

function showSuccessMessage(message: string): void {
  if (successMessageTimer) window.clearTimeout(successMessageTimer);
  successMessage.value = message;
  successMessageTimer = window.setTimeout(() => {
    successMessage.value = '';
  }, 5000);
}

async function copyCurrentContent(): Promise<void> {
  if (!selectedMessage.value) return;
  let content = '';
  switch (activeDetailTab.value) {
    case 'body':
      content = formatJson(selectedMessage.value.body);
      break;
    case 'dlq':
      content = formatJson(selectedMessage.value.metadata?.dlq);
      break;
    case 'headers':
      content = formatJson(selectedMessage.value.metadata?.headers);
      break;
    case 'properties':
      content = formatJson(selectedMessage.value.metadata?.properties);
      break;
    default:
      content = formatJson(selectedMessage.value);
      break;
  }
  try {
    await navigator.clipboard.writeText(content);
    copied.value = true;
    copyToast.value = true;
    if (copyTimer) window.clearTimeout(copyTimer);
    copyTimer = window.setTimeout(() => {
      copied.value = false;
      copyToast.value = false;
    }, 2200);
  } catch (err) {
    console.error(err);
  }
}

// Watchers
watch(autoRefresh, (enabled) => {
  if (enabled) {
    void syncDetectedQueues();
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
});

watch(inspectLimit, (value) => {
  inspectLimit.value = clampInteger(value, INSPECT_LIMIT_MIN, INSPECT_LIMIT_MAX, 5);
});

watch(requeueLimit, (value) => {
  requeueLimit.value = clampInteger(value, REQUEUE_LIMIT_MIN, REQUEUE_LIMIT_MAX, 1);
});

watch(trimmedQueueName, (nextQueue, previousQueue) => {
  if (nextQueue === previousQueue) return;
  targetExchange.value = '';
  targetRoutingKey.value = '';
});

onMounted(async () => {
  await loadConfig();
  await syncDetectedQueues();
});

onBeforeUnmount(() => {
  stopAutoRefresh();
  if (successMessageTimer) window.clearTimeout(successMessageTimer);
});
</script>

<template>
  <div class="inspector-shell">
    <!-- Top Section -->
    <header class="inspector-header">
      <div class="header-content">
        <div>
          <p class="eyebrow">RabbitMQ</p>
          <h1>Inspector de Colas Muertas</h1>
        </div>
        <div class="header-actions">
          <button class="primary" type="button" :disabled="isBusy || !trimmedQueueName" @click="refresh" title="Inspeccionar cola actual">
            <Loader2 v-if="loading" class="spin" :size="18" />
            <RefreshCcw v-else :size="18" />
            <span>Inspeccionar</span>
          </button>
          <button class="icon-button" type="button" :disabled="isBusy" title="Sincronizar colas" @click="syncDetectedQueues">
            <Loader2 v-if="syncingQueues" class="spin" :size="18" />
            <RefreshCcw v-else :size="18" />
          </button>
        </div>
      </div>
    </header>

    <!-- Alerts -->
    <div v-if="error" class="alert danger">
      <AlertCircle :size="20" />
      <div>
        <strong>Error</strong>
        <p>{{ error }}</p>
      </div>
    </div>

    <div v-if="showQueueDiscoveryError" class="alert warning">
      <AlertCircle :size="20" />
      <div>
        <strong>Advertencia</strong>
        <p>{{ queueDiscoveryError }}</p>
      </div>
    </div>

    <div v-if="successMessage" class="alert success">
      <CheckCircle2 :size="20" />
      <div>
        <strong>Éxito</strong>
        <p>{{ successMessage }}</p>
      </div>
    </div>

    <!-- Controls Panel -->
    <section class="controls-panel">
      <div class="control-grid">
        <div class="control-item">
          <label>
            <span class="label-text">Límite de inspección</span>
            <input v-model.number="inspectLimit" type="number" :min="INSPECT_LIMIT_MIN" :max="INSPECT_LIMIT_MAX" />
          </label>
          <small>Máximo de mensajes a mostrar (1-100)</small>
        </div>

        <div class="control-item">
          <label class="switch-label">
            <span class="label-text">Auto-actualizar</span>
            <input v-model="autoRefresh" type="checkbox" />
            <span class="switch-toggle"></span>
          </label>
          <small>Cada 8 segundos</small>
        </div>

        <div class="control-item full">
          <span class="label-text">Cola activa</span>
          <div class="queue-display">
            {{ trimmedQueueName || 'Selecciona una cola...' }}
          </div>
        </div>
      </div>
    </section>

    <!-- Queues Discovery -->
    <section class="queues-section">
      <div class="section-header">
        <div>
          <h3>Colas Detectadas</h3>
          <span class="badge">{{ dlqQueues.length }} activa(s) • {{ dlqQueues.reduce((t, q) => t + q.messageCount, 0) }} mensajes</span>
        </div>
      </div>

      <div v-if="loadingQueues" class="loading-state">
        <Loader2 class="spin" :size="24" />
        <span>Buscando colas...</span>
      </div>

      <div v-else-if="dlqQueues.length === 0" class="empty-state">
        <Database :size="32" />
        <span>Sin colas muertas con mensajes</span>
      </div>

      <div v-else class="queues-grid">
        <button
          v-for="queue in dlqQueues"
          :key="queue.name"
          class="queue-card card"
          :class="{ active: trimmedQueueName === queue.name }"
          type="button"
          @click="selectQueue(queue)"
        >
          <div class="queue-header">
            <strong>{{ queue.name }}</strong>
            <span class="count-badge">{{ queue.messageCount }}</span>
          </div>
          <small>Lista para inspección</small>
        </button>
      </div>
    </section>

    <!-- Main Content -->
    <section class="content-section">
      <!-- Messages List -->
      <aside class="messages-panel">
        <div class="panel-header">
          <h3>Mensajes</h3>
          <span v-if="hasMessages" class="count">{{ messages.length }}</span>
        </div>

        <div v-if="!hasMessages" class="empty-state compact">
          <Database :size="28" />
          <span>Sin mensajes</span>
        </div>

        <div v-else class="messages-list">
          <button
            v-for="message in messages"
            :key="message.id"
            class="message-item"
            :class="{ active: activeMessageId === message.id }"
            type="button"
            @click="activeMessageId = message.id"
          >
            <div class="message-title">{{ messageTitle(message) }}</div>
            <small>{{ message.bodyEncoding }} • {{ message.sizeBytes }} bytes</small>
            <small>{{ dlqReason(message) }}</small>
          </button>
        </div>
      </aside>

      <!-- Detail Panel -->
      <main class="detail-panel">
        <template v-if="selectedMessage">
          <div class="detail-header">
            <div>
              <p class="eyebrow">Mensaje</p>
              <h2>{{ messageTitle(selectedMessage) }}</h2>
            </div>
            <span class="badge-pill">{{ selectedMessage.bodyEncoding }}</span>
          </div>

          <div class="metadata-table">
            <div class="metadata-row">
              <span class="label">Exchange actual</span>
              <span class="value">{{ selectedMessage.fields.exchange || 'default' }}</span>
            </div>
            <div class="metadata-row">
              <span class="label">Routing key</span>
              <span class="value">{{ selectedMessage.fields.routingKey }}</span>
            </div>
            <div class="metadata-row">
              <span class="label">Exchange original</span>
              <span class="value">{{ getOriginalExchange(selectedMessage) }}</span>
            </div>
            <div class="metadata-row">
              <span class="label">Routing keys originales</span>
              <span class="value">{{ selectedMessage.inferredOriginalRoutingKeys.join(', ') || '-' }}</span>
            </div>
            <div class="metadata-row">
              <span class="label">Redelivered</span>
              <span class="value">{{ selectedMessage.fields.redelivered ? 'Sí' : 'No' }}</span>
            </div>
            <div class="metadata-row">
              <span class="label">Veces enviado a DLQ</span>
              <span class="value">{{ deathCount(selectedMessage) }}</span>
            </div>
            <div class="metadata-row">
              <span class="label">Motivo DLQ</span>
              <span class="value">{{ dlqReason(selectedMessage) }}</span>
            </div>
            <div class="metadata-row">
              <span class="label">Llegada DLQ</span>
              <span class="value">{{ getArrivedTime(selectedMessage) }}</span>
            </div>
          </div>

          <!-- Tabs -->
          <div class="tabs">
            <button
              class="tab"
              :class="{ active: activeDetailTab === 'body' }"
              type="button"
              @click="activeDetailTab = 'body'"
            >
              <FileJson :size="16" />
              Body
            </button>
            <button
              class="tab"
              :class="{ active: activeDetailTab === 'dlq' }"
              type="button"
              @click="activeDetailTab = 'dlq'"
            >
              <ListChecks :size="16" />
              DLQ Metadata
            </button>
            <button
              class="tab"
              :class="{ active: activeDetailTab === 'headers' }"
              type="button"
              @click="activeDetailTab = 'headers'"
            >
              <Rows3 :size="16" />
              Headers
            </button>
            <button
              class="tab"
              :class="{ active: activeDetailTab === 'properties' }"
              type="button"
              @click="activeDetailTab = 'properties'"
            >
              <ShieldCheck :size="16" />
              Properties
            </button>
            <button
              class="tab"
              :class="{ active: activeDetailTab === 'raw' }"
              type="button"
              @click="activeDetailTab = 'raw'"
            >
              <Braces :size="16" />
              Raw
            </button>
          </div>

          <!-- Content -->
          <div class="code-viewer">
            <div class="code-toolbar">
              <span class="code-label">
                {{
                  activeDetailTab === 'body'
                    ? 'Message Body'
                    : activeDetailTab === 'dlq'
                      ? 'DLQ Metadata'
                      : activeDetailTab === 'headers'
                        ? 'Message Headers'
                        : activeDetailTab === 'properties'
                          ? 'Message Properties'
                          : 'Full Message'
                }}
              </span>
              <button class="copy-btn" type="button" @click="copyCurrentContent">
                <Check v-if="copied" :size="14" />
                <Copy v-else :size="14" />
                <span>{{ copied ? 'Copiado' : 'Copiar' }}</span>
              </button>
            </div>

            <pre v-if="activeDetailTab === 'body'" class="code"><code>{{ formatJson(selectedMessage.body) }}</code></pre>
            <pre v-else-if="activeDetailTab === 'dlq'" class="code"><code>{{ formatJson(selectedMessage.metadata?.dlq) }}</code></pre>
            <pre v-else-if="activeDetailTab === 'headers'" class="code"><code>{{ formatJson(selectedMessage.metadata?.headers) }}</code></pre>
            <pre v-else-if="activeDetailTab === 'properties'" class="code"><code>{{ formatJson(selectedMessage.metadata?.properties) }}</code></pre>
            <pre v-else class="code"><code>{{ formatJson(selectedMessage) }}</code></pre>
          </div>
        </template>

        <div v-else class="empty-state">
          <Search :size="32" />
          <span>Selecciona un mensaje para ver detalles</span>
        </div>
      </main>

      <!-- Requeue Panel -->
      <aside class="requeue-panel">
        <div class="panel-header">
          <h3>Reencolar</h3>
          <Repeat2 :size="20" />
        </div>

        <div class="form-group">
          <label>
            <span class="label-text">Cantidad</span>
            <input v-model.number="requeueLimit" type="number" :min="REQUEUE_LIMIT_MIN" :max="REQUEUE_LIMIT_MAX" />
          </label>
          <small>1-100 mensajes</small>
        </div>

        <div class="form-group">
          <label>
            <span class="label-text">Exchange destino</span>
            <input
              v-model="targetExchange"
              type="text"
              :placeholder="selectedMessage?.inferredOriginalExchange || 'Inferido automáticamente'"
            />
          </label>
          <small v-if="selectedMessage?.inferredOriginalExchange" class="hint">
            Detectado: <strong>{{ selectedMessage.inferredOriginalExchange }}</strong>
          </small>
        </div>

        <div class="form-group">
          <label>
            <span class="label-text">Routing key destino</span>
            <input
              v-model="targetRoutingKey"
              type="text"
              :placeholder="selectedMessage?.inferredOriginalRoutingKeys[0] || 'Inferido automáticamente'"
            />
          </label>
          <small v-if="selectedMessage?.inferredOriginalRoutingKeys[0]" class="hint">
            Detectado: <strong>{{ selectedMessage.inferredOriginalRoutingKeys[0] }}</strong>
          </small>
        </div>

        <button
          class="primary full"
          type="button"
          :disabled="isBusy || !trimmedQueueName"
          @click="requeue"
        >
          <Loader2 v-if="requeueing" class="spin" :size="18" />
          <Repeat2 v-else :size="18" />
          <span>Reencolar Ahora</span>
        </button>

        <div class="info-box">
          <p>
            Si falla el reencolado, el mensaje <strong>NO será eliminado</strong> de la DLQ y podrás reintentar.
          </p>
        </div>
      </aside>
    </section>
  </div>
</template>

<style scoped>
.inspector-shell {
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg-secondary);
  overflow: hidden;
}

/* Header */
.inspector-header {
  padding: var(--spacing-lg) var(--spacing-2xl);
  background: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
  flex-shrink: 0;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-lg);
}

.header-content > div:first-child p {
  margin: 0 0 var(--spacing-xs) 0;
}

.header-content > div:first-child h1 {
  margin: 0;
}

.header-actions {
  display: flex;
  gap: var(--spacing-md);
  flex-shrink: 0;
}

/* Alerts */
.alert {
  display: flex;
  gap: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-xl);
  margin: 0;
  background-color: var(--color-info-light);
  border-left: 4px solid var(--color-info);
  font-size: var(--font-size-sm);
  color: var(--color-info);
  align-items: center;
  border-radius: 10px;
}

.alert.warning {
  background-color: var(--color-warning-light);
  border-left-color: var(--color-warning);
  color: var(--color-warning);
}

.alert.success {
  background-color: var(--color-success-light);
  border-left-color: var(--color-success);
  color: var(--color-success);
}

.alert.danger {
  background-color: var(--color-danger-light);
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
  color: inherit;
}

/* Controls */
.controls-panel {
  padding: var(--spacing-lg) var(--spacing-2xl);
  background: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-border);
}

.control-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: var(--spacing-lg);
}

.control-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.control-item.full {
  grid-column: 1 / -1;
}

.label-text {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-primary);
  display: block;
  margin-bottom: var(--spacing-xs);
}

.control-item input[type="number"] {
  padding: var(--spacing-md) var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
}

.control-item input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-lighter);
}

.switch-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  cursor: pointer;
}

.switch-toggle {
  width: 44px;
  height: 24px;
  background: var(--color-border);
  border-radius: 12px;
  position: relative;
  transition: all var(--transition-fast);
}

.switch-label input[type="checkbox"] {
  display: none;
}

.switch-label input:checked ~ .switch-toggle {
  background: var(--color-primary);
}

.switch-label input:checked ~ .switch-toggle::after {
  transform: translateX(20px);
}

.switch-toggle::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
  transition: transform var(--transition-fast);
  box-shadow: var(--shadow-sm);
}

.queue-display {
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-bg-tertiary);
  border-radius: 6px;
  border: 1px solid var(--color-border);
  font-weight: 500;
  color: var(--color-text-primary);
  word-break: break-all;
}

.control-item small {
  margin-top: 0;
}

/* Queues Section */
.queues-section {
  padding: var(--spacing-lg) var(--spacing-2xl);
  background: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-border);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}

.section-header h3 {
  margin: 0 0 var(--spacing-sm) 0;
}

.badge {
  display: inline-block;
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--color-primary-lighter);
  color: var(--color-primary);
  border-radius: 4px;
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.queues-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: var(--spacing-lg);
}

.queue-card {
  background: var(--color-bg-primary);
  border: 2px solid var(--color-border);
  border-radius: 8px;
  padding: var(--spacing-lg);
  text-align: left;
  transition: all var(--transition-base);
  cursor: pointer;
}

.queue-card:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-md);
}

.queue-card.active {
  border-color: var(--color-primary);
  background: var(--color-primary-lighter);
  box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.1);
}

.queue-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.queue-header strong {
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  word-break: break-word;
}

.count-badge {
  background: var(--color-warning-light);
  color: var(--color-warning);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: 4px;
  font-size: var(--font-size-xs);
  font-weight: 700;
  white-space: nowrap;
}

.queue-card small {
  color: var(--color-text-tertiary);
}

/* Content Section */
.content-section {
  flex: 1;
  display: grid;
  grid-template-columns: 200px 1fr 280px;
  gap: 0;
  overflow: hidden;
  border-top: 1px solid var(--color-border);
}

@media (max-width: 1400px) {
  .content-section {
    grid-template-columns: 180px 1fr 260px;
  }
}

@media (max-width: 1200px) {
  .content-section {
    grid-template-columns: 1fr;
  }

  .messages-panel,
  .requeue-panel {
    display: none;
  }
}

/* Panels */
.messages-panel,
.requeue-panel,
.detail-panel {
  display: flex;
  flex-direction: column;
  background: var(--color-bg-primary);
  border-right: 1px solid var(--color-border);
  overflow: hidden;
}

.detail-panel {
  border-right: none;
  overflow-y: auto;
}

.requeue-panel {
  border-right: none;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.panel-header h3 {
  margin: 0;
  font-size: var(--font-size-lg);
}

/* Messages List */
.messages-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.message-item {
  padding: var(--spacing-md) var(--spacing-lg);
  border: none;
  border-bottom: 1px solid var(--color-border-light);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: all var(--transition-fast);
  color: var(--color-text-primary);
}

.message-item:hover {
  background: var(--color-bg-tertiary);
}

.message-item.active {
  background: var(--color-primary-lighter);
  border-left: 3px solid var(--color-primary);
}

.message-title {
  font-weight: 600;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-xs);
  word-break: break-word;
}

.message-item small {
  display: block;
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  margin: var(--spacing-xs) 0 0 0;
}

/* Detail Panel */
.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  gap: var(--spacing-lg);
}

.detail-header > div p {
  margin: 0 0 var(--spacing-xs) 0;
}

.detail-header h2 {
  margin: 0;
  word-break: break-word;
}

.badge-pill {
  display: inline-block;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-primary-lighter);
  color: var(--color-primary);
  border-radius: 20px;
  font-size: var(--font-size-xs);
  font-weight: 700;
  white-space: nowrap;
}

.metadata-table {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
  font-size: var(--font-size-sm);
}

.metadata-row {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.metadata-row .label {
  font-weight: 600;
  color: var(--color-text-secondary);
}

.metadata-row .value {
  color: var(--color-text-primary);
  word-break: break-word;
  font-family: monospace;
  font-size: var(--font-size-xs);
  background: var(--color-bg-tertiary);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: 4px;
}

/* Tabs */
.tabs {
  display: flex;
  gap: 0;
  padding: 0 var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  overflow-x: auto;
  flex-shrink: 0;
}

.tab {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  background: transparent;
  border: none;
  border-bottom: 3px solid transparent;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.tab:hover {
  color: var(--color-text-primary);
}

.tab.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

/* Code Viewer */
.code-viewer {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  padding: var(--spacing-lg);
  gap: var(--spacing-md);
}

.code-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-md);
  flex-shrink: 0;
}

.code-label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-primary);
}

.copy-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-xs);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.copy-btn:hover {
  background: var(--color-border);
  color: var(--color-text-primary);
}

.code {
  flex: 1;
  overflow-y: auto;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: var(--spacing-lg);
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: var(--font-size-xs);
  color: var(--color-text-primary);
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
}

code {
  color: inherit;
  font-family: inherit;
}

/* Requeue Panel */
.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding-bottom: var(--spacing-lg);
  border-bottom: 1px solid var(--color-border-light);
  padding: var(--spacing-lg);
}

.form-group:last-of-type {
  border-bottom: none;
}

.form-group label {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.form-group input {
  padding: var(--spacing-md) var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
}

.form-group input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-lighter);
}

.form-group small {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  margin-top: var(--spacing-xs);
}

.hint {
  color: var(--color-primary);
}

.full {
  grid-column: 1 / -1;
  margin: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-lg);
}

.info-box {
  padding: var(--spacing-lg);
  background: var(--color-info-light);
  border-left: 3px solid var(--color-info);
  border-radius: 4px;
  margin: var(--spacing-lg);
}

.info-box p {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-info);
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
  border: 1px dashed var(--color-border);
  border-radius: 12px;
  background: var(--color-bg-secondary);
}

.empty-state.compact {
  padding: var(--spacing-lg);
  gap: var(--spacing-sm);
}

.loading-state svg,
.empty-state svg {
  opacity: 0.5;
}

.loading-state span,
.empty-state span {
  font-size: var(--font-size-sm);
}

/* Responsive */
@media (max-width: 768px) {
  .inspector-header {
    padding: var(--spacing-md);
  }

  .header-content {
    flex-direction: column;
  }

  .control-grid {
    grid-template-columns: 1fr;
  }

  .queues-grid {
    grid-template-columns: 1fr;
  }

  .metadata-table {
    grid-template-columns: 1fr;
  }
}
</style>
