import { defineStore } from 'pinia'
import { api, ApiError } from '../api/client'
import { useNotificationsStore } from './notifications.store'
import type { ApprovedPhoto } from '../types'

export const useApprovedPhotosStore = defineStore('approvedPhotos', {
  state: () => ({
    approvedPhotos: [] as ApprovedPhoto[],
    loadError: null as string | null,
  }),
  actions: {
    async fetchApprovedPhotos() {
      this.loadError = null
      try {
        this.approvedPhotos = await api.get<ApprovedPhoto[]>('/approved-photos')
      } catch (error) {
        this.loadError = error instanceof ApiError ? error.message : 'Failed to load approved photos.'
        useNotificationsStore().push(this.loadError, 'error')
      }
    },
  },
})
