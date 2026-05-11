<template>
  <aside class="messages-panel">
    <div class="panel-header">
      <h3>Mensajes</h3>
      <span v-if="hasMessages" class="count">{{ messageCount }}</span>
    </div>

    <div v-if="!hasMessages" class="empty-state compact">
      <Database :size="28" />
      <span>Sin mensajes</span>
    </div>

    <div v-else class="messages-list">
      <MessageItem
        v-for="message in messages"
        :key="message.id"
        :message-title="getMessageTitle(message)"
        :body-encoding="message.bodyEncoding"
        :size-bytes="message.sizeBytes"
        :dlq-reason="getDlqReason(message)"
        :arrived-time="getArrivedTime(message)"
        :is-active="activeMessageId === message.id"
        @select="$emit('select-message', message.id)"
      />
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Database } from 'lucide-vue-next';
import { MessageItem } from '../index';
import { getMessageTitle, getDlqReason, getArrivedTime } from '../../utils';
import type { InspectedMessage } from '../../types';

interface Props {
  messages: InspectedMessage[];
  activeMessageId: string | null;
}

interface Emits {
  (e: 'select-message', messageId: string): void;
}

const props = defineProps<Props>();
defineEmits<Emits>();

const hasMessages = computed(() => props.messages.length > 0);
const messageCount = computed(() => props.messages.length);
</script>

<style scoped>
.messages-panel {
  display: flex;
  flex-direction: column;
  background: var(--color-bg-primary);
  border-right: 1px solid var(--color-border);
  overflow: hidden;
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

.messages-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.empty-state.compact {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-lg);
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

.count {
  background: var(--color-primary-lighter);
  color: var(--color-primary);
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: 4px;
  font-size: var(--font-size-xs);
  font-weight: 600;
}
</style>
