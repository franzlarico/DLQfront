import { ref } from 'vue';

/**
 * Composable for clipboard operations
 */
export function useClipboard() {
  const copied = ref(false);
  let copyTimer: number | undefined;

  async function copyToClipboard(content: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(content);
      copied.value = true;

      if (copyTimer) window.clearTimeout(copyTimer);
      copyTimer = window.setTimeout(() => {
        copied.value = false;
      }, 2200);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      throw err;
    }
  }

  function cleanup(): void {
    if (copyTimer) window.clearTimeout(copyTimer);
  }

  return {
    copied,
    copyToClipboard,
    cleanup,
  };
}
