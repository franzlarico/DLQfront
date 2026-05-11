<template>
  <section class="queues-section">
    <div class="section-header">
      <div>
        <h3>Colas Detectadas</h3>
        <span class="badge">{{ dlqQueues.length }} activa(s) • {{ totalMessages }} mensajes</span>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <Loader2 class="spin" :size="24" />
      <span>Buscando colas...</span>
    </div>

    <div v-else-if="dlqQueues.length === 0" class="empty-state">
      <Database :size="32" />
      <span>Sin colas muertas con mensajes</span>
    </div>

    <div v-else class="queues-grid">
      <QueueCard
        v-for="queue in dlqQueues"
        :key="queue.name"
        :queue="queue"
        :is-active="activeQueueName === queue.name"
        @select="$emit('select-queue', queue)"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Loader2, Database } from 'lucide-vue-next';
import { QueueCard } from '../index';
import type { QueueListItem } from '../../types';

interface Props {
  queues: QueueListItem[];
  activeQueueName: string;
  loading?: boolean;
}

interface Emits {
  (e: 'select-queue', queue: QueueListItem): void;
}

const props = defineProps<Props>();
defineEmits<Emits>();

const dlqQueues = computed(() =>
  props.queues.filter((queue) => queue.isDlq && queue.messageCount > 0)
);

const totalMessages = computed(() =>
  dlqQueues.value.reduce((t, q) => t + q.messageCount, 0)
);
</script>

<style scoped>
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

.loading-state svg,
.empty-state svg {
  opacity: 0.5;
}

.loading-state span,
.empty-state span {
  font-size: var(--font-size-sm);
}

@media (max-width: 768px) {
  .queues-grid {
    grid-template-columns: 1fr;
  }
}
</style>
