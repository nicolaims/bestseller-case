<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useApprovedPhotosStore } from '../stores/approvedPhotos.store'
import { useTicketsStore } from '../stores/tickets.store'
import ApprovedTicketCard from '../components/approved/ApprovedTicketCard.vue'
import TicketDetailDrawer from '../components/tickets/TicketDetailDrawer.vue'

const approvedPhotosStore = useApprovedPhotosStore()
const ticketsStore = useTicketsStore()
const selectedTicketId = ref<string | null>(null)

onMounted(() => {
  approvedPhotosStore.fetchApprovedPhotos()
  if (!ticketsStore.loaded) ticketsStore.fetchTickets()
})

const approvedTickets = computed(() =>
  approvedPhotosStore.approvedPhotos
    .map((approval) => ({
      ticket: ticketsStore.tickets.find((t) => t.id === approval.ticketId),
      approval,
    }))
    .filter((group): group is { ticket: NonNullable<typeof group.ticket>; approval: typeof group.approval } => !!group.ticket)
    .sort((a, b) => b.approval.approvedAt.localeCompare(a.approval.approvedAt)),
)
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
      <ApprovedTicketCard
        v-for="group in approvedTickets"
        :key="group.ticket.id"
        :ticket="group.ticket"
        :approval="group.approval"
        @open="selectedTicketId = group.ticket.id"
      />
    </div>
    <p v-if="approvedTickets.length === 0" class="text-gray-400">No approved tickets yet.</p>

    <TicketDetailDrawer :ticket-id="selectedTicketId" @close="selectedTicketId = null" />
  </div>
</template>
