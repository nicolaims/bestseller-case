import { onMounted, onUnmounted } from 'vue'

/** Calls `onEscape` when Escape is pressed, e.g. to close a drawer/overlay. */
export function useEscapeKey(onEscape: () => void) {
  function handler(event: KeyboardEvent) {
    if (event.key === 'Escape') onEscape()
  }
  onMounted(() => window.addEventListener('keydown', handler))
  onUnmounted(() => window.removeEventListener('keydown', handler))
}
