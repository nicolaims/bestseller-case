import { defineStore } from 'pinia'

export interface Toast {
  id: number
  message: string
  type: 'success' | 'error'
}

let nextId = 0

export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    toasts: [] as Toast[],
  }),
  actions: {
    /** Pushes a toast and auto-dismisses it after 3.5s. */
    push(message: string, type: Toast['type'] = 'success') {
      const id = nextId++
      this.toasts.push({ id, message, type })
      setTimeout(() => this.dismiss(id), 3500)
    },
    dismiss(id: number) {
      this.toasts = this.toasts.filter((t) => t.id !== id)
    },
  },
})
