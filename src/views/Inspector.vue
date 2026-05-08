<script setup lang="ts">
import {
  AlertCircle,
  Braces,
  CheckCircle2,
  Clock3,
  Database,
  FileJson,
  Loader2,
  ListChecks,
  RefreshCcw,
  Repeat2,
  Rows3,
  Search,
  Server,
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
const isBusy = computed(() => loading.value || loadingQueues.value || requeueing.value || syncingQueues.value);
const statusTone = computed(() => {
  if (error.value) return 'danger';
  if (queueDiscoveryError.value) return 'warning';
  return 'ok';
});
const apiLabel = computed(() => rabbitApi.apiBaseUrl);

// Formatters
function clampInteger(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.trunc(value), min), max);
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function shortDate(value: string): string {
  return new Intl.DateTimeFormat('es-BO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
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
  const deaths = message.metadata?.headers?.['x-death'];
  if (!Array.isArray(deaths) || deaths.length === 0) return '-';
  const timestamp = deaths[0]?.time?.value;
  if (typeof timestamp !== 'number') return '-';
  return fullDate(new Date(timestamp * 1000).toISOString());
}

function getOriginalExchange(message: InspectedMessage): string {
  const headers = message.metadata?.headers;
  if (!headers || typeof headers !== 'object') return '-';
  const firstDeathExchange = headers['x-first-death-exchange'];
  if (typeof firstDeathExchange === 'string' && firstDeathExchange.length > 0) return firstDeathExchange;
  const deaths = headers['x-death'];
  if (Array.isArray(deaths)) {
    const exchange = deaths.find((death) => typeof death?.exchange === 'string' && death.exchange.length > 0)?.exchange;
    if (exchange) return exchange;
  }
  return '-';
}

// Methods
function resetActiveTab(): void {
  activeDetailTab.value = 'body';
}

function clearSelection(): void {
  queueInfo.value = null;
  messages.value = [];
  activeMessageId.value = null;
  resetActiveTab();
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
    resetActiveTab();
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
  <main class="app-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">RabbitMQ</p>
        <h1>Inspector de DLQ</h1>
      </div>
      <div class="topbar-actions">
        <div class="connection" :class="statusTone">
          <CheckCircle2 v-if="statusTone === 'ok'" :size="18" />
          <AlertCircle v-else :size="18" />
          <span>{{ error ? 'Atención' : 'Conectado' }}</span>
        </div>
      </div>
    </header>

    <section class="controls">
      <div class="controls-grid">
        <div class="selected-queue-card field-wide">
          <span class="selected-queue-label">Cola activa</span>
          <strong>{{ trimmedQueueName || 'Selecciona una cola detectada' }}</strong>
          <small>
            {{
              trimmedQueueName
                ? 'La selección viene de las DLQ con mensajes detectadas por RabbitMQ.'
                : 'La cola activa se elige desde las tarjetas de DLQ con mensajes.'
            }}
          </small>
        </div>

        <label class="field">
          <span>Límite de inspección</span>
          <input v-model.number="inspectLimit" type="number" :min="INSPECT_LIMIT_MIN" :max="INSPECT_LIMIT_MAX" />
          <small>Cuántos mensajes como máximo se leen para mostrarlos. No elimina mensajes de la DLQ.</small>
        </label>

        <div class="switch-field">
          <span>Auto refresh</span>
          <label class="switch">
            <input v-model="autoRefresh" type="checkbox" />
            <span />
          </label>
          <small>Cada 8 segundos</small>
        </div>

        <button class="primary" type="button" :disabled="isBusy || !trimmedQueueName" @click="refresh">
          <Loader2 v-if="loading" class="spin" :size="18" />
          <RefreshCcw v-else :size="18" />
          <span>Inspeccionar</span>
        </button>
      </div>

      <div class="queues-discovery">
        <div class="discovery-header">
          <div>
            <p class="eyebrow">Colas Detectadas</p>
            <div class="queues-summary">
              <span class="summary-pill">{{ dlqQueues.length }} cola(s) activa(s)</span>
              <span class="summary-pill soft">
                {{ dlqQueues.reduce((total, queue) => total + queue.messageCount, 0) }} mensaje(s) en DLQ
              </span>
            </div>
          </div>
          <button class="icon-button" type="button" :disabled="isBusy" title="Recargar colas" @click="syncDetectedQueues">
            <RefreshCcw :size="18" />
          </button>
        </div>

        <div v-if="loadingQueues" class="loading-state">
          <Loader2 class="spin" :size="20" />
          <span>Buscando colas DLQ...</span>
        </div>

        <div v-else-if="dlqQueues.length === 0" class="empty-queues">
          <Database :size="24" />
          <span>Sin colas muertas con mensajes</span>
        </div>

        <div v-else class="queues-grid">
          <button v-for="queue in dlqQueues" :key="queue.name" class="queue-card" :class="{ active: trimmedQueueName === queue.name }" type="button" @click="selectQueue(queue)">
            <div class="queue-info">
              <strong>{{ queue.name }}</strong>
              <small>Lista para inspección y reencolado</small>
            </div>
            <div class="queue-card-meta">
              <span class="queue-card-count">{{ queue.messageCount }} mensaje(s)</span>
              <div class="queue-badge">
                <AlertCircle :size="18" />
              </div>
            </div>
          </button>
        </div>

        <div v-if="queueDiscoveryError" class="notice warning">
          <AlertCircle :size="18" />
          <span>{{ queueDiscoveryError }}</span>
          <small>La consola puede quedar parcial hasta que vuelva RabbitMQ Management.</small>
        </div>
      </div>
    </section>

    <section v-if="error" class="alert">
      <AlertCircle :size="20" />
      <span>{{ error }}</span>
      <small>API: {{ apiLabel }}</small>
    </section>

    <section v-if="successMessage" class="alert success">
      <CheckCircle2 :size="20" />
      <span>{{ successMessage }}</span>
    </section>

    <section class="summary-grid">
      <article class="metric">
        <Server :size="20" />
        <span>Backend</span>
        <strong>{{ config?.urlConfigured ? 'API lista' : 'Sin config' }}</strong>
      </article>
      <article class="metric">
        <Database :size="20" />
        <span>Mensajes</span>
        <strong>{{ queueInfo?.messageCount ?? '-' }}</strong>
      </article>
      <article class="metric">
        <ShieldCheck :size="20" />
        <span>Consumidores</span>
        <strong>{{ queueInfo?.consumerCount ?? '-' }}</strong>
      </article>
      <article class="metric">
        <Clock3 :size="20" />
        <span>Actualizado</span>
        <strong>{{ lastUpdated ? shortDate(lastUpdated) : '-' }}</strong>
      </article>
    </section>

    <section class="workspace">
      <aside class="messages-list">
        <div class="panel-title">
          <h2>Mensajes</h2>
          <button class="icon-button" type="button" :disabled="isBusy || !trimmedQueueName" title="Actualizar" @click="refresh">
            <RefreshCcw :size="18" />
          </button>
        </div>

        <div v-if="!hasMessages" class="empty-state">
          <Database :size="24" />
          <span>Sin mensajes visibles</span>
        </div>

        <button v-for="message in messages" :key="message.id" class="message-row" :class="{ active: activeMessageId === message.id }" type="button" @click="activeMessageId = message.id">
          <span class="message-main">
            <strong>{{ messageTitle(message) }}</strong>
            <small>{{ message.bodyEncoding }} / {{ message.sizeBytes }} bytes</small>
            <small>{{ dlqReason(message) }} / x-death {{ deathCount(message) }}</small>
          </span>
          <span class="message-timestamp">{{ getArrivedTime(message) }}</span>
          <span class="routing-key">{{ message.fields.routingKey }}</span>
        </button>
      </aside>

      <section class="detail-panel">
        <template v-if="selectedMessage">
          <div class="detail-header">
            <div>
              <p class="eyebrow">Mensaje</p>
              <h2>{{ messageTitle(selectedMessage) }}</h2>
            </div>
            <span class="pill">{{ selectedMessage.bodyEncoding }}</span>
          </div>

          <div class="metadata-grid">
            <span>Exchange actual</span>
            <strong>{{ selectedMessage.fields.exchange || 'default' }}</strong>
            <span>Routing key actual</span>
            <strong>{{ selectedMessage.fields.routingKey }}</strong>
            <span>Exchange original</span>
            <strong>{{ getOriginalExchange(selectedMessage) }}</strong>
            <span>Routing key original</span>
            <strong>{{ selectedMessage.inferredOriginalRoutingKeys.join(', ') || '-' }}</strong>
            <span>Redelivered</span>
            <strong>{{ selectedMessage.fields.redelivered ? 'Sí' : 'No' }}</strong>
            <span>Motivo DLQ</span>
            <strong>{{ selectedMessage.metadata?.dlq?.latestReason || '-' }}</strong>
            <span>Veces DLQ</span>
            <strong>{{ selectedMessage.metadata?.dlq?.deathCount || 0 }}</strong>
            <span>Cola origen</span>
            <strong>{{ selectedMessage.metadata?.dlq?.latestQueue || selectedMessage.metadata?.sourceQueue || '-' }}</strong>
            <span>Hora llegada DLQ</span>
            <strong>{{ getArrivedTime(selectedMessage) }}</strong>
            <span>Inspeccionado</span>
            <strong>{{ selectedMessage.inspectedAt ? shortDate(selectedMessage.inspectedAt) : '-' }}</strong>
          </div>

          <div class="tab-bar">
            <button class="tab-button" :class="{ active: activeDetailTab === 'body' }" type="button" @click="activeDetailTab = 'body'">
              <FileJson :size="16" />
              Body
            </button>
            <button class="tab-button" :class="{ active: activeDetailTab === 'dlq' }" type="button" @click="activeDetailTab = 'dlq'">
              <ListChecks :size="16" />
              DLQ
            </button>
            <button class="tab-button" :class="{ active: activeDetailTab === 'headers' }" type="button" @click="activeDetailTab = 'headers'">
              <Rows3 :size="16" />
              Headers
            </button>
            <button class="tab-button" :class="{ active: activeDetailTab === 'properties' }" type="button" @click="activeDetailTab = 'properties'">
              <ShieldCheck :size="16" />
              Properties
            </button>
            <button class="tab-button" :class="{ active: activeDetailTab === 'raw' }" type="button" @click="activeDetailTab = 'raw'">
              <Braces :size="16" />
              Raw
            </button>
          </div>

          <div class="body-section">
            <div class="body-toolbar">
              <div class="section-title">
                {{
                  activeDetailTab === 'body'
                    ? 'Body'
                    : activeDetailTab === 'dlq'
                      ? 'Metadata DLQ'
                      : activeDetailTab === 'headers'
                        ? 'Headers'
                        : activeDetailTab === 'properties'
                          ? 'Properties'
                          : 'Mensaje completo'
                }}
              </div>
              <button class="copy-button" type="button" @click="copyCurrentContent">
                <Check v-if="copied" :size="14" />
                <Copy v-else :size="14" />
                <span>{{ copied ? 'Copiado' : 'Copiar' }}</span>
              </button>
            </div>

            <pre v-if="activeDetailTab === 'body'">{{ formatJson(selectedMessage.body) }}</pre>
            <pre v-else-if="activeDetailTab === 'dlq'">{{ formatJson(selectedMessage.metadata?.dlq) }}</pre>
            <pre v-else-if="activeDetailTab === 'headers'">{{ formatJson(selectedMessage.metadata?.headers) }}</pre>
            <pre v-else-if="activeDetailTab === 'properties'">{{ formatJson(selectedMessage.metadata?.properties) }}</pre>
            <pre v-else>{{ formatJson(selectedMessage) }}</pre>

            <transition name="fade">
              <div v-if="copyToast" class="copy-toast">
                Copiado al portapapeles
              </div>
            </transition>
          </div>
        </template>

        <div v-else class="empty-detail">
          <Search :size="26" />
          <span>Selecciona un mensaje</span>
        </div>
      </section>

      <aside class="action-panel">
        <div class="panel-title">
          <h2>Reencolar</h2>
          <Repeat2 :size="18" />
        </div>

        <label class="field">
          <span>Cantidad</span>
          <input v-model.number="requeueLimit" type="number" :min="REQUEUE_LIMIT_MIN" :max="REQUEUE_LIMIT_MAX" />
        </label>

        <label class="field">
          <span>Exchange destino</span>
          <input v-model="targetExchange" type="text" :placeholder="selectedMessage?.inferredOriginalExchange || 'inferido de x-death'" />
          <small v-if="selectedMessage?.inferredOriginalExchange">Detectado: {{ selectedMessage.inferredOriginalExchange }}</small>
        </label>

        <label class="field">
          <span>Routing key destino</span>
          <input v-model="targetRoutingKey" type="text" :placeholder="selectedMessage?.inferredOriginalRoutingKeys[0] || 'inferido de x-death'" />
          <small v-if="selectedMessage?.inferredOriginalRoutingKeys[0]">
            Detectado: {{ selectedMessage.inferredOriginalRoutingKeys[0] }}
          </small>
        </label>

        <button class="danger" type="button" :disabled="isBusy || !trimmedQueueName" @click="requeue">
          <Loader2 v-if="requeueing" class="spin" :size="18" />
          <Repeat2 v-else :size="18" />
          <span>Reencolar</span>
        </button>

        <p class="requeue-note">
          Si el reencolado falla, el backend no hace <code>ack</code> del mensaje original y este permanece en la DLQ.
        </p>
      </aside>
    </section>
  </main>
</template>

<style scoped>
/* Layout Principal */
.app-shell {
  width: 100%;
  min-height: 100vh;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Topbar */
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #dce3eb;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  flex-shrink: 0;
}

.topbar > div:first-child {
  flex: 1;
}

.topbar p {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: #64748b;
}

.topbar h1 {
  margin: 4px 0 0 0;
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;
}

.topbar-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.connection {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.connection.ok {
  background: #f0fdf4;
  color: #059669;
}

.connection.warning {
  background: #fffbeb;
  color: #ca8a04;
}

.connection.danger {
  background: #fef2f2;
  color: #dc2626;
}

/* Controls */
.controls {
  padding: 20px 24px;
  background: #f8fafc;
  border-bottom: 1px solid #dce3eb;
  overflow-y: auto;
  max-height: 35vh;
}

.controls-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 16px;
  margin-bottom: 20px;
}

.field-wide {
  grid-column: 1 / -1;
}

.selected-queue-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: #ffffff;
  border: 1px solid #dce3eb;
  border-radius: 8px;
}

.selected-queue-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: #64748b;
  letter-spacing: 0.3px;
}

