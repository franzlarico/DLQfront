<template>
  <div class="tabs">
    <button
      v-for="tab in tabs"
      :key="tab"
      class="tab"
      :class="{ active: modelValue === tab }"
      type="button"
      @click="$emit('update:modelValue', tab)"
    >
      <component :is="getTabIcon(tab)" :size="16" />
      {{ getTabLabel(tab) }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { FileJson, ListChecks, Rows3, ShieldCheck, Braces } from 'lucide-vue-next';

type TabType = 'body' | 'dlq' | 'headers' | 'properties' | 'raw';

interface Props {
  modelValue: TabType;
  tabs?: TabType[];
}

interface Emits {
  (e: 'update:modelValue', value: TabType): void;
}

withDefaults(defineProps<Props>(), {
  tabs: () => ['body', 'dlq', 'headers', 'properties', 'raw'],
});

defineEmits<Emits>();

const tabLabels: Record<TabType, string> = {
  body: 'Body',
  dlq: 'DLQ Metadata',
  headers: 'Headers',
  properties: 'Properties',
  raw: 'Raw',
};

const tabIcons: Record<TabType, any> = {
  body: FileJson,
  dlq: ListChecks,
  headers: Rows3,
  properties: ShieldCheck,
  raw: Braces,
};

function getTabLabel(tab: TabType): string {
  return tabLabels[tab];
}

function getTabIcon(tab: TabType): any {
  return tabIcons[tab];
}
</script>

<style scoped>
.tabs {
  display: flex;
  gap: 0;
  padding: 0 var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  overflow-x: auto;
  flex-shrink: 0;
}

.tab {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: transparent;
  border: none;
  border-bottom: 3px solid transparent;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.tab:hover {
  color: var(--color-text-primary);
}

.tab.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}
</style>
