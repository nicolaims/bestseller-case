import { defineStore } from 'pinia'

export const useLightboxStore = defineStore('lightbox', {
  state: () => ({
    url: null as string | null,
    alt: '',
  }),
  actions: {
    open(url: string, alt = '') {
      this.url = url
      this.alt = alt
    },
    close() {
      this.url = null
    },
  },
})
