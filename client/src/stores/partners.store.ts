import { defineStore } from 'pinia'
import { api } from '../api/client'
import type { Partner } from '../types'

export const usePartnersStore = defineStore('partners', {
  state: () => ({
    partners: [] as Partner[],
    loaded: false,
  }),
  actions: {
    async fetchPartners() {
      this.partners = await api.get<Partner[]>('/partners')
      this.loaded = true
    },
  },
})