.selected-queue-card strong {
  font-size: 15px;
  color: #0f172a;
  word-break: break-word;
}

.selected-queue-card small {
  font-size: 12px;
  color: #64748b;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field span {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}

.field input {
  padding: 8px 12px;
  border: 1px solid #dce3eb;
  border-radius: 6px;
  font-size: 13px;
  color: #0f172a;
  transition: border-color 150ms ease;
}

.field input:focus {
  outline: none;
  border-color: #0969da;
  box-shadow: 0 0 0 3px rgba(9, 105, 218, 0.1);
}

.field small {
  font-size: 11px;
  color: #64748b;
}

.switch-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.switch-field span {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}

.switch {
  position: relative;
  display: inline-flex;
  width: 44px;
  height: 24px;
  cursor: pointer;
}

.switch input {
  display: none;
}

.switch > span {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  transition: all 200ms ease;
}

.switch input:checked + span {
  left: 22px;
  background: #10b981;
  border-color: #10b981;
}

.switch-field small {
  font-size: 11px;
  color: #64748b;
}

/* Buttons */
.primary,
.danger,
.icon-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 200ms ease;
}

.primary {
  background: linear-gradient(135deg, #1f6feb 0%, #1e40af 100%);
  color: #ffffff;
  border: 1px solid #1f6feb;
}

.primary:hover:not(:disabled) {
  box-shadow: 0 4px 12px rgba(31, 111, 235, 0.3);
  transform: translateY(-2px);
}

.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.danger {
  background: #ef4444;
  color: #ffffff;
}

.danger:hover:not(:disabled) {
  background: #dc2626;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.icon-button {
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid #dce3eb;
  background: #ffffff;
  color: #0f172a;
}

.icon-button:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #0969da;
  color: #0969da;
}

