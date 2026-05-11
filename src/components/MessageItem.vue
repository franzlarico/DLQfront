<template>
  <button
    class="message-item"
    :class="{ active: isActive }"
    type="button"
    @click="$emit('select')"
  >
    <div class="message-title">{{ messageTitle }}</div>
    <small>{{ bodyEncoding }} • {{ sizeBytes }} bytes</small>
    <small>{{ dlqReason }}</small>
    <small class="arrival-info">Llegada: {{ arrivedTime }}</small>
  </button>
</template>

<script setup lang="ts">
interface Props {
  messageTitle: string;
  bodyEncoding: string;
  sizeBytes: number;
  dlqReason: string;
  arrivedTime: string;
  isActive?: boolean;
}

interface Emits {
  (e: 'select'): void;
}

defineProps<Props>();
defineEmits<Emits>();
</script>

<style scoped>
.message-item {
  padding: var(--spacing-md) var(--spacing-lg);
  border: none;
  border-bottom: 1px solid var(--color-border-light);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: all var(--transition-fast);
  color: var(--color-text-primary);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  align-items: flex-start;
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
  word-break: break-word;
  white-space: pre-wrap;
  max-width: 100%;
}

.message-item small {
  display: block;
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  word-break: break-word;
  white-space: pre-wrap;
  max-width: 100%;
  line-height: 1.3;
}

.arrival-info {
  color: var(--color-warning) !important;
  font-style: italic;
  margin-top: var(--spacing-xs) !important;
  font-size: var(--font-size-xs) !important;
  font-weight: 500;
}
</style>
