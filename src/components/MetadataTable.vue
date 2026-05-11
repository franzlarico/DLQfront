<template>
  <div class="metadata-table">
    <div v-for="row in items" :key="row.label" class="metadata-row">
      <span class="label">{{ row.label }}</span>
      <span class="value">{{ row.value }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
interface MetadataItem {
  label: string;
  value: string;
}

interface Props {
  items: MetadataItem[];
}

defineProps<Props>();
</script>

<style scoped>
.metadata-table {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
  font-size: var(--font-size-sm);
  max-height: 220px;
  overflow-y: auto;
}

.metadata-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.metadata-row .label {
  font-weight: 600;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.metadata-row .value {
  color: var(--color-text-primary);
  word-break: break-word;
  font-family: monospace;
  font-size: var(--font-size-xs);
  background: var(--color-bg-tertiary);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: 4px;
}
</style>
