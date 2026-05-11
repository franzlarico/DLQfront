<template>
  <section class="controls-panel">
    <div class="control-grid">
      <div class="control-item">
        <label>
          <span class="label-text">Límite de inspección</span>
          <input
            :value="inspectLimit"
            type="number"
            :min="limitMin"
            :max="limitMax"
            @input="$emit('update:inspectLimit', Number(($event.target as HTMLInputElement).value))"
          />
        </label>
        <small>Máximo de mensajes a mostrar ({{ limitMin }}-{{ limitMax }})</small>
      </div>

      <div class="control-item">
        <label class="switch-label">
          <span class="label-text">Auto-actualizar</span>
          <input
            :checked="autoRefresh"
            type="checkbox"
            @change="$emit('update:autoRefresh', ($event.target as HTMLInputElement).checked)"
          />
          <span class="switch-toggle"></span>
        </label>
        <small>Cada 8 segundos</small>
      </div>

      <div class="control-item full">
        <span class="label-text">Cola activa</span>
        <div class="queue-display">
          {{ queueName || 'Selecciona una cola...' }}
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
interface Props {
  inspectLimit: number;
  autoRefresh: boolean;
  queueName: string;
  limitMin?: number;
  limitMax?: number;
}

interface Emits {
  (e: 'update:inspectLimit', value: number): void;
  (e: 'update:autoRefresh', value: boolean): void;
}

withDefaults(defineProps<Props>(), {
  limitMin: 1,
  limitMax: 100,
});

defineEmits<Emits>();
</script>

<style scoped>
.controls-panel {
  padding: var(--spacing-lg) var(--spacing-2xl);
  background: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-border);
}

.control-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: var(--spacing-lg);
}

.control-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.control-item.full {
  grid-column: 1 / -1;
}

.label-text {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-primary);
  display: block;
  margin-bottom: var(--spacing-xs);
}

.control-item input[type='number'] {
  padding: var(--spacing-md) var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
}

.control-item input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-lighter);
}

.switch-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  cursor: pointer;
}

.switch-toggle {
  width: 44px;
  height: 24px;
  background: var(--color-border);
  border-radius: 12px;
  position: relative;
  transition: all var(--transition-fast);
}

.switch-label input[type='checkbox'] {
  display: none;
}

.switch-label input:checked ~ .switch-toggle {
  background: var(--color-primary);
}

.switch-label input:checked ~ .switch-toggle::after {
  transform: translateX(20px);
}

.switch-toggle::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
  transition: transform var(--transition-fast);
  box-shadow: var(--shadow-sm);
}

.queue-display {
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-bg-tertiary);
  border-radius: 6px;
  border: 1px solid var(--color-border);
  font-weight: 500;
  color: var(--color-text-primary);
  word-break: break-all;
}

.control-item small {
  margin-top: 0;
}

@media (max-width: 768px) {
  .control-grid {
    grid-template-columns: 1fr;
  }
}
</style>