.icon-button:disabled {
  opacity: 0.5;
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

/* Queues Discovery */
.queues-discovery {
  margin-top: 16px;
}

.discovery-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.discovery-header > div:first-child {
  flex: 1;
}

.discovery-header p {
  margin: 0 0 6px 0;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: #64748b;
  letter-spacing: 0.3px;
}

.queues-summary {
  display: flex;
  gap: 8px;
}

.summary-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: #e6f2ff;
  color: #0969da;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.summary-pill.soft {
  background: #f1f5f9;
  color: #64748b;
}

.loading-state,
.empty-state,
.empty-queues {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 20px;
  text-align: center;
  color: #64748b;
  font-size: 13px;
  font-weight: 500;
}

.queues-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px;
}

.queue-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 12px;
  background: #ffffff;
  border: 1px solid #dce3eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 200ms ease;
  color: #0f172a;
  text-align: left;
}

.queue-card:hover {
  border-color: #0969da;
  box-shadow: 0 2px 8px rgba(9, 105, 218, 0.1);
  transform: translateY(-2px);
}

.queue-card.active {
  background: #e6f2ff;
  border-color: #1f6feb;
  box-shadow: 0 4px 12px rgba(31, 111, 235, 0.15);
}

.queue-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.queue-info strong {
  font-size: 13px;
  font-weight: 700;
}

