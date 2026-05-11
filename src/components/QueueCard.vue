<template>
  <div class="queue-card card" :class="{ active: isActive }" type="button" @click="emit('select')">
    <div class="queue-header">
      <strong>{{ queue.name }}</strong>
      <span class="count-badge">{{ queue.messageCount }}</span>
    </div>
    <small>Lista para inspección</small>
  </div>
</template>

<script setup lang="ts">
import type { QueueListItem } from '../types';

interface Props {
  queue: QueueListItem;
  isActive?: boolean;
}

interface Emits {
  (e: 'select'): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();
</script>

<style scoped>
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
</style>
