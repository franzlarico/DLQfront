<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  useQueues,
  useMessages,
  useAutoRefresh,
  useRequeue,
  useClipboard,
} from '../composables';
import { useNacosConfig } from '../composables/useNacosConfig';
import { rabbitService } from '../services';
import { clampInteger } from '../utils';
import type { RabbitConfig, QueueListItem } from '../types';
import {
  InspectorHeader,
  ControlsPanel,
  QueuesSection,
  MessagesPanel,
  DetailPanel,
  RequeuePanel,
} from '../components/sections';
import AlertBoxComponent from '../components/AlertBox.vue';

const INSPECT_LIMIT_MIN = 1;
const INSPECT_LIMIT_MAX = 100;
const REQUEUE_LIMIT_MIN = 1;
const REQUEUE_LIMIT_MAX = 100;

// State
const inspectLimit = ref(5);
const requeueLimit = ref(1);
const targetExchange = ref('');
const targetRoutingKey = ref('');
const config = ref<RabbitConfig | null>(null);
const error = ref('');
const syncingQueues = ref(false);

// Composables
const queues = useQueues({ autoSelect: true });
const queueDiscoveryError = computed(() => queues.error.value);
const messages = useMessages();
const { autoRefresh, setAutoRefresh, cleanup: cleanupAutoRefresh } = useAutoRefresh({
  onRefresh: syncDetectedQueues,
});
const requeue = useRequeue({
  onSuccess: () => void syncDetectedQueues(),
});
const clipboard = useClipboard();

// Computed properties
const isBusy = computed(
  () =>
    messages.loading.value ||
    queues.loadingQueues.value ||
    requeue.requeueing.value ||
    syncingQueues.value
);

const showQueueDiscoveryError = computed(
  () => queueDiscoveryError.value.length > 0 && error.value.length === 0
);

// Methods
async function loadConfig(): Promise<void> {
  try {
    config.value = await rabbitService.getConfig();
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  }
}

const { currentConfig } = useNacosConfig();
watch(
  () => currentConfig.value,
  (next) => {
    if (next) {
      config.value = next;
      void syncDetectedQueues();
    }
  },
);

async function syncDetectedQueues(): Promise<void> {
  if (syncingQueues.value || messages.loading.value) return;

  syncingQueues.value = true;
  try {
    await queues.loadQueues();
    if (!queues.trimmedQueueName.value) {
      messages.clearSelection();
      return;
    }
    await refresh();
  } finally {
    syncingQueues.value = false;
  }
}

async function refresh(): Promise<void> {
  inspectLimit.value = clampInteger(inspectLimit.value, INSPECT_LIMIT_MIN, INSPECT_LIMIT_MAX, 5);
  if (!queues.trimmedQueueName.value) {
    error.value = 'Selecciona una cola DLQ.';
    return;
  }
  error.value = '';
  await messages.loadMessages(queues.trimmedQueueName.value, inspectLimit.value);
}

async function selectQueue(queue: QueueListItem): Promise<void> {
  queues.selectQueue(queue);
  messages.clearSelection();
  await refresh();
}

async function handleRequeue(): Promise<void> {
  const result = await requeue.requeue(queues.trimmedQueueName.value, {
    limit: requeueLimit.value,
    targetExchange: targetExchange.value.trim() || undefined,
    targetRoutingKey: targetRoutingKey.value.trim() || undefined,
  });

  if (result) {
    targetExchange.value = '';
    targetRoutingKey.value = '';
  }
}

// Watchers
watch(
  () => autoRefresh.value,
  (enabled) => {
    setAutoRefresh(enabled);
  }
);

watch(
  () => inspectLimit.value,
  (value) => {
    inspectLimit.value = clampInteger(value, INSPECT_LIMIT_MIN, INSPECT_LIMIT_MAX, 5);
  }
);

watch(
  () => requeueLimit.value,
  (value) => {
    requeueLimit.value = clampInteger(value, REQUEUE_LIMIT_MIN, REQUEUE_LIMIT_MAX, 1);
  }
);

watch(
  () => queues.trimmedQueueName.value,
  (nextQueue, previousQueue) => {
    if (nextQueue === previousQueue) return;
    targetExchange.value = '';
    targetRoutingKey.value = '';
  }
);

// Lifecycle
onMounted(async () => {
  await loadConfig();
  await syncDetectedQueues();
});

onBeforeUnmount(() => {
  cleanupAutoRefresh();
  requeue.cleanup();
  clipboard.cleanup();
});
</script>

<template>
  <div class="inspector-shell">
    <!-- Header -->
    <InspectorHeader
      :queue-name="queues.trimmedQueueName.value"
      :loading="messages.loading.value"
      :syncing="syncingQueues"
      :disabled="isBusy"
      @inspect="refresh"
      @sync="syncDetectedQueues"
    />

    <!-- Alerts -->
    <AlertBoxComponent v-if="error" :model-value="error" variant="danger" title="Error" />
    <AlertBoxComponent
      v-if="showQueueDiscoveryError"
      :model-value="queueDiscoveryError"
      variant="warning"
      title="Advertencia"
    />
    <AlertBoxComponent
      v-if="requeue.successMessage.value"
      :model-value="requeue.successMessage.value"
      variant="success"
      title="Éxito"
    />

    <!-- Controls Panel -->
    <ControlsPanel
      :inspect-limit="inspectLimit"
      :auto-refresh="autoRefresh"
      :queue-name="queues.trimmedQueueName.value"
      @update:inspect-limit="inspectLimit = $event"
      @update:auto-refresh="setAutoRefresh($event)"
    />

    <!-- Queues Discovery -->
    <QueuesSection
      :queues="queues.dlqQueues.value"
      :active-queue-name="queues.trimmedQueueName.value"
      :loading="queues.loadingQueues.value"
      @select-queue="selectQueue"
    />

    <!-- Main Content -->
    <section class="content-section">
      <MessagesPanel
        :messages="messages.messages.value"
        :active-message-id="messages.activeMessageId.value"
        @select-message="messages.selectMessage"
      />

      <DetailPanel
        :selected-message="messages.selectedMessage.value"
        @copied="() => {}"
      />

      <RequeuePanel
        :limit="requeueLimit"
        :target-exchange="targetExchange"
        :target-routing-key="targetRoutingKey"
        :queue-name="queues.trimmedQueueName.value"
        :loading="requeue.requeueing.value"
        :disabled="isBusy"
        :inferred-exchange="messages.selectedMessage.value?.inferredOriginalExchange"
        :inferred-routing-key="messages.selectedMessage.value?.inferredOriginalRoutingKeys[0]"
        @update:limit="requeueLimit = $event"
        @update:target-exchange="targetExchange = $event"
        @update:target-routing-key="targetRoutingKey = $event"
        @requeue="handleRequeue"
      />
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

  :deep(.messages-panel),
  :deep(.requeue-panel) {
    display: none;
  }
}

@media (max-width: 768px) {
  .content-section {
    grid-template-columns: 1fr;
  }
}
</style>
