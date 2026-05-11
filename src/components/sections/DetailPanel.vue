<template>
  <main class="detail-panel">
    <template v-if="selectedMessage">
      <div class="detail-header">
        <div>
          <p class="eyebrow">Mensaje</p>
          <h2>{{ getMessageTitle(selectedMessage) }}</h2>
        </div>
        <span class="badge-pill">{{ selectedMessage.bodyEncoding }}</span>
      </div>

      <MetadataTable :items="metadataItems" />

      <TabBar v-model="activeTab" />

      <div class="code-viewer">
        <div class="code-toolbar">
          <span class="code-label">{{ getTabLabel(activeTab) }}</span>
          <CopyButton :content="getTabContent()" @copied="$emit('copied')" />
        </div>
        <CodeViewer :content="getTabContent()" />
      </div>
    </template>

    <div v-else class="empty-state">
      <Search :size="32" />
      <span>Selecciona un mensaje para ver detalles</span>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Search } from 'lucide-vue-next';
import { MetadataTable, TabBar, CopyButton, CodeViewer } from '../index';
import {
  formatJson,
  getMessageTitle,
  getDlqReason,
  getDeathCount,
  getArrivedTime,
  getOriginalExchange,
} from '../../utils';
import type { InspectedMessage } from '../../types';

interface Props {
  selectedMessage: InspectedMessage | null;
}

interface Emits {
  (e: 'copied'): void;
}

defineEmits<Emits>();

type TabType = 'body' | 'dlq' | 'headers' | 'properties' | 'raw';
const activeTab = ref<TabType>('body');

const tabLabels: Record<TabType, string> = {
  body: 'Message Body',
  dlq: 'DLQ Metadata',
  headers: 'Message Headers',
  properties: 'Message Properties',
  raw: 'Full Message',
};

const props = defineProps<Props>();

const metadataItems = computed(() => {
  if (!props.selectedMessage) return [];
  const m = props.selectedMessage;
  return [
    { label: 'Exchange actual', value: m.fields.exchange || 'default' },
    { label: 'Routing key', value: m.fields.routingKey },
    { label: 'Exchange original', value: getOriginalExchange(m) },
    { label: 'Routing keys originales', value: m.inferredOriginalRoutingKeys.join(', ') || '-' },
    { label: 'Redelivered', value: m.fields.redelivered ? 'Sí' : 'No' },
    { label: 'Veces enviado a DLQ', value: String(getDeathCount(m)) },
    { label: 'Motivo DLQ', value: getDlqReason(m) },
    { label: 'Llegada DLQ', value: getArrivedTime(m) },
  ];
});

function getTabLabel(tab: TabType): string {
  return tabLabels[tab];
}

function getTabContent(): string {
  if (!props.selectedMessage) return '';
  const m = props.selectedMessage;
  switch (activeTab.value) {
    case 'body':
      return formatJson(m.body);
    case 'dlq':
      return formatJson(m.metadata?.dlq);
    case 'headers':
      return formatJson(m.metadata?.headers);
    case 'properties':
      return formatJson(m.metadata?.properties);
    default:
      return formatJson(m);
  }
}
</script>

<style scoped>
.detail-panel {
  display: flex;
  flex-direction: column;
  background: var(--color-bg-primary);
  overflow-y: auto;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  gap: var(--spacing-md);
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

.code-viewer {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  padding: var(--spacing-md) var(--spacing-lg);
  gap: var(--spacing-sm);
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
  margin: var(--spacing-lg);
}

.empty-state svg {
  opacity: 0.5;
}

.empty-state span {
  font-size: var(--font-size-sm);
}
</style>
