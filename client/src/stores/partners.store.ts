import { defineStore } from 'pinia'
import { api, ApiError } from '../api/client'
import { useNotificationsStore } from './notifications.store'
import type { Partner } from '../types'

export const usePartnersStore = defineStore('partners', {
  state: () => ({
    partners: [] as Partner[],
    loaded: false,
    loadError: null as string | null,
  }),
  actions: {
    async fetchPartners() {
      this.loadError = null
      try {
        this.partners = await api.get<Partner[]>('/partners')
        this.loaded = true
      } catch (error) {
        this.loadError = error instanceof ApiError ? error.message : 'Failed to load partners.'
        useNotificationsStore().push(this.loadError, 'error')
      }
    },
  },
})
