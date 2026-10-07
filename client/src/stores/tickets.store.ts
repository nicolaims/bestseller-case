import { defineStore } from 'pinia'
import { api, ApiError } from '../api/client'
import { useApprovedPhotosStore } from './approvedPhotos.store'
import { useNotificationsStore } from './notifications.store'
import { usePartnersStore } from './partners.store'
import type { Priority, Ticket, TicketStatus } from '../types'

export interface TicketFilters {
  status?: TicketStatus
  partnerId?: string
  priority?: Priority
  search?: string
}

const STATUS_ORDER: TicketStatus[] = ['Pending', 'Sent', 'In Progress', 'Completed', 'Approved', 'Rejected']
const PRIORITY_ORDER: Priority[] = ['Urgent', 'High', 'Medium', 'Low']

export type SortBy = 'recent' | 'priority'

export const useTicketsStore = defineStore('tickets', {
  state: () => ({
    tickets: [] as Ticket[],
    filters: {} as TicketFilters,
    sortBy: 'recent' as SortBy,
    loaded: false,
    loadError: null as string | null,
  }),
  getters: {
    filteredTickets: (state) => {
      const search = state.filters.search?.trim().toLowerCase()
      const filtered = state.tickets.filter((t) => {
        if (state.filters.status && t.status !== state.filters.status) return false
        if (state.filters.partnerId && t.partnerId !== state.filters.partnerId) return false
        if (state.filters.priority && t.priority !== state.filters.priority) return false
        if (search && !t.photoId.toLowerCase().includes(search)) return false
        return true
      })
      return state.sortBy === 'priority'
        ? filtered.sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority))
        : filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },
    /** Status counts for the dashboard KPI cards; "awaiting approval" mirrors Completed. */
    kpis: (state) => {
      const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<TicketStatus, number>
      for (const t of state.tickets) counts[t.status]++
      return { ...counts, awaitingApproval: counts.Completed, total: state.tickets.length }
    },
    recentlyUpdated: (state) =>
      [...state.tickets].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5),
  },
  actions: {
    async fetchTickets() {
      this.loadError = null
      try {
        this.tickets = await api.get<Ticket[]>('/tickets')
        this.loaded = true
      } catch (error) {
        this.loadError = error instanceof ApiError ? error.message : 'Failed to load tickets.'
        useNotificationsStore().push(this.loadError, 'error')
      }
    },
    replaceTicket(ticket: Ticket) {
      const index = this.tickets.findIndex((t) => t.id === ticket.id)
      if (index === -1) this.tickets.push(ticket)
      else this.tickets[index] = ticket
    },
    async createTicket(formData: FormData) {
      const ticket = await this.runAction(() => api.post<Ticket>('/tickets', formData), 'Ticket created.')
      return ticket
    },
    async sendToPartner(id: string) {
      const partnerName = usePartnersStore().partners.find((p) => p.id === this.tickets.find((t) => t.id === id)?.partnerId)?.name
      await this.runAction(
        () => api.post<Ticket>(`/tickets/${id}/send`),
        partnerName ? `Sent to ${partnerName} — awaiting acknowledgement.` : 'Sent to partner.',
      )
      this.pollUntilAcknowledged(id)
    },
    async completeTicket(id: string) {
      await this.runAction(() => api.post<Ticket>(`/tickets/${id}/complete`), 'Marked as completed by the partner.')
    },
    async approveVariant(ticketId: string, variantId: string, variantName: string) {
      await this.runAction(
        () => api.post<{ ticket: Ticket }>(`/tickets/${ticketId}/approve`, { variantId }),
        `"${variantName}" approved — added to Approved Library.`,
      )
      await useApprovedPhotosStore().fetchApprovedPhotos()
    },
    async rejectVariant(ticketId: string, variantId: string, variantName: string, reason: string) {
      await this.runAction(
        () => api.post<Ticket>(`/tickets/${ticketId}/reject`, { variantId, reason }),
        `"${variantName}" rejected.`,
      )
    },
    async requeueTicket(id: string) {
      await this.runAction(() => api.post<Ticket>(`/tickets/${id}/requeue`), 'Returned to queue.')
    },
    async requeueVariant(ticketId: string, variantId: string) {
      await this.runAction(
        () => api.post<Ticket>(`/tickets/${ticketId}/variants/${variantId}/requeue`),
        'Colour returned to queue.',
      )
    },
    async forceAcknowledge(id: string) {
      await this.runAction(
        () => api.post<Ticket>(`/tickets/${id}/force-ack`),
        'Manually marked as acknowledged by the partner.',
      )
    },
    async addColourVariant(id: string, formData: FormData) {
      await this.runAction(() => api.post<Ticket>(`/tickets/${id}/variants`, formData), 'Colour added to ticket.')
    },
    /** Runs a mutating API call, applies the returned ticket(s) to state, and
     * surfaces a toast either way so every action point gets the same feedback. */
    async runAction<T extends Ticket | { ticket: Ticket }>(call: () => Promise<T>, successMessage: string): Promise<T> {
      try {
        const result = await call()
        this.replaceTicket('ticket' in result ? result.ticket : result)
        useNotificationsStore().push(successMessage, 'success')
        return result
      } catch (error) {
        const message = error instanceof ApiError ? error.message : 'Something went wrong.'
        useNotificationsStore().push(message, 'error')
        throw error
      }
    },
    /** Polls the ticket a few times after a simulated send, so the UI picks
     * up the partner's delayed acknowledgement (Sent -> In Progress) without
     * a manual refresh. Stops early once the status has moved on, either to
     * a success (In Progress) or a simulated partner rejection receipt. */
    pollUntilAcknowledged(id: string, attempt = 0) {
      const maxAttempts = 5
      setTimeout(async () => {
        const ticket = this.tickets.find((t) => t.id === id)
        if (!ticket || ticket.status !== 'Sent') return
        try {
          const fresh = await api.get<Ticket>(`/tickets/${id}`)
          this.replaceTicket(fresh)
          if (fresh.status === 'In Progress') {
            useNotificationsStore().push('Partner acknowledged receipt — now in progress.', 'success')
            return
          }
          if (fresh.partnerReceipt?.receiptStatus === 'Rejected') {
            useNotificationsStore().push(
              'Partner rejected the receipt — the ticket is stuck on "Sent". Use "Force acknowledge" to unstick it, or resend.',
              'error',
            )
            return
          }
        } catch (error) {
          if (attempt >= maxAttempts - 1) {
            const message = error instanceof ApiError ? error.message : 'Could not confirm partner acknowledgement.'
            useNotificationsStore().push(message, 'error')
            return
          }
        }
        if (attempt < maxAttempts - 1) this.pollUntilAcknowledged(id, attempt + 1)
      }, 1500)
    },
  },
})
