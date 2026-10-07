<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useApprovedPhotosStore } from '../stores/approvedPhotos.store'
import { useTicketsStore } from '../stores/tickets.store'
import ApprovedTicketCard from '../components/approved/ApprovedTicketCard.vue'
import type { ApprovedPhoto } from '../types'

const approvedPhotosStore = useApprovedPhotosStore()
const ticketsStore = useTicketsStore()

onMounted(() => {
  approvedPhotosStore.fetchApprovedPhotos()
  if (!ticketsStore.loaded) ticketsStore.fetchTickets()
})

/** Approved photos are per colour variant, but the ticket is the unit of
 * approval — group them back into one card per ticket. */
const groups = computed(() => {
  const byTicket = new Map<string, ApprovedPhoto[]>()
  for (const photo of approvedPhotosStore.approvedPhotos) {
    const list = byTicket.get(photo.ticketId) ?? []
    list.push(photo)
    byTicket.set(photo.ticketId, list)
  }
  return [...byTicket.entries()]
    .map(([ticketId, photos]) => ({
      ticket: ticketsStore.tickets.find((t) => t.id === ticketId),
      photos,
    }))
    .filter((group): group is { ticket: NonNullable<typeof group.ticket>; photos: ApprovedPhoto[] } => !!group.ticket)
    .sort((a, b) => b.photos[0].approvedAt.localeCompare(a.photos[0].approvedAt))
})
</script>

<template>
  <div>
    <h1 class="mb-6 text-xl font-semibold text-gray-900">Approved Library</h1>
    <p v-if="approvedPhotosStore.loadError" class="mb-4 flex items-center justify-between rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
      {{ approvedPhotosStore.loadError }}
      <button type="button" class="cursor-pointer font-medium underline" @click="approvedPhotosStore.fetchApprovedPhotos()">
        Retry
      </button>
    </p>
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <ApprovedTicketCard v-for="group in groups" :key="group.ticket.id" :ticket="group.ticket" :photos="group.photos" />
    </div>
    <p v-if="groups.length === 0" class="text-gray-400">No approved photos yet.</p>
  </div>
</template>
