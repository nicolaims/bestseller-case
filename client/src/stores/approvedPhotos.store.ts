import { defineStore } from 'pinia'
import { api } from '../api/client'
import type { ApprovedPhoto } from '../types'

export const useApprovedPhotosStore = defineStore('approvedPhotos', {
  state: () => ({
    approvedPhotos: [] as ApprovedPhoto[],
  }),
  actions: {
    async fetchApprovedPhotos() {
      this.approvedPhotos = await api.get<ApprovedPhoto[]>('/approved-photos')
    },
  },
})
