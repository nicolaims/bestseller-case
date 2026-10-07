<script setup lang="ts">
import { useNotificationsStore } from '../../stores/notifications.store'

const notifications = useNotificationsStore()
</script>

<template>
  <div class="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
    <TransitionGroup name="toast">
      <div
        v-for="toast in notifications.toasts"
        :key="toast.id"
        class="pointer-events-auto flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium text-white shadow-lg"
        :class="toast.type === 'success' ? 'bg-gray-900' : 'bg-red-600'"
      >
        {{ toast.message }}
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
