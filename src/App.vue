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
} from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { rabbitApi } from './api/rabbit';
import type { InspectedMessage, QueueInfo, RabbitConfig, RequeueResult } from './types';

const queueName = ref('app.dlq');
const inspectLimit = ref(5);
const requeueLimit = ref(1);
const targetExchange = ref('');
const targetRoutingKey = ref('');
const autoRefresh = ref(false);
const activeDetailTab = ref<'body' | 'dlq' | 'headers' | 'properties' | 'raw'>('body');

const config = ref<RabbitConfig | null>(null);
const queueInfo = ref<QueueInfo | null>(null);
const messages = ref<InspectedMessage[]>([]);
const lastResult = ref<RequeueResult | null>(null);
const activeMessageId = ref<string | null>(null);
const loading = ref(false);
const requeueing = ref(false);
const error = ref('');
const lastUpdated = ref('');
let refreshTimer: number | undefined;

const hasMessages = computed(() => messages.value.length > 0);
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
  return new Intl.DateTimeFormat('es-BO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}

function messageTitle(message: InspectedMessage): string {
  const messageId = message.properties.messageId;
  return typeof messageId === 'string' && messageId.length > 0 ? messageId : message.id;
}

function dlqReason(message: InspectedMessage): string {
  return message.metadata?.dlq?.latestReason ?? 'sin razon';
}

function deathCount(message: InspectedMessage): number {
  return message.metadata?.dlq?.deathCount ?? 0;
}

function resetActiveTab(): void {
  activeDetailTab.value = 'body';
}

async function loadConfig(): Promise<void> {
  config.value = await rabbitApi.getConfig();
  if (config.value.defaultDlq) {
    queueName.value = config.value.defaultDlq;
  }
}

async function refresh(): Promise<void> {
  if (!queueName.value.trim()) {
    error.value = 'Ingresa una cola DLQ.';
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
  } finally {
    loading.value = false;
  }
}

async function requeue(): Promise<void> {
  if (!queueName.value.trim()) {
    error.value = 'Ingresa una cola DLQ.';
    return;
  }

  requeueing.value = true;
  error.value = '';
  lastResult.value = null;

  try {
    lastResult.value = await rabbitApi.requeue(queueName.value.trim(), {
      limit: requeueLimit.value,
      targetExchange: targetExchange.value.trim() || undefined,
      targetRoutingKey: (targetRoutingKey.value.trim() && targetRoutingKey.value.trim() !== 'inferido por x-death') ? targetRoutingKey.value.trim() : undefined,
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
  try {
    await loadConfig();
  } catch {
    config.value = null;
  }

  await refresh();
});

onBeforeUnmount(stopAutoRefresh);
</script>

<template>
  <main class="app-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">RabbitMQ</p>
        <h1>DLQ Console</h1>
      </div>
      <div class="connection" :class="statusTone">
        <CheckCircle2 v-if="statusTone === 'ok'" :size="18" />
        <AlertCircle v-else :size="18" />
        <span>{{ error ? 'Atencion' : 'Conectado' }}</span>
      </div>
    </header>

    <section class="controls">
      <label class="field queue-field">
        <span>Cola DLQ</span>
        <div class="input-icon">
          <Database :size="18" />
          <input v-model="queueName" type="text" placeholder="app.dlq" />
        </div>
      </label>

      <label class="field compact">
        <span>Lectura</span>
        <input v-model.number="inspectLimit" type="number" min="1" max="100" />
      </label>

      <button class="primary" type="button" :disabled="loading" @click="refresh">
        <Loader2 v-if="loading" class="spin" :size="18" />
        <Search v-else :size="18" />
        <span>Inspeccionar</span>
      </button>

      <label class="switch">
        <input v-model="autoRefresh" type="checkbox" />
        <span></span>
        Auto
      </label>
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
          <span>Sin mensajes visibles</span>
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
            <strong>{{ selectedMessage.fields.redelivered ? 'Si' : 'No' }}</strong>
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
          <input v-model.number="requeueLimit" type="number" min="1" max="100" />
        </label>

        <label class="field">
          <span>Exchange destino</span>
          <input v-model="targetExchange" type="text" placeholder="default" />
        </label>

        <label class="field">
          <span>Routing key destino</span>
          <input v-model="targetRoutingKey" type="text" placeholder="inferido por x-death" />
        </label>

        <button class="danger" type="button" :disabled="requeueing || loading" @click="requeue">
          <Loader2 v-if="requeueing" class="spin" :size="18" />
          <Repeat2 v-else :size="18" />
          <span>Reencolar</span>
        </button>

        <div v-if="lastResult" class="result-box">
          <strong>{{ lastResult.requeued }} reencolado(s)</strong>
          <span>{{ lastResult.sourceQueue }} -> {{ lastResult.targetRoutingKey || 'routing inferido' }}</span>
          <span v-if="lastResult.targetRoutingKeys.length">Keys: {{ lastResult.targetRoutingKeys.join(', ') }}</span>
        </div>
      </aside>
    </section>
  </main>
</template>
