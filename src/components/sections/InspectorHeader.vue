<template>
  <header class="inspector-header">
    <div class="header-content">
      <div>
        <p class="eyebrow">RabbitMQ</p>
        <h1>Inspector de Colas Muertas</h1>
      </div>
      <div class="header-actions">
        <button
          class="primary"
          type="button"
          :disabled="disabled || !queueName"
          @click="$emit('inspect')"
          title="Inspeccionar cola actual"
        >
          <Loader2 v-if="loading" class="spin" :size="18" />
          <RefreshCcw v-else :size="18" />
          <span>Inspeccionar</span>
        </button>
        <button
          class="icon-button"
          type="button"
          :disabled="disabled"
          title="Sincronizar colas"
          @click="$emit('sync')"
        >
          <Loader2 v-if="syncing" class="spin" :size="18" />
          <RefreshCcw v-else :size="18" />
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { Loader2, RefreshCcw } from 'lucide-vue-next';

interface Props {
  queueName: string;
  loading?: boolean;
  syncing?: boolean;
  disabled?: boolean;
}

interface Emits {
  (e: 'inspect'): void;
  (e: 'sync'): void;
}

defineProps<Props>();
defineEmits<Emits>();
</script>

<style scoped>
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
</style>