.queue-info small {
  font-size: 11px;
  color: #64748b;
}

.queue-card-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #e2e8f0;
}

.queue-card-count {
  font-size: 12px;
  font-weight: 700;
  color: #0969da;
}

.queue-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: #fef2f2;
  border-radius: 6px;
  color: #dc2626;
}

.notice {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: #fffbeb;
  border: 1px solid #fcd34d;
  border-radius: 8px;
  color: #92400e;
  font-size: 12px;
}

.notice small {
  font-size: 11px;
  opacity: 0.8;
}

/* Alerts */
.alert {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 24px;
  margin: 0;
  background: #fef2f2;
  border-bottom: 1px solid #fecaca;
  color: #991b1b;
  font-size: 13px;
  flex-shrink: 0;
}

.alert.success {
  background: #f0fdf4;
  border-bottom-color: #bbf7d0;
  color: #065f46;
}

.alert > svg {
  flex-shrink: 0;
  margin-top: 2px;
}

.alert span {
  flex: 1;
  font-weight: 500;
}

.alert small {
  display: block;
  font-size: 11px;
  opacity: 0.7;
  margin-top: 4px;
}

/* Summary Grid */
.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  padding: 16px 24px;
  background: #f8fafc;
  border-bottom: 1px solid #dce3eb;
  flex-shrink: 0;
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  text-align: center;
  padding: 12px;
  background: #ffffff;
  border: 1px solid #dce3eb;
  border-radius: 8px;
}

