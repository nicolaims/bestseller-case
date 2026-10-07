<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useTicketsStore } from '../stores/tickets.store'
import { usePartnersStore } from '../stores/partners.store'
import KpiCard from '../components/dashboard/KpiCard.vue'
import StatusBadge from '../components/badges/StatusBadge.vue'
import PriorityBadge from '../components/badges/PriorityBadge.vue'
import TicketDetailDrawer from '../components/tickets/TicketDetailDrawer.vue'

const ticketsStore = useTicketsStore()
const partnersStore = usePartnersStore()
const selectedTicketId = ref<string | null>(null)

onMounted(() => {
  if (!ticketsStore.loaded) ticketsStore.fetchTickets()
  if (!partnersStore.loaded) partnersStore.fetchPartners()
})

function partnerName(partnerId: string) {
  return partnersStore.partners.find((p) => p.id === partnerId)?.name ?? '—'
}
</script>

<template>
  <div>
    <h1 class="mb-6 text-xl font-semibold text-gray-900">Dashboard</h1>

    <div class="mb-8 grid grid-cols-3 gap-4 lg:grid-cols-6">
      <KpiCard label="Pending" :value="ticketsStore.kpis.Pending" />
      <KpiCard label="Sent" :value="ticketsStore.kpis.Sent" />
      <KpiCard label="In Progress" :value="ticketsStore.kpis['In Progress']" />
      <KpiCard label="Awaiting approval" :value="ticketsStore.kpis.awaitingApproval" />
      <KpiCard label="Approved" :value="ticketsStore.kpis.Approved" />
      <KpiCard label="Rejected" :value="ticketsStore.kpis.Rejected" />
    </div>

    <h2 class="mb-3 text-sm font-medium text-gray-700">Recent activity</h2>
    <div class="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
      <button
        v-for="ticket in ticketsStore.recentlyUpdated"
        :key="ticket.id"
        type="button"
        class="flex w-full cursor-pointer items-center gap-4 px-4 py-3 text-left text-sm transition-colors hover:bg-gray-50"
        @click="selectedTicketId = ticket.id"
      >
        <img :src="ticket.basePhotos.front" :alt="ticket.photoId" class="h-12 w-10 shrink-0 rounded object-cover" />
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="font-medium text-gray-900">{{ ticket.photoId }}</span>
            <PriorityBadge :priority="ticket.priority" />
          </div>
          <div class="mt-1 flex flex-wrap gap-1">
            <span
              v-for="variant in ticket.colourVariants"
              :key="variant.id"
              class="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600"
            >
              {{ variant.name }}
            </span>
          </div>
        </div>
        <span class="shrink-0 text-gray-500">{{ partnerName(ticket.partnerId) }}</span>
        <span class="shrink-0 text-gray-500">{{ new Date(ticket.updatedAt).toLocaleString() }}</span>
        <StatusBadge :status="ticket.status" />
      </button>
      <p v-if="ticketsStore.tickets.length === 0" class="px-4 py-6 text-center text-gray-400">No tickets yet.</p>
    </div>

    <TicketDetailDrawer :ticket-id="selectedTicketId" @close="selectedTicketId = null" />
  </div>
</template>
