<template>
  <button class="copy-btn" type="button" @click="handleClick">
    <Check v-if="copied" :size="14" />
    <Copy v-else :size="14" />
    <span>{{ copied ? 'Copiado' : 'Copiar' }}</span>
  </button>
</template>

<script setup lang="ts">
import { onBeforeUnmount } from 'vue';
import { Copy, Check } from 'lucide-vue-next';
import { useClipboard } from '../composables';

interface Props {
  content: string;
}

interface Emits {
  (e: 'copied'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { copied, copyToClipboard, cleanup } = useClipboard();

async function handleClick(): Promise<void> {
  try {
    await copyToClipboard(props.content);
    emit('copied');
  } catch (err) {
    console.error('Failed to copy:', err);
  }
}

onBeforeUnmount(() => {
  cleanup();
});
</script>

<style scoped>
.copy-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-xs);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.copy-btn:hover {
  background: var(--color-border);
  color: var(--color-text-primary);
}
</style>
