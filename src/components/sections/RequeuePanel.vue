<template>
  <aside class="requeue-panel">
    <div class="panel-header">
      <h3>Reencolar</h3>
      <Repeat2 :size="20" />
    </div>

    <div class="form-group">
      <label>
        <span class="label-text">Cantidad</span>
        <input
          :value="limit"
          type="number"
          :min="limitMin"
          :max="limitMax"
          @input="$emit('update:limit', Number(($event.target as HTMLInputElement).value))"
        />
      </label>
      <small>{{ limitMin }}-{{ limitMax }} mensajes</small>
    </div>

    <div class="form-group">
      <label>
        <span class="label-text">Exchange destino</span>
        <input
          :value="targetExchange"
          type="text"
          :placeholder="inferredExchange || 'Inferido automáticamente'"
          @input="$emit('update:targetExchange', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <small v-if="inferredExchange" class="hint">
        Detectado: <strong>{{ inferredExchange }}</strong>
      </small>
    </div>

    <div class="form-group">
      <label>
        <span class="label-text">Routing key destino</span>
        <input
          :value="targetRoutingKey"
          type="text"
          :placeholder="inferredRoutingKey || 'Inferido automáticamente'"
          @input="$emit('update:targetRoutingKey', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <small v-if="inferredRoutingKey" class="hint">
        Detectado: <strong>{{ inferredRoutingKey }}</strong>
      </small>
    </div>

    <button
      class="primary full"
      type="button"
      :disabled="disabled || loading || !queueName"
      @click="$emit('requeue')"
    >
      <Loader2 v-if="loading" class="spin" :size="18" />
      <Repeat2 v-else :size="18" />
      <span>Reencolar Ahora</span>
    </button>

    <div class="info-box">
      <p>
        Si falla el reencolado, el mensaje <strong>NO será eliminado</strong> de la DLQ y podrás
        reintentar.
      </p>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { Loader2, Repeat2 } from 'lucide-vue-next';

interface Props {
  limit: number;
  targetExchange: string;
  targetRoutingKey: string;
  queueName: string;
  loading?: boolean;
  disabled?: boolean;
  inferredExchange?: string;
  inferredRoutingKey?: string;
  limitMin?: number;
  limitMax?: number;
}

interface Emits {
  (e: 'update:limit', value: number): void;
  (e: 'update:targetExchange', value: string): void;
  (e: 'update:targetRoutingKey', value: string): void;
  (e: 'requeue'): void;
}

withDefaults(defineProps<Props>(), {
  limitMin: 1,
  limitMax: 100,
});

defineEmits<Emits>();
</script>

<style scoped>
.requeue-panel {
  display: flex;
  flex-direction: column;
  background: var(--color-bg-primary);
  border-right: none;
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

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--color-border-light);
}

.form-group:last-of-type {
  border-bottom: none;
}

.form-group label {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.form-group input {
  padding: var(--spacing-md) var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
}

.form-group input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-lighter);
}

.label-text {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-primary);
}

.form-group small {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.hint {
  color: var(--color-primary) !important;
}

.primary.full {
  grid-column: 1 / -1;
  margin: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-lg);
  border: none;
  background: var(--color-primary);
  color: white;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
}

.primary.full:hover:not(:disabled) {
  background: var(--color-primary-dark, #0d5a52);
}

.primary.full:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.info-box {
  padding: var(--spacing-lg);
  background: var(--color-info-light);
  border-left: 3px solid var(--color-info);
  border-radius: 4px;
  margin: var(--spacing-lg);
}

.info-box p {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-info);
}
</style>
