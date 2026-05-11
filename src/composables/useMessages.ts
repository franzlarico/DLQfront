import { computed, ref } from 'vue';
import { rabbitService } from '../services';
import type { InspectedMessage, QueueInfo } from '../types';

/**
 * Composable for managing message inspection and details
 */
export function useMessages() {
  const messages = ref<InspectedMessage[]>([]);
  const queueInfo = ref<QueueInfo | null>(null);
  const activeMessageId = ref<string | null>(null);
  const loading = ref(false);
  const error = ref('');
  const lastUpdated = ref('');

  const selectedMessage = computed(
    () => messages.value.find((msg) => msg.id === activeMessageId.value) ?? null
  );

  const hasMessages = computed(() => messages.value.length > 0);

  function clearSelection(): void {
    queueInfo.value = null;
    messages.value = [];
    activeMessageId.value = null;
  }

  async function loadMessages(queue: string, limit: number): Promise<void> {
    if (!queue || loading.value) return;

    loading.value = true;
    error.value = '';

    try {
      const [inspected, info] = await Promise.all([
        rabbitService.getMessages(queue, limit),
        rabbitService.getQueueInfo(queue),
      ]);

      queueInfo.value = info;
      messages.value = inspected;
      activeMessageId.value = inspected[0]?.id ?? null;
      lastUpdated.value = new Date().toISOString();
    } catch (err) {
      clearSelection();
      error.value = err instanceof Error ? err.message : String(err);
    } finally {
      loading.value = false;
    }
  }

  function selectMessage(messageId: string): void {
    if (messages.value.some((msg) => msg.id === messageId)) {
      activeMessageId.value = messageId;
    }
  }

  return {
    messages,
    queueInfo,
    activeMessageId,
    loading,
    error,
    lastUpdated,
    selectedMessage,
    hasMessages,
    clearSelection,
    loadMessages,
    selectMessage,
  };
}