.metric svg {
  color: #0969da;
}

.metric span {
  font-size: 12px;
  color: #64748b;
  font-weight: 600;
}

.metric strong {
  font-size: 16px;
  color: #0f172a;
  font-weight: 700;
}

/* Workspace */
.workspace {
  display: grid;
  grid-template-columns: 280px 1fr 320px;
  gap: 0;
  flex: 1;
  overflow: hidden;
}

.messages-list,
.detail-panel,
.action-panel {
  display: flex;
  flex-direction: column;
  border-right: 1px solid #dce3eb;
  overflow: hidden;
}

.action-panel {
  border-right: none;
}

.panel-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid #dce3eb;
  background: #f8fafc;
  flex-shrink: 0;
}

.panel-title h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
}

/* Messages List */
.messages-list {
  position: relative;
  background: #ffffff;
}

.message-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: none;
  border-bottom: 1px solid #f1f5f9;
  background: #ffffff;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: all 180ms ease;
  border-left: 3px solid transparent;
}

.message-row:hover {
  background: #f8fafc;
  border-left-color: #0969da;
  transform: translateX(2px);
}

.message-row.active {
  background: linear-gradient(135deg, #f0f4f9 0%, #e6f2ff 100%);
  border-left-color: #1f6feb;
  border-bottom-color: #e2e8f0;
  box-shadow: inset 0 2px 8px rgba(31, 111, 235, 0.08);
}

.message-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.message-main strong {
  font-weight: 700;
  font-size: 13px;
  color: #0f172a;
  word-break: break-word;
  line-height: 1.3;
}

.message-main small {
  font-size: 11px;
  color: #64748b;
  line-height: 1.4;
}

.message-timestamp {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  color: #059669;
  background: #f0fdf4;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #dcfce7;
  width: fit-content;
  letter-spacing: 0.2px;
}

.routing-key {
  font-size: 10px;
  color: #94a3b8;
  word-break: break-all;
  font-family: 'Monaco', 'Courier New', monospace;
  background: #f8fafc;
  padding: 4px 6px;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
}

/* Detail Panel */
.detail-panel {
  background: #ffffff;
  padding: 0;
  overflow-y: auto;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #dce3eb;
  background: #f8fafc;
  flex-shrink: 0;
  gap: 12px;
}

.detail-header > div {
  flex: 1;
}

.detail-header p {
  margin: 0 0 4px 0;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: #64748b;
}

.detail-header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
  word-break: break-word;
}

