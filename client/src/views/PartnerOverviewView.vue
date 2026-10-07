<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { usePartnersStore } from '../stores/partners.store'
import { useTicketsStore } from '../stores/tickets.store'
import StatusBadge from '../components/badges/StatusBadge.vue'
import PartnerDetailDrawer from '../components/partners/PartnerDetailDrawer.vue'
import TicketDetailDrawer from '../components/tickets/TicketDetailDrawer.vue'
import type { TicketStatus } from '../types'

const partnersStore = usePartnersStore()
const ticketsStore = useTicketsStore()

onMounted(() => {
  if (!ticketsStore.loaded) ticketsStore.fetchTickets()
  if (!partnersStore.loaded) partnersStore.fetchPartners()
})

const selectedPartnerId = ref<string | null>(null)
const selectedTicketId = ref<string | null>(null)

const groups = computed(() =>
  partnersStore.partners.map((partner) => {
    const tickets = ticketsStore.tickets.filter((t) => t.partnerId === partner.id)
    const statusCounts = new Map<TicketStatus, number>()
    for (const t of tickets) statusCounts.set(t.status, (statusCounts.get(t.status) ?? 0) + 1)
    return { partner, tickets, statusCounts }
  }),
)

/** Opening a ticket from inside the partner menu replaces it, rather than
 * stacking two overlays on top of each other. */
function openTicketFromPartner(ticketId: string) {
  selectedPartnerId.value = null
  selectedTicketId.value = ticketId
}
</script>

<template>
  <div>
    <h1 class="mb-6 text-xl font-semibold text-gray-900">Partner Overview</h1>

    <p v-if="partnersStore.loadError" class="mb-4 flex items-center justify-between rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
      {{ partnersStore.loadError }}
      <button type="button" class="cursor-pointer font-medium underline" @click="partnersStore.fetchPartners()">Retry</button>
    </p>
    <p v-if="ticketsStore.loadError" class="mb-4 flex items-center justify-between rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
      {{ ticketsStore.loadError }}
      <button type="button" class="cursor-pointer font-medium underline" @click="ticketsStore.fetchTickets()">Retry</button>
    </p>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <button
        v-for="group in groups"
        :key="group.partner.id"
        type="button"
        class="cursor-pointer rounded-lg border border-gray-200 bg-white p-4 text-left transition-shadow hover:shadow-md"
        @click="selectedPartnerId = group.partner.id"
      >
        <h2 class="font-medium text-gray-900">{{ group.partner.name }}</h2>
        <p class="mb-3 text-xs text-gray-500">{{ group.tickets.length }} ticket(s)</p>
        <div class="flex flex-wrap gap-1">
          <span v-if="group.tickets.length === 0" class="text-xs text-gray-400">No tickets yet</span>
          <div v-for="[status, count] in group.statusCounts" :key="status" class="flex items-center gap-1">
            <StatusBadge :status="status" />
            <span class="text-xs text-gray-500">×{{ count }}</span>
          </div>
        </div>
      </button>
    </div>

    <PartnerDetailDrawer
      :partner-id="selectedPartnerId"
      @close="selectedPartnerId = null"
      @select-ticket="openTicketFromPartner"
    />
    <TicketDetailDrawer :ticket-id="selectedTicketId" @close="selectedTicketId = null" />
  </div>
</template>
