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
  BarChart3,
} from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { rabbitApi } from '../api/rabbit';
import type { InspectedMessage, QueueInfo, QueueListItem, RabbitConfig } from '../types';

const REQUEUE_LIMIT_MIN = 1;
const REQUEUE_LIMIT_MAX = 100;

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
const error = ref('');
const lastUpdated = ref('');
let refreshTimer: number | undefined;

// defineEmits is used implicitly by $emit() in template
const _emit = defineEmits<{
  'view-dashboard': [];
}>();
// @ts-expect-error emit is used via $emit in the template
const emit = _emit;

const hasMessages = computed(() => messages.value.length > 0);
const dlqQueues = computed(() => queues.value.filter((q) => q.isDlq && q.messageCount > 0));
const selectedMessage = computed(
  () => messages.value.find((message) => message.id === activeMessageId.value) ?? null,
);
const statusTone = computed(() => {
  if (error.value) return 'danger';
  if (queueInfo.value && queueInfo.value.messageCount > 0) return 'warning';
  return 'ok';
});
const apiLabel = computed(() => rabbitApi.apiBaseUrl);

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function shortDate(value: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}

function messageTitle(message: InspectedMessage): string {
  const messageId = message.properties?.messageId;
  return typeof messageId === 'string' && messageId.length > 0 ? messageId : message.id;
}

function dlqReason(message: InspectedMessage): string {
  return message.metadata?.dlq?.latestReason ?? 'desconocido';
}

function deathCount(message: InspectedMessage): number {
  return message.metadata?.dlq?.deathCount ?? 0;
}

function resetActiveTab(): void {
  activeDetailTab.value = 'body';
}

async function loadConfig(): Promise<void> {
  try {
    config.value = await rabbitApi.getConfig();
  } catch (err) {
    console.error('Error loading config:', err);
  }
}