.pill {
  display: inline-block;
  padding: 4px 10px;
  background: #e6f2ff;
  color: #0969da;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.metadata-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px 16px;
  padding: 16px;
  border-bottom: 1px solid #dce3eb;
  font-size: 13px;
  flex-shrink: 0;
  overflow-y: auto;
  max-height: 200px;
}

.metadata-grid span {
  color: #64748b;
  font-weight: 600;
  text-align: right;
}

.metadata-grid strong {
  color: #0f172a;
  word-break: break-all;
}

.tab-bar {
  display: flex;
  gap: 0;
  padding: 0 16px;
  border-bottom: 1px solid #dce3eb;
  background: #f8fafc;
  flex-shrink: 0;
  overflow-x: auto;
}

.tab-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 16px;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 200ms ease;
  border-bottom: 3px solid transparent;
}

.tab-button:hover {
  color: #334155;
}

.tab-button.active {
  color: #0969da;
  border-bottom-color: #0969da;
  background: rgba(9, 105, 218, 0.05);
}

.body-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0 16px 16px 16px;
}

.body-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  flex-shrink: 0;
}

.section-title {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
}

.copy-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid #dce3eb;
  background: #ffffff;
  color: #334155;
  border-radius: 6px;
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  transition: all 160ms ease;
}

.copy-button:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.copy-button:active {
  transform: scale(0.97);
}

.body-section pre {
  flex: 1;
  overflow: auto;
  padding: 12px;
  background: #1e293b;
  color: #e2e8f0;
  border: 1px solid #334155;
  border-radius: 6px;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  margin: 0;
}

.body-section pre::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.body-section pre::-webkit-scrollbar-track {
  background: transparent;
}

.body-section pre::-webkit-scrollbar-thumb {
  background: #475569;
  border-radius: 3px;
}

.body-section pre::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}

.copy-toast {
  position: absolute;
  bottom: 16px;
  right: 16px;
  background: #0f172a;
  color: white;
  font-size: 12px;
  padding: 10px 14px;
  border-radius: 6px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
  z-index: 20;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Empty States */
.empty-detail {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 100%;
  color: #94a3b8;
  font-size: 13px;
}

/* Action Panel */
.action-panel {
  padding: 16px;
  background: #ffffff;
  overflow-y: auto;
}

.action-panel .field {
  margin-bottom: 14px;
}

.requeue-note {
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
  margin: 16px 0 0 0;
  padding-top: 16px;
  border-top: 1px solid #dce3eb;
}

.requeue-note code {
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 11px;
}

/* Responsive */
@media (max-width: 1200px) {
  .workspace {
    grid-template-columns: 250px 1fr 280px;
  }
}

@media (max-width: 768px) {
  .workspace {
    grid-template-columns: 1fr;
  }

  .messages-list,
  .detail-panel,
  .action-panel {
    border-right: none;
    display: none;
  }

  .messages-list.active {
    display: flex;
  }

  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .controls-grid {
    grid-template-columns: 1fr;
  }
}
</style>
