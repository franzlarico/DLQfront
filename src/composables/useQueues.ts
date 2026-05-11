import { computed, ref } from 'vue';
import { rabbitService } from '../services';
import type { QueueListItem } from '../types';

interface UseQueuesOptions {
  autoSelect?: boolean;
}

/**
 * Composable for managing queue list and selection
 */
export function useQueues(options: UseQueuesOptions = {}) {
  const { autoSelect = true } = options;

  const queueName = ref('');
  const queues = ref<QueueListItem[]>([]);
  const loadingQueues = ref(false);
  const error = ref('');

  const trimmedQueueName = computed(() => queueName.value.trim());

  const dlqQueues = computed(() => 
    queues.value.filter((queue) => queue.isDlq && queue.messageCount > 0)
  );

  const messageCount = computed(() =>
    dlqQueues.value.reduce((t, q) => t + q.messageCount, 0)
  );

  function queueExists(queue: string): boolean {
    return queues.value.some((item) => item.name === queue);
  }

  function applyDefaults(): void {
    if (!autoSelect) return;

    const discoveredQueue = dlqQueues.value[0];
    const currentQueue = trimmedQueueName.value;
    const currentQueueIsActive = currentQueue.length > 0 && queueExists(currentQueue);

    if (!discoveredQueue) {
      queueName.value = '';
      return;
    }

    if (!currentQueue || !currentQueueIsActive) {
      queueName.value = discoveredQueue.name;
    }
  }

  async function loadQueues(): Promise<void> {
    if (loadingQueues.value) return;

    loadingQueues.value = true;
    error.value = '';

    try {
      queues.value = await rabbitService.listQueues();
      applyDefaults();
    } catch (err) {
      queues.value = [];
      error.value = err instanceof Error ? err.message : String(err);
    } finally {
      loadingQueues.value = false;
    }
  }

  async function selectQueue(queue: QueueListItem): Promise<void> {
    queueName.value = queue.name;
  }

  return {
    queueName,
    queues,
    loadingQueues,
    error,
    trimmedQueueName,
    dlqQueues,
    messageCount,
    loadQueues,
    selectQueue,
    queueExists,
  };
}
