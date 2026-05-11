import { ref } from 'vue';

interface AutoRefreshOptions {
  interval?: number;
  onRefresh: () => Promise<void>;
}

/**
 * Composable for managing auto-refresh functionality
 */
export function useAutoRefresh(options: AutoRefreshOptions) {
  const { interval = 8000, onRefresh } = options;

  const autoRefresh = ref(false);
  let refreshTimer: number | undefined;

  function startAutoRefresh(): void {
    stopAutoRefresh();
    refreshTimer = window.setInterval(() => {
      void onRefresh();
    }, interval);
  }

  function stopAutoRefresh(): void {
    if (refreshTimer) {
      window.clearInterval(refreshTimer);
      refreshTimer = undefined;
    }
  }

  function setAutoRefresh(enabled: boolean): void {
    autoRefresh.value = enabled;
    if (enabled) {
      void onRefresh();
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
  }

  function cleanup(): void {
    stopAutoRefresh();
  }

  return {
    autoRefresh,
    setAutoRefresh,
    startAutoRefresh,
    stopAutoRefresh,
    cleanup,
  };
}
