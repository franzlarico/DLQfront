<template>
  <div v-if="modelValue" :class="['alert', variant]">
    <component :is="icon" :size="20" />
    <div>
      <strong>{{ title }}</strong>
      <p>{{ modelValue }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { AlertCircle, CheckCircle2 } from 'lucide-vue-next';

type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

interface Props {
  modelValue: string;
  variant?: AlertVariant;
  title?: string;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'info',
  title: 'Información',
});

const icon = computed(() => {
  return props.variant === 'success' ? CheckCircle2 : AlertCircle;
});
</script>

<style scoped>
.alert {
  display: flex;
  gap: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-xl);
  margin: 0;
  font-size: var(--font-size-sm);
  align-items: center;
  border-radius: 10px;
  border-left: 4px solid;
}

.alert.info {
  background-color: var(--color-info-light);
  border-left-color: var(--color-info);
  color: var(--color-info);
}

.alert.warning {
  background-color: var(--color-warning-light);
  border-left-color: var(--color-warning);
  color: var(--color-warning);
}

.alert.success {
  background-color: var(--color-success-light);
  border-left-color: var(--color-success);
  color: var(--color-success);
}

.alert.danger {
  background-color: var(--color-danger-light);
  border-left-color: var(--color-danger);
  color: var(--color-danger);
}

.alert strong {
  display: block;
  font-weight: 600;
  margin-bottom: 2px;
}

.alert p {
  margin: 0;
  color: inherit;
}
</style>