async function loadQueues(): Promise<void> {
  loadingQueues.value = true;
  error.value = '';

  try {
    queues.value = await rabbitApi.listQueues();
    const dlqWithMessages = dlqQueues.value[0];
    if (dlqWithMessages && !queueName.value) {
      queueName.value = dlqWithMessages.name;
      await refresh();
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    loadingQueues.value = false;
  }
}

async function selectQueue(queue: QueueListItem): Promise<void> {
  queueName.value = queue.name;
  messages.value = [];
  activeMessageId.value = null;
  await refresh();
}

async function refresh(): Promise<void> {
  if (!queueName.value.trim()) {
    error.value = 'Selecciona una cola DLQ.';
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    const queue = queueName.value.trim();
    const [info, inspected] = await Promise.all([
      rabbitApi.getQueueInfo(queue),
      rabbitApi.getMessages(queue, inspectLimit.value),
    ]);

    queueInfo.value = info;
    messages.value = inspected;
    activeMessageId.value = inspected[0]?.id ?? null;
    resetActiveTab();
    lastUpdated.value = new Date().toISOString();
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
    messages.value = [];
  } finally {
    loading.value = false;
  }
}

async function requeue(): Promise<void> {
  if (!queueName.value.trim()) {
    error.value = 'Selecciona una cola DLQ.';
    return;
  }

  requeueing.value = true;
  error.value = '';

  try {
    await rabbitApi.requeue(queueName.value.trim(), {
      limit: requeueLimit.value,
      targetExchange: targetExchange.value.trim() || undefined,
      targetRoutingKey:
        targetRoutingKey.value.trim() && targetRoutingKey.value.trim() !== 'inferido por x-death'
          ? targetRoutingKey.value.trim()
          : undefined,
    });
    await refresh();
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    requeueing.value = false;
  }
}

function startAutoRefresh(): void {
  stopAutoRefresh();
  refreshTimer = window.setInterval(() => {
    void refresh();
  }, 8000);
}

function stopAutoRefresh(): void {
  if (refreshTimer) {
    window.clearInterval(refreshTimer);
    refreshTimer = undefined;
  }
}

watch(autoRefresh, (enabled) => {
  if (enabled) {
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
});

onMounted(async () => {
  await loadConfig();
  await loadQueues();
});

onBeforeUnmount(stopAutoRefresh);
</script>

<template>
  <main class="app-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">RabbitMQ</p>
        <h1>Inspector de DLQ</h1>
      </div>
      <div class="topbar-actions">
        <button class="nav-button" type="button" @click="$emit('view-dashboard')" title="Ver observabilidad">
          <BarChart3 :size="18" />
          <span>Observabilidad</span>
        </button>
        <div class="connection" :class="statusTone">
          <CheckCircle2 v-if="statusTone === 'ok'" :size="18" />
          <AlertCircle v-else :size="18" />
          <span>{{ error ? 'Atención' : 'Conectado' }}</span>
        </div>
      </div>
    </header>

    <section class="controls">
      <div class="queues-discovery">
        <div class="discovery-header">
          <p class="eyebrow">Colas Detectadas</p>
          <button
            class="icon-button"
            type="button"
            :disabled="loadingQueues"
            title="Recargar colas"
            @click="loadQueues"
          >
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
          <button
            v-for="queue in dlqQueues"
            :key="queue.name"
            class="queue-card"
            :class="{ active: queueName === queue.name }"
            type="button"
            @click="selectQueue(queue)"
          >
            <div class="queue-info">
              <strong>{{ queue.name }}</strong>
              <small>{{ queue.messageCount }} mensajes</small>
            </div>
            <div class="queue-badge">
              <AlertCircle v-if="queue.isDlq" :size="18" />
            </div>
          </button>
        </div>
      </div>
    </section>

    <section v-if="error" class="alert">
      <AlertCircle :size="20" />
      <span>{{ error }}</span>
      <small>API: {{ apiLabel }}</small>
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
          <button class="icon-button" type="button" :disabled="loading" title="Actualizar" @click="refresh">
            <RefreshCcw :size="18" />
          </button>
        </div>

        <div v-if="!hasMessages" class="empty-state">
          <Database :size="24" />
          <span>Sin mensajes</span>
        </div>

        <button
          v-for="message in messages"
          :key="message.id"
          class="message-row"
          :class="{ active: activeMessageId === message.id }"
          type="button"
          @click="activeMessageId = message.id"
        >
          <span class="message-main">
            <strong>{{ messageTitle(message) }}</strong>
            <small>{{ message.bodyEncoding }} / {{ message.sizeBytes }} bytes</small>
            <small>{{ dlqReason(message) }} / x-death {{ deathCount(message) }}</small>
          </span>
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
            <span>Exchange</span>
            <strong>{{ selectedMessage.fields.exchange || 'default' }}</strong>
            <span>Routing key</span>
            <strong>{{ selectedMessage.fields.routingKey }}</strong>
            <span>Redelivered</span>
            <strong>{{ selectedMessage.fields.redelivered ? 'Sí' : 'No' }}</strong>
            <span>Original</span>
            <strong>{{ selectedMessage.inferredOriginalRoutingKeys.join(', ') || '-' }}</strong>
            <span>Motivo DLQ</span>
            <strong>{{ selectedMessage.metadata?.dlq?.latestReason || '-' }}</strong>
            <span>Veces DLQ</span>
            <strong>{{ selectedMessage.metadata?.dlq?.deathCount || 0 }}</strong>
            <span>Cola origen</span>
            <strong>{{ selectedMessage.metadata?.dlq?.latestQueue || selectedMessage.metadata?.sourceQueue || '-' }}</strong>
          </div>

          <div class="tab-bar">
            <button
              class="tab-button"
              :class="{ active: activeDetailTab === 'body' }"
              type="button"
              @click="activeDetailTab = 'body'"
            >
              <FileJson :size="16" />
              Body
            </button>
            <button
              class="tab-button"
              :class="{ active: activeDetailTab === 'dlq' }"
              type="button"
              @click="activeDetailTab = 'dlq'"
            >
              <ListChecks :size="16" />
              DLQ
            </button>
            <button
              class="tab-button"
              :class="{ active: activeDetailTab === 'headers' }"
              type="button"
              @click="activeDetailTab = 'headers'"
            >
              <Rows3 :size="16" />
              Headers
            </button>
            <button
              class="tab-button"
              :class="{ active: activeDetailTab === 'properties' }"
              type="button"
              @click="activeDetailTab = 'properties'"
            >
              <ShieldCheck :size="16" />
              Properties
            </button>
            <button
              class="tab-button"
              :class="{ active: activeDetailTab === 'raw' }"
              type="button"
              @click="activeDetailTab = 'raw'"
            >
              <Braces :size="16" />
              Raw
            </button>
          </div>

          <div class="body-section">
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
            <pre v-if="activeDetailTab === 'body'">{{ formatJson(selectedMessage.body) }}</pre>
            <pre v-else-if="activeDetailTab === 'dlq'">{{ formatJson(selectedMessage.metadata?.dlq) }}</pre>
            <pre v-else-if="activeDetailTab === 'headers'">{{ formatJson(selectedMessage.metadata?.headers) }}</pre>
            <pre v-else-if="activeDetailTab === 'properties'">{{ formatJson(selectedMessage.metadata?.properties) }}</pre>
            <pre v-else>{{ formatJson(selectedMessage) }}</pre>
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
          <input
            v-model="targetExchange"
            type="text"
            :placeholder="selectedMessage?.inferredOriginalExchange || 'inferido de x-death'"
          />
          <small v-if="selectedMessage?.inferredOriginalExchange">
            📋 Detectado: {{ selectedMessage.inferredOriginalExchange }}
          </small>
        </label>

        <label class="field">
          <span>Routing key destino</span>
          <input
            v-model="targetRoutingKey"
            type="text"
            :placeholder="selectedMessage?.inferredOriginalRoutingKeys[0] || 'inferido de x-death'"
          />
          <small v-if="selectedMessage?.inferredOriginalRoutingKeys[0]">
            📋 Detectado: {{ selectedMessage.inferredOriginalRoutingKeys[0] }}
          </small>
        </label>

        <button class="danger" type="button" :disabled="requeueing || loading" @click="requeue">
          <Loader2 v-if="requeueing" class="spin" :size="18" />
          <Repeat2 v-else :size="18" />
          <span>Reencolar</span>
        </button>
      </aside>
    </section>
  </main>
</template>
