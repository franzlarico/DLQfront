import { ref } from 'vue';

/**
 * Composable for clipboard operations
 */
export function useClipboard() {
  const copied = ref(false);
  let copyTimer: number | undefined;

  async function copyToClipboard(content: string): Promise<void> {
    try {
      // API moderna
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(content);
      } else {
        // Fallback universal
        const textarea = document.createElement('textarea');

        textarea.value = content;

        // Evita scroll en iOS
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        textarea.style.pointerEvents = 'none';

        document.body.appendChild(textarea);

        // iOS Safari
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);

        const successful = document.execCommand('copy');

        document.body.removeChild(textarea);

        if (!successful) {
          throw new Error('execCommand failed');
        }
      }

      copied.value = true;

      if (copyTimer) {
        window.clearTimeout(copyTimer);
      }

      copyTimer = window.setTimeout(() => {
        copied.value = false;
      }, 2200);

    } catch (err) {
      console.error('Failed to copy to clipboard:', err);

      copied.value = false;

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
