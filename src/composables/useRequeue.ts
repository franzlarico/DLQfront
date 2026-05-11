import { ref } from 'vue';
import { rabbitService } from '../services';
import type { RequeueResult } from '../types';

interface RequeuePayload {
  limit: number;
  targetExchange?: string;
  targetRoutingKey?: string;
}

interface UseRequeueOptions {
  onSuccess?: (result: RequeueResult) => void;
  onError?: (error: Error) => void;
}

/**
 * Composable for managing requeue operations
 */
export function useRequeue(options: UseRequeueOptions = {}) {
  const { onSuccess, onError } = options;

  const requeueing = ref(false);
  const error = ref('');
  const successMessage = ref('');

  let successTimer: number | undefined;

  function showSuccessMessage(message: string, duration = 5000): void {
    if (successTimer) window.clearTimeout(successTimer);
    successMessage.value = message;
    successTimer = window.setTimeout(() => {
      successMessage.value = '';
    }, duration);
  }

  async function requeue(queue: string, payload: RequeuePayload): Promise<RequeueResult | null> {
    if (!queue || requeueing.value) return null;

    requeueing.value = true;
    error.value = '';
    successMessage.value = '';

    try {
      const result = await rabbitService.requeue(queue, payload);
      showSuccessMessage(
        `✓ ${result.requeued} de ${result.requested} mensaje(s) reencolados exitosamente`
      );
      onSuccess?.(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      error.value = errorMessage;
      onError?.(err instanceof Error ? err : new Error(errorMessage));
      return null;
    } finally {
      requeueing.value = false;
    }
  }

  function cleanup(): void {
    if (successTimer) window.clearTimeout(successTimer);
  }

  return {
    requeueing,
    error,
    successMessage,
    requeue,
    showSuccessMessage,
    cleanup,
  };
}
